import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError } from '@/lib/utils/security'

function ok<T>(data: T, meta?: { page: number; limit: number; total: number }): NextResponse {
  return NextResponse.json({ success: true, data, meta })
}

function err(code: string, message: string, details?: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status }
  )
}

// GET /api/audit?page=1&limit=50&action=create_app&appId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
    const action = searchParams.get('action')
    const appId = searchParams.get('appId')

    // Build where clause
    const where: Record<string, unknown> = {}
    if (action) {
      where.action = action
    }
    if (appId) {
      where.appId = appId
    }

    const [logs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          app: {
            select: { id: true, name: true, slug: true },
          },
        },
      }),
      db.auditLog.count({ where }),
    ])

    return ok(logs, { page, limit, total })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, 403)
    }
    console.error('Failed to list audit logs:', error)
    return err('INTERNAL_ERROR', 'Failed to list audit logs', undefined, 500)
  }
}