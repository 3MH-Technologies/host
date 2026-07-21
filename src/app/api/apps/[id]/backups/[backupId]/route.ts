import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError, maskSecret } from '@/lib/utils/security'
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

// POST /api/apps/[id]/backups/[backupId]/restore - Restore from backup
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  try {
    const { id, backupId } = await params

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const backup = await db.backup.findFirst({ where: { id: backupId, appId: id } })
    if (!backup) {
      return err('NOT_FOUND', `Backup "${backupId}" not found for this application`, undefined, undefined, 404)
    }

    if (!backup.filePath) {
      return err('INVALID_STATE', 'Backup file path is missing. The backup may not have completed successfully.')
    }

    if (backup.status !== 'completed') {
      return err('INVALID_STATE', `Cannot restore from a backup with status "${backup.status}". Only completed backups can be restored.`)
    }

    // Check that backup file exists
    try {
      await fs.access(backup.filePath)
    } catch {
      return err('NOT_FOUND', `Backup file not found on disk: ${backup.filePath}`, undefined, 'The backup file may have been manually deleted. Create a new backup.')
    }

    const tempDir = path.join(BACKUPS_DIR, id, `restore-${backupId}`)

    try {
      // Extract backup to temp dir
      await fs.mkdir(tempDir, { recursive: true })
      await execAsync(`tar -xzf "${backup.filePath}" -C "${tempDir}"`, { timeout: 60000 })

      // Restore files if backup includes them
      const filesDir = path.join(tempDir, 'files')
      try {
        await fs.access(filesDir)
        // Clear existing app directory (except hidden files)
        const entries = await fs.readdir(app.storagePath)
        for (const entry of entries) {
          if (!entry.startsWith('.')) {
            await fs.rm(path.join(app.storagePath, entry), { recursive: true, force: true })
          }
        }
        // Copy restored files
        const restoredEntries = await fs.readdir(filesDir)
        for (const entry of restoredEntries) {
          await execAsync(`cp -r "${path.join(filesDir, entry)}" "${app.storagePath}/"`)
        }
      } catch {
        // No files directory in backup, skip
      }

      // Restore settings if present
      const exportFile = path.join(tempDir, 'export.json')
      try {
        const exportContent = await fs.readFile(exportFile, 'utf-8')
        const exportData = JSON.parse(exportContent)

        if (exportData.settings) {
          const s = exportData.settings
          await db.application.update({
            where: { id },
            data: {
              description: s.description ?? app.description,
              appType: s.appType ?? app.appType,
              runtime: s.runtime ?? app.runtime,
              runtimeVersion: s.runtimeVersion ?? app.runtimeVersion,
              entryPoint: s.entryPoint ?? app.entryPoint,
              workingDir: s.workingDir ?? app.workingDir,
              installCmd: s.installCmd ?? app.installCmd,
              buildCmd: s.buildCmd ?? app.buildCmd,
              startCmd: s.startCmd ?? app.startCmd,
              stopCmd: s.stopCmd ?? app.stopCmd,
              port: s.port ?? app.port,
              host: s.host ?? app.host,
              healthCheckType: s.healthCheckType ?? app.healthCheckType,
              healthCheckPath: s.healthCheckPath ?? app.healthCheckPath,
              healthCheckInterval: s.healthCheckInterval ?? app.healthCheckInterval,
              healthCheckTimeout: s.healthCheckTimeout ?? app.healthCheckTimeout,
              restartPolicy: s.restartPolicy ?? app.restartPolicy,
              maxRestartAttempts: s.maxRestartAttempts ?? app.maxRestartAttempts,
              restartDelay: s.restartDelay ?? app.restartDelay,
              cpuLimit: s.cpuLimit ?? app.cpuLimit,
              memoryLimit: s.memoryLimit ?? app.memoryLimit,
            },
          })
        }

        // Note: Env vars are NOT restored from backup for security reasons
        // The export.json only contains masked values for secrets
        if (exportData.envVars && Array.isArray(exportData.envVars)) {
          // Only restore non-secret env vars
          for (const ev of exportData.envVars) {
            if (!ev.isSecret && ev.value !== '[SECRET]') {
              await db.envVar.upsert({
                where: { appId_key: { appId: id, key: ev.key } },
                update: { value: ev.value, isSecret: false, scope: ev.scope || 'all' },
                create: { appId: id, key: ev.key, value: ev.value, isSecret: false, scope: ev.scope || 'all' },
              })
            }
          }
        }
      } catch {
        // No export.json, skip settings restoration
      }

      // Clean up
      await fs.rm(tempDir, { recursive: true, force: true })

      try {
        await db.auditLog.create({
          data: { appId: id, action: 'restore_backup', resource: 'backup', details: `Restored from backup: ${backup.name}`, status: 'success' },
        })
      } catch { /* best effort */ }

      return ok({ restored: true, backupName: backup.name, note: 'Secret environment variables were not restored for security. Please re-enter them manually.' })
    } catch (error: unknown) {
      const e = error as Error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})

      await db.auditLog.create({
        data: { appId: id, action: 'restore_backup', resource: 'backup', details: `Restore failed from ${backup.name}: ${e.message}`, status: 'failure' },
      }).catch(() => {})

      return err('RESTORE_FAILED', `Failed to restore backup: ${e.message}`)
    }
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Backup restore failed:', error)
    return err('INTERNAL_ERROR', 'Failed to restore backup', undefined, undefined, 500)
  }
}

// DELETE /api/apps/[id]/backups/[backupId] - Delete backup
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; backupId: string }> }
) {
  try {
    const { id, backupId } = await params

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const backup = await db.backup.findFirst({ where: { id: backupId, appId: id } })
    if (!backup) {
      return err('NOT_FOUND', `Backup "${backupId}" not found for this application`, undefined, undefined, 404)
    }

    // Delete backup file
    if (backup.filePath) {
      await fs.unlink(backup.filePath).catch(() => {})
    }

    // Delete from database
    await db.backup.delete({ where: { id: backupId } })

    try {
      await db.auditLog.create({
        data: { appId: id, action: 'delete_backup', resource: 'backup', details: `Deleted backup: ${backup.name}`, status: 'success' },
      })
    } catch { /* best effort */ }

    return ok({ deleted: true, backupName: backup.name })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Backup delete failed:', error)
    return err('INTERNAL_ERROR', 'Failed to delete backup', undefined, undefined, 500)
  }
}