import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server } from 'socket.io'
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

interface ManagedProcess {
  appId: string; pid: number | null; childProcess: ChildProcess | null
  status: 'starting' | 'running' | 'stopped' | 'crashed'
  cmd: string; cwd: string; env: Record<string, string>; port: number | null
  startedAt: Date | null; exitCode: number | null; lastError: string | null
  restartCount: number; cpuUsage: number; memoryUsage: number
  outputBuffer: string[]; isRestarting: boolean
  statsInterval: ReturnType<typeof setInterval> | null
  lastCpuUsage: { user: number; system: number } | null
  lastStatsTime: number | null
  maxRestartAttempts: number; restartPolicy: 'always' | 'on-failure' | 'never'
}

const PORT = 3003
const MAX_OUTPUT_LINES = 1000
const STATS_INTERVAL_MS = 2000
const SIGKILL_DELAY_MS = 5000
const DEFAULT_MAX_RESTARTS = 5
const PROJECT_ROOT = path.resolve(import.meta.dir, '..', '..')
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs')
const processes = new Map<string, ManagedProcess>()

function sendJson(res: ServerResponse, status: number, body: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString()))
    req.on('error', reject)
  })
}

function ensureLogsDir(appId: string): string {
  const dir = path.join(LOGS_DIR, appId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function appendLog(appId: string, data: string, src: 'stdout' | 'stderr') {
  try {
    const dir = ensureLogsDir(appId)
    fs.appendFileSync(path.join(dir, 'app.log'), `${new Date().toISOString()} ${src === 'stderr' ? '[STDERR] ' : ''}${data}\n`)
  } catch (_e) {}
}

function pushOutput(mp: ManagedProcess, line: string) {
  mp.outputBuffer.push(line)
  if (mp.outputBuffer.length > MAX_OUTPUT_LINES) mp.outputBuffer.shift()
}

function clearStats(mp: ManagedProcess) {
  if (mp.statsInterval) { clearInterval(mp.statsInterval); mp.statsInterval = null }
  mp.cpuUsage = 0; mp.memoryUsage = 0; mp.lastCpuUsage = null; mp.lastStatsTime = null
}

function collectStats(io: Server, mp: ManagedProcess) {
  if (mp.statsInterval) clearInterval(mp.statsInterval)
  mp.lastCpuUsage = null; mp.lastStatsTime = Date.now()
  mp.statsInterval = setInterval(() => {
    if (!mp.childProcess || mp.childProcess.killed) { clearStats(mp); return }
    const now = Date.now()
    const elapsed = (now - (mp.lastStatsTime || now)) / 1000
    let mem = 0
    if (mp.pid) try {
      const s = fs.readFileSync(`/proc/${mp.pid}/statm`, 'utf-8').trim().split(/\s+/)
      mem = (parseInt(s[1], 10) * 4096) / (1024 * 1024)
    } catch (_e) {}
    mp.memoryUsage = Math.round(mem * 100) / 100
    let cpu = 0
    if (mp.pid && mp.lastCpuUsage) try {
      const raw = fs.readFileSync(`/proc/${mp.pid}/stat`, 'utf-8').trim()
      const afterParen = raw.split(')')[1]
      if (afterParen) {
        const f = afterParen.trim().split(/\s+/)
        const u = parseInt(f[11], 10) || 0, st = parseInt(f[12], 10) || 0
        if (elapsed > 0) cpu = Math.min(Math.round(((u + st - mp.lastCpuUsage.user - mp.lastCpuUsage.system) / elapsed) * 10000) / 100, 100)
      }
    } catch (_e) {}
    if (mp.pid) try {
      const raw = fs.readFileSync(`/proc/${mp.pid}/stat`, 'utf-8').trim()
      const afterParen = raw.split(')')[1]
      if (afterParen) {
        const f = afterParen.trim().split(/\s+/)
        mp.lastCpuUsage = { user: parseInt(f[11], 10) || 0, system: parseInt(f[12], 10) || 0 }
      }
    } catch (_e) {}
    mp.lastStatsTime = now; mp.cpuUsage = cpu
    io.emit('process:stats', { appId: mp.appId, cpu: mp.cpuUsage, memory: mp.memoryUsage, timestamp: new Date().toISOString() })
  }, STATS_INTERVAL_MS)
}

function getUptime(mp: ManagedProcess): number {
  if (!mp.startedAt || mp.status === 'stopped' || mp.status === 'crashed') return 0
  return Math.floor((Date.now() - mp.startedAt.getTime()) / 1000)
}

function summary(mp: ManagedProcess) {
  return {
    appId: mp.appId, pid: mp.pid, status: mp.status, cmd: mp.cmd, cwd: mp.cwd, port: mp.port,
    cpuUsage: mp.cpuUsage, memoryUsage: mp.memoryUsage, uptime: getUptime(mp),
    exitCode: mp.exitCode, lastError: mp.lastError, restartCount: mp.restartCount,
    startedAt: mp.startedAt?.toISOString() || null,
  }
}

function startProcess(
  io: Server, appId: string, cmd: string, cwd: string, env: Record<string, string>,
  port: number | null, maxRestarts?: number, policy?: string,
): Promise<{ success: boolean; pid?: number; error?: string }> {
  const existing = processes.get(appId)
  if (existing && existing.childProcess && !existing.childProcess.killed)
    return Promise.resolve({ success: false, error: `Process ${appId} is already running` })
  if (!cmd?.trim()) return Promise.resolve({ success: false, error: 'Command cannot be empty' })
  if (existing) clearStats(existing)

  const mp: ManagedProcess = {
    appId, pid: null, childProcess: null, status: 'starting', cmd, cwd,
    env: { ...env, ...process.env } as Record<string, string>, port: port ?? null,
    startedAt: new Date(), exitCode: null, lastError: null,
    restartCount: existing?.restartCount ?? 0, cpuUsage: 0, memoryUsage: 0,
    outputBuffer: existing?.outputBuffer ?? [], isRestarting: false, statsInterval: null,
    lastCpuUsage: null, lastStatsTime: null,
    maxRestartAttempts: maxRestarts ?? DEFAULT_MAX_RESTARTS,
    restartPolicy: (policy as any) ?? 'on-failure',
  }
  processes.set(appId, mp)

  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, [], { cwd, env: mp.env, stdio: ['pipe', 'pipe', 'pipe'], shell: true })
      mp.childProcess = child; mp.pid = child.pid ?? null; mp.status = 'running'

      let sBuf = '', eBuf = ''
      child.stdout?.on('data', (d: Buffer) => {
        sBuf += d.toString(); const lines = sBuf.split('\n'); sBuf = lines.pop() || ''
        for (const l of lines) if (l.trim()) {
          pushOutput(mp, l); appendLog(appId, l, 'stdout')
          io.emit('process:output', { appId, data: l, source: 'stdout' })
        }
      })
      child.stderr?.on('data', (d: Buffer) => {
        eBuf += d.toString(); const lines = eBuf.split('\n'); eBuf = lines.pop() || ''
        for (const l of lines) if (l.trim()) {
          pushOutput(mp, `[STDERR] ${l}`); appendLog(appId, l, 'stderr')
          io.emit('process:output', { appId, data: l, source: 'stderr' })
        }
      })

      child.on('exit', (code, signal) => {
        const ec = code ?? (signal ? -1 : 0)
        mp.exitCode = ec; mp.status = ec !== 0 ? 'crashed' : 'stopped'; mp.startedAt = null; clearStats(mp)
        io.emit('process:stopped', { appId, exitCode: ec, timestamp: new Date().toISOString() })
        if (ec !== 0) {
          mp.lastError = `Exited with code ${ec}${signal ? ` (signal: ${signal})` : ''}`
          io.emit('process:crashed', { appId, exitCode: ec, error: mp.lastError, timestamp: new Date().toISOString() })
          if (!mp.isRestarting && mp.restartPolicy !== 'never' && mp.restartCount < mp.maxRestartAttempts) {
            const delay = 5000 * Math.pow(2, mp.restartCount)
            console.log(`${appId} crashed, auto-restart in ${delay}ms (${mp.restartCount + 1}/${mp.maxRestartAttempts})`)
            setTimeout(() => {
              mp.restartCount++
              startProcess(io, appId, cmd, cwd, env, port, mp.maxRestartAttempts, mp.restartPolicy)
            }, delay)
          } else if (mp.restartCount >= mp.maxRestartAttempts) {
            console.log(`${appId} crash-loop-detected (${mp.restartCount} attempts)`)
            io.emit('process:crash-loop-detected', { appId, restartCount: mp.restartCount, timestamp: new Date().toISOString() })
          }
        }
      })

      child.on('error', (err) => {
        mp.status = 'crashed'; mp.lastError = err.message; mp.exitCode = -1; mp.startedAt = null; clearStats(mp)
        io.emit('process:crashed', { appId, exitCode: -1, error: err.message, timestamp: new Date().toISOString() })
      })

      collectStats(io, mp)
      io.emit('process:started', { appId, pid: child.pid, timestamp: new Date().toISOString() })
      console.log(`Started ${appId} (PID ${child.pid})`)
      resolve({ success: true, pid: child.pid })
    } catch (err: any) {
      mp.status = 'crashed'; mp.lastError = err.message
      resolve({ success: false, error: err.message })
    }
  })
}

