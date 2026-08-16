import { createServer } from 'http'
import { Server, Socket } from 'socket.io'
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

interface TerminalSession {
  id: string
  appId: string
  process: ChildProcess | null
  cwd: string
  createdAt: Date
  lastActivity: Date
  outputBuffer: string
  maxOutput: number
  timeout: ReturnType<typeof setTimeout> | null
}

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000
const MAX_OUTPUT_BYTES = 1 * 1024 * 1024
const PORT = 3004

const sessions = new Map<string, TerminalSession>()

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/socket.io',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

function resetInactivityTimeout(session: TerminalSession) {
  if (session.timeout) clearTimeout(session.timeout)
  session.lastActivity = new Date()
  session.timeout = setTimeout(() => {
    console.log(`Terminal session ${session.id} timed out due to inactivity`)
    killSession(session)
    const sock = io.sockets.sockets.get(session.id)
    if (sock) {
      sock.emit('terminal:error', { message: 'Session timed out due to inactivity (5 minutes)' })
      sock.emit('terminal:exit', { code: null })
    }
  }, INACTIVITY_TIMEOUT_MS)
}

function killSession(session: TerminalSession) {
  if (session.timeout) { clearTimeout(session.timeout); session.timeout = null }
  if (session.process) {
    try { if (!session.process.killed) session.process.kill('SIGKILL') } catch (_e) {}
    session.process = null
  }
  sessions.delete(session.id)
}

io.on('connection', (socket: Socket) => {
  console.log(`Terminal client connected: ${socket.id}`)

  socket.on('terminal:join', (data: { appId: string; cwd?: string }) => {
    const { appId, cwd } = data
    if (!appId || typeof appId !== 'string') {
      socket.emit('terminal:error', { message: 'appId is required' })
      return
    }

    // Kill any existing session for this socket
    const existingSession = sessions.get(socket.id)
    if (existingSession) killSession(existingSession)

    // Use provided cwd or try to resolve from appId
    let appPath = cwd || ''
    if (!appPath) {
      // Fallback: try to find app directory by slug patterns
      const PROJECT_ROOT = path.resolve(import.meta.dir, '..', '..')
      const APPS_DIR = path.join(PROJECT_ROOT, 'apps')
      if (fs.existsSync(APPS_DIR)) {
        appPath = APPS_DIR
      } else {
        appPath = PROJECT_ROOT
      }
    }

    // Ensure directory exists
    if (!fs.existsSync(appPath)) {
      fs.mkdirSync(appPath, { recursive: true })
    }

    const shellPath = fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh'

    try {
      const child = spawn(shellPath, [], {
        cwd: appPath,
        env: { ...(process.env as Record<string, string>), HOME: appPath, TERM: 'xterm-256color' },
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      const session: TerminalSession = {
        id: socket.id, appId, process: child, cwd: appPath,
        createdAt: new Date(), lastActivity: new Date(),
        outputBuffer: '', maxOutput: MAX_OUTPUT_BYTES, timeout: null,
      }
      sessions.set(socket.id, session)
      resetInactivityTimeout(session)

      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString()
        session.outputBuffer += text
        if (session.outputBuffer.length > session.maxOutput)
          session.outputBuffer = session.outputBuffer.slice(-session.maxOutput)
        socket.emit('terminal:output', { data: text })
      })

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString()
        session.outputBuffer += text
        if (session.outputBuffer.length > session.maxOutput)
          session.outputBuffer = session.outputBuffer.slice(-session.maxOutput)
        socket.emit('terminal:output', { data: text })
      })

      child.on('exit', (code) => {
        socket.emit('terminal:exit', { code })
        console.log(`Terminal process for ${appId} exited with code ${code}`)
        if (session.timeout) { clearTimeout(session.timeout); session.timeout = null }
        session.process = null
        sessions.delete(socket.id)
      })

      child.on('error', (err) => {
        socket.emit('terminal:error', { message: `Failed to start terminal: ${err.message}` })
        socket.emit('terminal:exit', { code: -1 })
        console.error(`Terminal process error for ${appId}:`, err.message)
        if (session.timeout) { clearTimeout(session.timeout); session.timeout = null }
        session.process = null
        sessions.delete(socket.id)
      })

      console.log(`Terminal session created for ${appId} (socket: ${socket.id}, PID: ${child.pid}, cwd: ${appPath})`)
    } catch (err: any) {
      socket.emit('terminal:error', { message: `Failed to start terminal: ${err.message}` })
      console.error(`Failed to create terminal for ${appId}:`, err.message)
    }
  })

  socket.on('terminal:input', (data: { data: string }) => {
    const session = sessions.get(socket.id)
    if (!session) { socket.emit('terminal:error', { message: 'No active terminal session' }); return }
    if (!session.process || session.process.killed) { socket.emit('terminal:error', { message: 'Terminal process is not running' }); return }
    try {
      session.process.stdin?.write(data.data)
      resetInactivityTimeout(session)
    } catch (err: any) {
      socket.emit('terminal:error', { message: `Failed to write to terminal: ${err.message}` })
    }
  })

  socket.on('terminal:resize', (data: { cols: number; rows: number }) => {
    const session = sessions.get(socket.id)
    if (!session) return
    console.log(`Terminal resize for ${session.appId}: ${data.cols}x${data.rows}`)
  })

  socket.on('disconnect', () => {
    const session = sessions.get(socket.id)
    if (session) {
      console.log(`Terminal client disconnected: ${socket.id} (app: ${session.appId})`)
      killSession(session)
    } else {
      console.log(`Terminal client disconnected: ${socket.id}`)
    }
  })

  socket.on('error', (err) => { console.error(`Socket error (${socket.id}):`, err) })
})

httpServer.listen(PORT, () => {
  console.log(`Terminal Service running on port ${PORT}`)
  console.log(`Socket.IO path: /socket.io`)
})

function gracefulShutdown() {
  console.log('Shutting down terminal service...')
  for (const [id, session] of sessions) {
    console.log(`Killing terminal session ${id} (app: ${session.appId})`)
    killSession(session)
  }
  httpServer.close(() => { console.log('Terminal service shut down'); process.exit(0) })
  setTimeout(() => process.exit(0), 5000)
}

process.on('SIGTERM', gracefulShutdown)
process.on('SIGINT', gracefulShutdown)
