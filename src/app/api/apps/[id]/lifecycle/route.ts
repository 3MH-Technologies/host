import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError, sanitizeCommand } from '@/lib/utils/security'
import { APP_STATUS, TRANSITIONS, STABLE_STATES, type ApiResponse, type AppStatus } from '@/lib/types'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)
const APPS_DIR = path.join(process.cwd(), 'apps')

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data })
}

function err(code: string, message: string, details?: string, actionable?: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details, actionable } },
    { status }
  )
}

const PROCESS_MANAGER_URL = 'http://localhost:3003'

// POST /api/apps/[id]/lifecycle?action=start|stop|restart|rebuild|install
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    const validActions = ['start', 'stop', 'restart', 'rebuild', 'install']
    if (!action || !validActions.includes(action)) {
      return err('VALIDATION_ERROR', `Invalid action: ${action || 'none'}. Must be one of: ${validActions.join(', ')}`)
    }

    const app = await db.application.findUnique({
      where: { id },
      include: { envVars: true },
    })

    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, 'Check the application ID and try again', 404)
    }

    // Validate state transition
    const actionToStatusMap: Record<string, AppStatus> = {
      start: APP_STATUS.STARTING,
      stop: APP_STATUS.STOPPING,
      restart: APP_STATUS.RESTARTING,
      rebuild: APP_STATUS.REBUILDING,
      install: APP_STATUS.INSTALLING,
    }

    const targetStatus = actionToStatusMap[action]
    const allowedTransitions = TRANSITIONS[app.status as AppStatus] || []

    if (!allowedTransitions.includes(targetStatus)) {
      return err(
        'INVALID_STATE',
        `Cannot ${action} application in "${app.status}" state`,
        `Current status: ${app.status}. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`,
        `The application must be in one of the following states to ${action}: ${STABLE_STATES.filter(s => TRANSITIONS[s]?.includes(targetStatus)).join(', ')}`
      )
    }

    switch (action) {
      case 'start':
        return handleStart(app)
      case 'stop':
        return handleStop(app)
      case 'restart':
        return handleRestart(app)
      case 'rebuild':
        return handleRebuild(app)
      case 'install':
        return handleInstall(app)
      default:
        return err('VALIDATION_ERROR', `Unknown action: ${action}`)
    }
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error(`Lifecycle action failed:`, error)
    return err('INTERNAL_ERROR', `Operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, undefined, undefined, 500)
  }
}

async function handleStart(app: any) {
  if (!app.startCmd) {
    await db.application.update({
      where: { id: app.id },
      data: { status: 'FAILED', lastFailedAt: new Date(), lastError: 'No start command configured' },
    })
    await createAuditLog(app.id, 'start', 'failed', 'Cannot start: no start command configured')
    return err('CONFIG_ERROR', 'No start command configured for this application', undefined, 'Set a start command in the application settings before starting')
  }

  // Build env object from env vars
  const env: Record<string, string> = {}
  for (const ev of app.envVars) {
    env[ev.key] = ev.value
  }

  // Auto-install dependencies if installCmd exists
  if (app.installCmd) {
    try {
      await db.application.update({
        where: { id: app.id },
        data: { status: 'INSTALLING' },
      })
      await createAuditLog(app.id, 'install', 'success', `Auto-installing dependencies before start for "${app.name}"`)

      const installEnv: Record<string, string> = {}
      for (const ev of app.envVars) {
        if (ev.scope === 'all' || ev.scope === 'build') installEnv[ev.key] = ev.value
      }

      const { stdout, stderr } = await execAsync(app.installCmd, {
        cwd: app.storagePath,
        env: { ...process.env, ...installEnv },
        timeout: 300000,
      })

      // Log install output to app.log
      const logDir = path.join(process.cwd(), 'logs', app.id)
      await fs.mkdir(logDir, { recursive: true })
      const logFile = path.join(logDir, 'app.log')
      await fs.appendFile(logFile, `[${new Date().toISOString()}] [INSTALL] ${stdout}\n`)
      if (stderr) await fs.appendFile(logFile, `[${new Date().toISOString()}] [INSTALL STDERR] ${stderr}\n`)
      await createAuditLog(app.id, 'install', 'success', `Dependencies installed for "${app.name}"`)
    } catch (installError: unknown) {
      const installErr = installError as { message?: string; stderr?: string }
      const errorMsg = installErr?.message || 'Install command failed'
      const stderrOutput = installErr?.stderr || ''
      // Log the error but don't fail - user may have manually installed deps
      const logDir = path.join(process.cwd(), 'logs', app.id)
      await fs.mkdir(logDir, { recursive: true })
      await fs.appendFile(path.join(logDir, 'app.log'), `[${new Date().toISOString()}] [INSTALL WARN] ${errorMsg}\n${stderrOutput}\n`)
      await createAuditLog(app.id, 'install', 'failed', `Auto-install warning for "${app.name}": ${errorMsg} (continuing with start)`)
    }
  }

  // Update status to STARTING
  await db.application.update({
    where: { id: app.id },
    data: { status: 'STARTING', lastStartedAt: new Date() },
  })

  try {
    const response = await fetch(`${PROCESS_MANAGER_URL}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: app.id,
        cmd: app.startCmd,
        cwd: app.storagePath,
        env,
        port: app.port,
      }),
    })

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      const errorMsg = (result as Record<string, unknown>).error as string || `Process manager returned status ${response.status}`
      await db.application.update({
        where: { id: app.id },
        data: { status: 'FAILED', lastFailedAt: new Date(), lastError: errorMsg },
      })
      await createAuditLog(app.id, 'start', 'failed', errorMsg)
      return err('START_FAILED', `Failed to start application: ${errorMsg}`)
    }

    await db.application.update({
      where: { id: app.id },
      data: { status: 'RUNNING' },
    })
    await createAuditLog(app.id, 'start', 'success', `Started application "${app.name}"`)
    return ok({ status: 'RUNNING', message: 'Application started successfully' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Process manager is unreachable'
    await db.application.update({
      where: { id: app.id },
      data: { status: 'FAILED', lastFailedAt: new Date(), lastError: msg },
    })
    await createAuditLog(app.id, 'start', 'failed', msg)
    return err('SERVICE_UNREACHABLE', `Process manager is not available: ${msg}`, undefined, 'Ensure the process manager service is running on port 3003')
  }
}