function stopProcess(appId: string): Promise<{ success: boolean; error?: string }> {
  const mp = processes.get(appId)
  if (!mp) return Promise.resolve({ success: false, error: `No process for ${appId}` })
  if (!mp.childProcess || mp.childProcess.killed) {
    mp.status = 'stopped'; mp.exitCode = mp.exitCode ?? 0; clearStats(mp)
    return Promise.resolve({ success: true })
  }
  return new Promise((resolve) => {
    console.log(`Stopping ${appId} (PID ${mp.pid})`)
    mp.childProcess!.kill('SIGTERM')
    const t = setTimeout(() => {
      if (mp.childProcess && !mp.childProcess.killed) {
        console.log(`Force-killing ${appId}`)
        try { mp.childProcess.kill('SIGKILL') } catch (_e) {}
      }
    }, SIGKILL_DELAY_MS)
    mp.childProcess!.on('exit', () => {
      clearTimeout(t); mp.status = 'stopped'; mp.startedAt = null; clearStats(mp)
      io.emit('process:stopped', { appId, exitCode: mp.exitCode, timestamp: new Date().toISOString() })
      console.log(`Stopped ${appId}`)
      resolve({ success: true })
    })
  })
}

function restartProcess(appId: string, cmd: string, cwd: string, env: Record<string, string>, port: number | null): Promise<{ success: boolean; error?: string }> {
  return new Promise(async (resolve) => {
    const mp = processes.get(appId)
    if (mp) mp.isRestarting = true
    if (mp && mp.childProcess && !mp.childProcess.killed) {
      await stopProcess(appId)
      await new Promise(r => setTimeout(r, 500))
    }
    if (mp) mp.restartCount++
    const r = await startProcess(io, appId, cmd, cwd, env, port, mp?.maxRestartAttempts, mp?.restartPolicy)
    if (r.success) { const n = processes.get(appId); if (n) n.isRestarting = false }
    resolve(r)
  })
}

