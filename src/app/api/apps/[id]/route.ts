import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError } from '@/lib/utils/security'
import { getDirectorySizeSync } from '@/lib/utils/files'
import { APP_STATUS, ACTIVE_STATES, TRANSITIONS, type ApiResponse, type AppStatus } from '@/lib/types'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'

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

// GET /api/apps/[id] - Get app details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const app = await db.application.findUnique({
      where: { id },
      include: {
        envVars: {
          select: { id: true, key: true, isSecret: true },
        },
        _count: {
          select: { backups: true, schedules: true, auditLogs: true },
        },
      },
    })

    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, 'Check the application ID and try again', 404)
    }

    // Compute disk usage
    let diskUsage = 0
    try {
      diskUsage = getDirectorySizeSync(app.storagePath)
    } catch {
      // Directory might not exist yet
    }

    const result = {
      ...app,
      envVarCount: app.envVars.length,
      diskUsage,
    }

    return ok(result)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to get app:', error)
    return err('INTERNAL_ERROR', 'Failed to get application details', undefined, undefined, 500)
  }
}

// PUT /api/apps/[id] - Update app settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, 'Check the application ID and try again', 404)
    }

    // Prevent updates while app is in a transient state
    const transientStates = ['PREPARING', 'INSTALLING', 'STARTING', 'STOPPING', 'RESTARTING', 'REBUILDING', 'DELETING']
    if (transientStates.includes(app.status)) {
      return err('INVALID_STATE', `Cannot update application while it is ${app.status}`, `Current status: ${app.status}. Wait for the operation to complete or stop the application first.`, 'Wait for the current operation to complete before making changes')
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {}

    const updatableFields = [
      'name', 'description', 'appType', 'runtime', 'runtimeVersion',
      'entryPoint', 'workingDir', 'installCmd', 'buildCmd', 'startCmd',
      'stopCmd', 'restartCmd', 'healthCheckCmd', 'healthCheckType',
      'healthCheckPath', 'healthCheckInterval', 'healthCheckTimeout',
      'healthCheckRetries', 'restartPolicy', 'maxRestartAttempts',
      'restartDelay', 'restartBackoff', 'cpuLimit', 'memoryLimit',
      'diskLimit', 'maxProcesses',
    ]

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Handle port specifically (can be null to clear it)
    if (body.port !== undefined) {
      updateData.port = body.port === null ? null : Number(body.port)
    }

    // Validate name uniqueness if changing
    if (body.name && body.name !== app.name) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return err('VALIDATION_ERROR', 'Application name cannot be empty')
      }
      if (body.name.length > 100) {
        return err('VALIDATION_ERROR', 'Application name must be less than 100 characters')
      }
    }

    // Validate port range
    if (body.port !== undefined && body.port !== null) {
      const port = Number(body.port)
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        return err('VALIDATION_ERROR', `Invalid port: ${body.port}. Must be between 1024 and 65535`)
      }
    }

    if (Object.keys(updateData).length === 0) {
      return err('VALIDATION_ERROR', 'No valid fields to update')
    }

    // Update the app
    const updatedApp = await db.application.update({
      where: { id },
      data: updateData,
    })

    // Audit log
    const changedFields = Object.keys(updateData).join(', ')
    await db.auditLog.create({
      data: {
        appId: id,
        action: 'update_app',
        resource: 'application',
        details: `Updated application "${app.name}": ${changedFields}`,
        status: 'success',
      },
    })

    return ok(updatedApp)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    if (error instanceof SyntaxError) {
      return err('INVALID_JSON', 'Request body contains invalid JSON')
    }
    console.error('Failed to update app:', error)
    return err('INTERNAL_ERROR', 'Failed to update application', undefined, undefined, 500)
  }
}

// DELETE /api/apps/[id] - Delete app
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    // Check if app is running
    if (ACTIVE_STATES.includes(app.status as AppStatus)) {
      // Try to stop the process via process-manager
      try {
        await fetch(`http://localhost:3003/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: id }),
        })
      } catch {
        // Process manager might not be running, continue with deletion
      }
      // Update status
      await db.application.update({
        where: { id },
        data: { status: 'DELETING' },
      })
    }

    // Delete storage directory
    try {
      await fs.rm(app.storagePath, { recursive: true, force: true })
    } catch {
      // Directory might not exist
    }

    // Delete from database (cascade handles env vars, backups, schedules, audit logs)
    await db.application.delete({ where: { id } })

    // Audit log (create after deletion since cascade removes app relation)
    await db.auditLog.create({
      data: {
        action: 'delete_app',
        resource: 'application',
        details: `Deleted application "${app.name}" (${app.slug})`,
        status: 'success',
      },
    })

    return ok({ deleted: true, name: app.name, slug: app.slug })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to delete app:', error)
    return err('INTERNAL_ERROR', 'Failed to delete application', undefined, undefined, 500)
  }
}