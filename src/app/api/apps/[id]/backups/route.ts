import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError } from '@/lib/utils/security'
import { MAX_FILE_SIZE } from '@/lib/constants'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)
const BACKUPS_DIR = path.join(process.cwd(), 'backups')

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data })
}

function err(code: string, message: string, details?: string, actionable?: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details, actionable } },
    { status }
  )
}

// GET /api/apps/[id]/backups - List backups
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const backups = await db.backup.findMany({
      where: { appId: id },
      orderBy: { createdAt: 'desc' },
    })

    return ok(backups)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to list backups:', error)
    return err('INTERNAL_ERROR', 'Failed to list backups', undefined, undefined, 500)
  }
}

// POST /api/apps/[id]/backups - Create backup
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const app = await db.application.findUnique({
      where: { id },
      include: { envVars: true },
    })

    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const name = body.name || `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`
    const includeFiles = body.includeFiles !== false
    const includeEnv = body.includeEnv !== false
    const includeSettings = body.includeSettings !== false

    // Create backup directory
    const backupDir = path.join(BACKUPS_DIR, id)
    await fs.mkdir(backupDir, { recursive: true })

    // Create backup record
    const backup = await db.backup.create({
      data: {
        appId: id,
        name,
        includeFiles,
        includeEnv,
        includeSettings,
        status: 'creating',
      },
    })

    const backupFilePath = path.join(backupDir, `${backup.id}.tar.gz`)
    const tempDir = path.join(backupDir, `temp-${backup.id}`)

    try {
      await fs.mkdir(tempDir, { recursive: true })

      // Copy files if requested
      if (includeFiles) {
        const filesDir = path.join(tempDir, 'files')
        await fs.mkdir(filesDir, { recursive: true })
        try {
          await execAsync(`cp -r "${app.storagePath}/." "${filesDir}/"`)
        } catch {
          // App directory might be empty or not exist
        }
      }

      // Export settings if requested
      if (includeSettings || includeEnv) {
        const exportData: Record<string, unknown> = {}
        if (includeSettings) {
          exportData.settings = {
            name: app.name,
            description: app.description,
            appType: app.appType,
            runtime: app.runtime,
            runtimeVersion: app.runtimeVersion,
            entryPoint: app.entryPoint,
            workingDir: app.workingDir,
            installCmd: app.installCmd,
            buildCmd: app.buildCmd,
            startCmd: app.startCmd,
            stopCmd: app.stopCmd,
            port: app.port,
            host: app.host,
            healthCheckType: app.healthCheckType,
            healthCheckPath: app.healthCheckPath,
            healthCheckInterval: app.healthCheckInterval,
            healthCheckTimeout: app.healthCheckTimeout,
            restartPolicy: app.restartPolicy,
            maxRestartAttempts: app.maxRestartAttempts,
            restartDelay: app.restartDelay,
            cpuLimit: app.cpuLimit,
            memoryLimit: app.memoryLimit,
          }
        }
        if (includeEnv) {
          exportData.envVars = app.envVars.map(ev => ({
            key: ev.key,
            value: ev.isSecret ? '[SECRET]' : ev.value,
            isSecret: ev.isSecret,
            scope: ev.scope,
          }))
        }
        await fs.writeFile(path.join(tempDir, 'export.json'), JSON.stringify(exportData, null, 2))
      }

      // Create tar.gz
      await execAsync(`tar -czf "${backupFilePath}" -C "${tempDir}" .`, { timeout: 120000 })

      // Get file size
      const stat = await fs.stat(backupFilePath)

      // Update backup record
      await db.backup.update({
        where: { id: backup.id },
        data: { status: 'completed', filePath: backupFilePath, fileSize: stat.size },
      })

      // Clean up temp dir
      await fs.rm(tempDir, { recursive: true, force: true })

      try {
        await db.auditLog.create({
          data: { appId: id, action: 'create_backup', resource: 'backup', details: `Created backup: ${name} (${(stat.size / 1024).toFixed(1)}KB)`, status: 'success' },
        })
      } catch { /* best effort */ }

      const updatedBackup = await db.backup.findUnique({ where: { id: backup.id } })
      return ok(updatedBackup)
    } catch (error: unknown) {
      const e = error as Error
      // Clean up on failure
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
      await fs.unlink(backupFilePath).catch(() => {})

      await db.backup.update({
        where: { id: backup.id },
        data: { status: 'failed' },
      })

      await db.auditLog.create({
        data: { appId: id, action: 'create_backup', resource: 'backup', details: `Backup failed: ${name} - ${e.message}`, status: 'failure' },
      }).catch(() => {})

      return err('BACKUP_FAILED', `Failed to create backup: ${e.message}`, undefined, 'Check available disk space and file permissions')
    }
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    if (error instanceof SyntaxError) {
      return err('INVALID_JSON', 'Request body contains invalid JSON')
    }
    console.error('Backup creation failed:', error)
    return err('INTERNAL_ERROR', 'Failed to create backup', undefined, undefined, 500)
  }
}