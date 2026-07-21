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
  // Basic check: each part should contain valid cron characters
  const validPart = /^[*\d/,\-]+$/  // Removed 'L' and 'W' for simplicity - these are basic cron parts
  return parts.every(p => validPart.test(p))
}

// GET /api/apps/[id]/schedules - List schedules
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

    const schedules = await db.schedule.findMany({
      where: { appId: id },
      orderBy: { createdAt: 'desc' },
    })

    return ok(schedules)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to list schedules:', error)
    return err('INTERNAL_ERROR', 'Failed to list schedules', undefined, undefined, 500)
  }
}

// POST /api/apps/[id]/schedules - Create schedule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return err('VALIDATION_ERROR', 'Schedule name is required')
    }

    const validActions = ['run_command', 'start_app', 'stop_app', 'restart_app']
    if (!body.action || !validActions.includes(body.action)) {
      return err('VALIDATION_ERROR', `Invalid action: ${body.action || 'none'}. Must be one of: ${validActions.join(', ')}`)
    }

    if (body.action === 'run_command' && (!body.command || typeof body.command !== 'string')) {
      return err('VALIDATION_ERROR', 'Command is required when action is "run_command"')
    }

    if (body.cronExpr) {
      if (!validateCronExpr(body.cronExpr)) {
        return err('VALIDATION_ERROR', 'Invalid cron expression. Expected format: "minute hour day month weekday" (e.g., "*/5 * * * *")')
      }
    }

    const validKinds = ['cron', 'fixed_rate', 'one_time']
    const cronKind = validKinds.includes(body.cronKind) ? body.cronKind : 'cron'

    // Check for duplicate name
    const existing = await db.schedule.findFirst({
      where: { appId: id, name: body.name.trim() },
    })
    if (existing) {
      return err('CONFLICT', `A schedule with name "${body.name}" already exists for this application`)
    }

    const schedule = await db.schedule.create({
      data: {
        appId: id,
        name: body.name.trim(),
        action: body.action,
        command: body.command || null,
        cronExpr: body.cronExpr || null,
        cronKind,
        cronTz: body.cronTz || 'Asia/Riyadh',
        enabled: body.enabled !== false,
      },
    })

    try {
      await db.auditLog.create({
        data: { appId: id, action: 'create_schedule', resource: 'schedule', details: `Created schedule: ${schedule.name} (${schedule.action})`, status: 'success' },
      })
    } catch { /* best effort */ }

    return ok(schedule)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    if (error instanceof SyntaxError) {
      return err('INVALID_JSON', 'Request body contains invalid JSON')
    }
    console.error('Failed to create schedule:', error)
    return err('INTERNAL_ERROR', 'Failed to create schedule', undefined, undefined, 500)
  }
}