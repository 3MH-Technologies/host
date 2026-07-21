import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError } from '@/lib/utils/security'

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data })
}

function err(code: string, message: string, details?: string, actionable?: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details, actionable } },
    { status }
  )
}

// Basic cron expression validation
function validateCronExpr(expr: string): boolean {
  if (!expr || typeof expr !== 'string') return false
  const parts = expr.trim().split(/\s+/)
  if (parts.length < 5 || parts.length > 6) return false
  const validPart = /^[*\d/,\-]+$/
  return parts.every(p => validPart.test(p))
}

// PUT /api/apps/[id]/schedules/[sid] - Update schedule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  try {
    const { id, sid } = await params
    const body = await request.json()

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const schedule = await db.schedule.findFirst({ where: { id: sid, appId: id } })
    if (!schedule) {
      return err('NOT_FOUND', `Schedule "${sid}" not found for this application`, undefined, undefined, 404)
    }

    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return err('VALIDATION_ERROR', 'Schedule name cannot be empty')
      }
      updateData.name = body.name.trim()
    }

    if (body.action !== undefined) {
      const validActions = ['run_command', 'start_app', 'stop_app', 'restart_app']
      if (!validActions.includes(body.action)) {
        return err('VALIDATION_ERROR', `Invalid action: ${body.action}. Must be one of: ${validActions.join(', ')}`)
      }
      updateData.action = body.action
    }

    if (body.command !== undefined) {
      updateData.command = body.command
    }

    if (body.cronExpr !== undefined) {
      if (body.cronExpr !== null && !validateCronExpr(body.cronExpr)) {
        return err('VALIDATION_ERROR', 'Invalid cron expression')
      }
      updateData.cronExpr = body.cronExpr
    }

    if (body.cronKind !== undefined) {
      const validKinds = ['cron', 'fixed_rate', 'one_time']
      if (!validKinds.includes(body.cronKind)) {
        return err('VALIDATION_ERROR', `Invalid cron kind: ${body.cronKind}`)
      }
      updateData.cronKind = body.cronKind
    }

    if (body.enabled !== undefined) {
      updateData.enabled = !!body.enabled
    }

    if (body.cronTz !== undefined) {
      updateData.cronTz = body.cronTz
    }

    if (Object.keys(updateData).length === 0) {
      return err('VALIDATION_ERROR', 'No valid fields to update')
    }

    const updated = await db.schedule.update({
      where: { id: sid },
      data: updateData,
    })

    try {
      await db.auditLog.create({
        data: { appId: id, action: 'update_schedule', resource: 'schedule', details: `Updated schedule: ${schedule.name}`, status: 'success' },
      })
    } catch { /* best effort */ }

    return ok(updated)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    if (error instanceof SyntaxError) {
      return err('INVALID_JSON', 'Request body contains invalid JSON')
    }
    console.error('Failed to update schedule:', error)
    return err('INTERNAL_ERROR', 'Failed to update schedule', undefined, undefined, 500)
  }
}

// DELETE /api/apps/[id]/schedules/[sid] - Delete schedule
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sid: string }> }
) {
  try {
    const { id, sid } = await params

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const schedule = await db.schedule.findFirst({ where: { id: sid, appId: id } })
    if (!schedule) {
      return err('NOT_FOUND', `Schedule "${sid}" not found for this application`, undefined, undefined, 404)
    }

    await db.schedule.delete({ where: { id: sid } })

    try {
      await db.auditLog.create({
        data: { appId: id, action: 'delete_schedule', resource: 'schedule', details: `Deleted schedule: ${schedule.name}`, status: 'success' },
      })
    } catch { /* best effort */ }

    return ok({ deleted: true, name: schedule.name })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to delete schedule:', error)
    return err('INTERNAL_ERROR', 'Failed to delete schedule', undefined, undefined, 500)
  }
}