// ── HTTP Handler ───────────────────────────────────────────────────────────
async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const u = new URL(req.url || '/', `http://localhost:${PORT}`)
  const p = u.pathname, m = req.method?.toUpperCase()

  if (m === 'POST' && p === '/start') {
    try {
      const b = JSON.parse(await readBody(req))
      if (!b.appId || !b.cmd || !b.cwd) return sendJson(res, 400, { success: false, error: 'appId, cmd, cwd required' })
      return sendJson(res, 200, await startProcess(io, b.appId, b.cmd, b.cwd, b.env || {}, b.port ?? null, b.maxRestartAttempts, b.restartPolicy))
    } catch (e: any) { return sendJson(res, 500, { success: false, error: e.message }) }
  }
  if (m === 'POST' && p === '/stop') {
    try {
      const b = JSON.parse(await readBody(req))
      if (!b.appId) return sendJson(res, 400, { success: false, error: 'appId required' })
      return sendJson(res, 200, await stopProcess(b.appId))
    } catch (e: any) { return sendJson(res, 500, { success: false, error: e.message }) }
  }
  if (m === 'POST' && p === '/restart') {
    try {
      const b = JSON.parse(await readBody(req))
      if (!b.appId || !b.cmd || !b.cwd) return sendJson(res, 400, { success: false, error: 'appId, cmd, cwd required' })
      return sendJson(res, 200, await restartProcess(b.appId, b.cmd, b.cwd, b.env || {}, b.port ?? null))
    } catch (e: any) { return sendJson(res, 500, { success: false, error: e.message }) }
  }
  if (m === 'GET' && p.startsWith('/status/')) {
    const id = p.slice('/status/'.length), mp = processes.get(id)
    if (!mp) return sendJson(res, 404, { success: false, error: `No process for ${id}` })
    return sendJson(res, 200, { success: true, ...summary(mp) })
  }
  if (m === 'GET' && p === '/all') {
    const all = Array.from(processes.values()).map(summary)
    return sendJson(res, 200, { success: true, processes: all, total: all.length })
  }
  if (m === 'POST' && p === '/install') {
    try {
      const b = JSON.parse(await readBody(req))
      if (!b.appId || !b.cmd || !b.cwd) return sendJson(res, 400, { success: false, error: 'appId, cmd, cwd required' })
      console.log(`Install ${b.appId}: ${b.cmd}`)
      const child = spawn(b.cmd, [], {
        cwd: b.cwd, env: { ...b.env, ...process.env } as Record<string, string>,
        stdio: ['pipe', 'pipe', 'pipe'], shell: true,
      })
      child.stdout?.on('data', (d: Buffer) => io.emit('process:install-progress', { appId: b.appId, data: d.toString() }))
      child.stderr?.on('data', (d: Buffer) => io.emit('process:install-progress', { appId: b.appId, data: d.toString() }))
      child.on('exit', (c) => console.log(`Install ${b.appId} done (exit ${c ?? 0})`))
      return sendJson(res, 200, { success: true, pid: child.pid, message: 'Install started' })
    } catch (e: any) { return sendJson(res, 500, { success: false, error: e.message }) }
  }
  sendJson(res, 404, { success: false, error: 'Not found' })
}