async function handleStop(app: any) {
  try {
    await fetch(`${PROCESS_MANAGER_URL}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: app.id }),
    })
  } catch {
    // Process manager might not be running
  }

  await db.application.update({
    where: { id: app.id },
    data: { status: 'STOPPED', lastStoppedAt: new Date() },
  })
  await createAuditLog(app.id, 'stop', 'success', `Stopped application "${app.name}"`)
  return ok({ status: 'STOPPED', message: 'Application stopped successfully' })
}

async function handleRestart(app: any) {
  if (!app.startCmd) {
    await db.application.update({
      where: { id: app.id },
      data: { status: 'FAILED', lastFailedAt: new Date(), lastError: 'No start command configured' },
    })
    await createAuditLog(app.id, 'restart', 'failed', 'Cannot restart: no start command configured')
    return err('CONFIG_ERROR', 'No start command configured for this application', undefined, 'Set a start command in the application settings before restarting')
  }

  const env: Record<string, string> = {}
  for (const ev of app.envVars) {
    env[ev.key] = ev.value
  }

  await db.application.update({
    where: { id: app.id },
    data: { status: 'RESTARTING' },
  })

  try {
    const response = await fetch(`${PROCESS_MANAGER_URL}/restart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: app.id,
        cmd: app.startCmd,
        cwd: app.storagePath,
        env,
        port: app.port,
      }),
    })

    if (!response.ok) {
      const result = await response.json().catch(() => ({}))
      const errorMsg = (result as Record<string, unknown>).error as string || `Process manager returned status ${response.status}`
      await db.application.update({
        where: { id: app.id },
        data: { status: 'FAILED', lastFailedAt: new Date(), lastError: errorMsg },
      })
      await createAuditLog(app.id, 'restart', 'failed', errorMsg)
      return err('RESTART_FAILED', `Failed to restart application: ${errorMsg}`)
    }

    await db.application.update({
      where: { id: app.id },
      data: { status: 'RUNNING', lastStartedAt: new Date() },
    })
    await createAuditLog(app.id, 'restart', 'success', `Restarted application "${app.name}"`)
    return ok({ status: 'RUNNING', message: 'Application restarted successfully' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Process manager is unreachable'
    await db.application.update({
      where: { id: app.id },
      data: { status: 'FAILED', lastFailedAt: new Date(), lastError: msg },
    })
    await createAuditLog(app.id, 'restart', 'failed', msg)
    return err('SERVICE_UNREACHABLE', `Process manager is not available: ${msg}`)
  }
}

