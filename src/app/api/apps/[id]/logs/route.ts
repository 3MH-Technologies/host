import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError } from '@/lib/utils/security'
import { MAX_LOG_LINES_STREAM } from '@/lib/constants'
import fs from 'fs/promises'
import path from 'path'

const LOGS_DIR = path.join(process.cwd(), 'logs')

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data })
}

function err(code: string, message: string, details?: string, actionable?: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details, actionable } },
    { status }
  )
}

const VALID_SOURCES = ['app', 'system', 'build', 'install']

// GET /api/apps/[id]/logs?tail=100&source=app
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const tail = Math.min(MAX_LOG_LINES_STREAM, Math.max(1, parseInt(searchParams.get('tail') || '100', 10)))
    const source = searchParams.get('source') || 'app'

    if (!VALID_SOURCES.includes(source)) {
      return err('VALIDATION_ERROR', `Invalid log source: ${source}. Must be one of: ${VALID_SOURCES.join(', ')}`)
    }

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const logFile = path.join(LOGS_DIR, id, `${source}.log`)

    let content: string
    try {
      content = await fs.readFile(logFile, 'utf-8')
    } catch {
      return ok({ lines: [], source, total: 0, message: 'No logs available yet' })
    }

    const allLines = content.split('\n').filter(line => line.trim().length > 0)
    const total = allLines.length
    const lines = allLines.slice(-tail)

    const parsedLines = lines.map((line, index) => {
      try {
        const parsed = JSON.parse(line)
        return {
          index: total - tail + index + 1,
          timestamp: parsed.timestamp || new Date().toISOString(),
          level: parsed.level || 'info',
          message: parsed.message || line,
          source: parsed.source || source,
        }
      } catch {
        return {
          index: total - tail + index + 1,
          timestamp: new Date().toISOString(),
          level: 'info' as const,
          message: line,
          source,
        }
      }
    })

    return ok({ lines: parsedLines, source, total, returned: parsedLines.length })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to get logs:', error)
    return err('INTERNAL_ERROR', 'Failed to read logs', undefined, undefined, 500)
  }
}

// DELETE /api/apps/[id]/logs?source=app
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source') || 'app'

    if (!VALID_SOURCES.includes(source)) {
      return err('VALIDATION_ERROR', `Invalid log source: ${source}. Must be one of: ${VALID_SOURCES.join(', ')}`)
    }

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const logFile = path.join(LOGS_DIR, id, `${source}.log`)

    try {
      await fs.writeFile(logFile, '', 'utf-8')
    } catch {
      // File might not exist
    }

    try {
      await db.auditLog.create({
        data: { appId: id, action: 'clear_logs', resource: 'logs', details: `Cleared ${source} logs`, status: 'success' },
      })
    } catch {
      // Best effort
    }

    return ok({ cleared: true, source })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to clear logs:', error)
    return err('INTERNAL_ERROR', 'Failed to clear logs', undefined, undefined, 500)
  }
}