// ── Create HTTP server with request handler as the callback ────────────────
const httpServer = createServer((req, res) => {
  handleHttp(req, res)
})

// ── Attach Socket.IO on a dedicated path so it doesn't interfere ───────────
const io = new Server(httpServer, {
  path: '/socket.io',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`PM client connected: ${socket.id}`)
  socket.on('disconnect', () => console.log(`PM client disconnected: ${socket.id}`))
})

// ── Start ──────────────────────────────────────────────────────────────────
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
httpServer.listen(PORT, () => {
  console.log(`Process Manager on port ${PORT}`)
  console.log(`Root: ${PROJECT_ROOT}`)
  console.log(`Logs: ${LOGS_DIR}`)
  console.log(`Socket.IO path: /socket.io`)
})

// ── Shutdown ───────────────────────────────────────────────────────────────
function shutdown() {
  console.log('Shutting down PM...')
  for (const [, mp] of processes) {
    clearStats(mp)
    if (mp.childProcess && !mp.childProcess.killed) {
      try { mp.childProcess.kill('SIGTERM') } catch (_e) {}
      try { mp.childProcess.kill('SIGKILL') } catch (_e) {}
    }
  }
  httpServer.close(() => { console.log('PM down'); process.exit(0) })
  setTimeout(() => process.exit(0), 5000)
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