async function handleRebuild(app: any) {
  // Set status to REBUILDING
  await db.application.update({
    where: { id: app.id },
    data: { status: 'REBUILDING' },
  })
  await createAuditLog(app.id, 'rebuild', 'success', `Started rebuild for "${app.name}"`)

  // Stop if running
  try {
    await fetch(`${PROCESS_MANAGER_URL}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: app.id }),
    })
  } catch {
    // Ignore if process manager is not running
  }

  // Run install command if available
  if (app.installCmd) {
    try {
      const env: Record<string, string> = {}
      for (const ev of app.envVars) {
        if (ev.scope === 'all' || ev.scope === 'build') env[ev.key] = ev.value
      }

      await db.application.update({
        where: { id: app.id },
        data: { status: 'INSTALLING' },
      })

      const { stdout, stderr } = await execAsync(app.installCmd, {
        cwd: app.storagePath,
        env: { ...process.env, ...env },
        timeout: 300000, // 5 minute timeout
      })

      // Log install output
      const logDir = path.join(process.cwd(), 'logs', app.id)
      await fs.mkdir(logDir, { recursive: true })
      await fs.appendFile(path.join(logDir, 'install.log'), `[${new Date().toISOString()}] ${stdout}\n${stderr}\n`)
    } catch (installError: unknown) {
      const installErr = installError as { message?: string; stderr?: string }
      const errorMsg = installErr?.message || 'Install command failed'
      await db.application.update({
        where: { id: app.id },
        data: { status: 'FAILED', lastFailedAt: new Date(), lastError: errorMsg },
      })
      await createAuditLog(app.id, 'rebuild', 'failed', `Rebuild failed during install: ${errorMsg}`)
      return err('BUILD_FAILED', `Install command failed during rebuild: ${errorMsg}`, undefined, 'Check the install command and logs for details')
    }
  }

  // Start the app
  if (app.startCmd) {
    const env: Record<string, string> = {}
    for (const ev of app.envVars) {
      env[ev.key] = ev.value
    }

    try {
      await db.application.update({
        where: { id: app.id },
        data: { status: 'STARTING' },
      })

      const response = await fetch(`${PROCESS_MANAGER_URL}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: app.id,
          cmd: app.startCmd,
          cwd: app.storagePath,
          env,
          port: app.port,
        }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        const errorMsg = (result as Record<string, unknown>).error as string || `Process manager returned status ${response.status}`
        await db.application.update({
          where: { id: app.id },
          data: { status: 'FAILED', lastFailedAt: new Date(), lastError: errorMsg },
        })
        await createAuditLog(app.id, 'rebuild', 'failed', `Rebuild failed during start: ${errorMsg}`)
        return err('START_FAILED', `Failed to start after rebuild: ${errorMsg}`)
      }

      await db.application.update({
        where: { id: app.id },
        data: { status: 'RUNNING', lastStartedAt: new Date() },
      })
      await createAuditLog(app.id, 'rebuild', 'success', `Rebuild completed for "${app.name}"`)
      return ok({ status: 'RUNNING', message: 'Application rebuilt and started successfully' })
    } catch {
      await db.application.update({
        where: { id: app.id },
        data: { status: 'STOPPED' },
      })
      await createAuditLog(app.id, 'rebuild', 'success', `Rebuild completed (not started: process manager unavailable) for "${app.name}"`)
      return ok({ status: 'STOPPED', message: 'Application rebuilt successfully. Start it manually.' })
    }
  }

  // No start command, just leave it stopped
  await db.application.update({
    where: { id: app.id },
    data: { status: 'STOPPED' },
  })
  await createAuditLog(app.id, 'rebuild', 'success', `Rebuild completed for "${app.name}" (no start command)`)
  return ok({ status: 'STOPPED', message: 'Application rebuilt successfully. No start command configured.' })
}

async function handleInstall(app: any) {
  if (!app.installCmd) {
    await db.application.update({
      where: { id: app.id },
      data: { status: 'FAILED', lastFailedAt: new Date(), lastError: 'No install command configured' },
    })
    await createAuditLog(app.id, 'install', 'failed', 'No install command configured')
    return err('CONFIG_ERROR', 'No install command configured', undefined, 'Set an install command (e.g., "pip install -r requirements.txt") in the application settings')
  }

  try {
    sanitizeCommand(app.installCmd)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
  }

  await db.application.update({
    where: { id: app.id },
    data: { status: 'INSTALLING' },
  })

  const env: Record<string, string> = {}
  for (const ev of app.envVars) {
    if (ev.scope === 'all' || ev.scope === 'build') env[ev.key] = ev.value
  }

  try {
    const { stdout, stderr } = await execAsync(app.installCmd, {
      cwd: app.storagePath,
      env: { ...process.env, ...env },
      timeout: 300000,
    })

    // Log install output
    const logDir = path.join(process.cwd(), 'logs', app.id)
    await fs.mkdir(logDir, { recursive: true })
    await fs.appendFile(path.join(logDir, 'install.log'), `[${new Date().toISOString()}] ${stdout}\n${stderr}\n`)

    await db.application.update({
      where: { id: app.id },
      data: { status: 'STOPPED' },
    })
    await createAuditLog(app.id, 'install', 'success', `Dependencies installed for "${app.name}"`)
    return ok({ status: 'STOPPED', output: stdout, errors: stderr, message: 'Dependencies installed successfully' })
  } catch (installError: unknown) {
    const installErr = installError as { message?: string; stderr?: string }
    const errorMsg = installErr?.message || 'Install command failed'
    const stderrOutput = installErr?.stderr || ''

    // Log the error
    const logDir = path.join(process.cwd(), 'logs', app.id)
    await fs.mkdir(logDir, { recursive: true })
    await fs.appendFile(path.join(logDir, 'install.log'), `[${new Date().toISOString()}] ERROR: ${errorMsg}\n${stderrOutput}\n`)

    await db.application.update({
      where: { id: app.id },
      data: { status: 'FAILED', lastFailedAt: new Date(), lastError: errorMsg },
    })
    await createAuditLog(app.id, 'install', 'failed', `Install failed for "${app.name}": ${errorMsg}`)
    return err('INSTALL_FAILED', `Install command failed: ${errorMsg}`, stderrOutput, 'Check the install command and dependencies')
  }
}

async function createAuditLog(appId: string, action: string, status: string, details: string) {
  try {
    await db.auditLog.create({
      data: { appId, action, resource: 'application', details, status },
    })
  } catch {
    // Best effort audit logging
  }
}