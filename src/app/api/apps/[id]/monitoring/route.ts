import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError } from '@/lib/utils/security'
import { getDirectorySizeSync } from '@/lib/utils/files'
import type { AppStats } from '@/lib/types'

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

// GET /api/apps/[id]/monitoring - Get app metrics
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

    const stats: AppStats = {
      cpu: 0,
      memory: 0,
      diskUsage: 0,
      uptime: 0,
      restartCount: app.currentRestartCount,
      healthStatus: 'unknown',
      lastError: app.lastError,
      lastActivity: app.updatedAt?.toISOString() || null,
    }

    // Get disk usage
    stats.diskUsage = getDirectorySizeSync(app.storagePath)

    // Try to get process info from process-manager
    try {
      const response = await fetch(`${PROCESS_MANAGER_URL}/status/${id}`, {
        signal: AbortSignal.timeout(3000),
      })

      if (response.ok) {
        const processInfo = (await response.json()) as {
          pid?: number
          status?: string
          cpu?: number
          memory?: number
          uptime?: number
          restartCount?: number
          lastError?: string | null
          exitCode?: number | null
        }

        stats.cpu = processInfo.cpu || 0
        stats.memory = processInfo.memory || 0
        stats.uptime = processInfo.uptime || 0
        stats.restartCount = processInfo.restartCount ?? app.currentRestartCount
        stats.lastError = processInfo.lastError ?? app.lastError

        if (processInfo.status === 'running') {
          stats.healthStatus = 'healthy'
        } else if (processInfo.status === 'crashed') {
          stats.healthStatus = 'unhealthy'
          stats.lastError = stats.lastError || `Process crashed with exit code ${processInfo.exitCode ?? 'unknown'}`
        } else if (processInfo.status === 'stopped') {
          stats.healthStatus = 'unknown'
        }
      }
    } catch {
      // Process manager not available - use DB info
      if (app.status === 'RUNNING') {
        stats.healthStatus = 'unknown'
      } else if (app.status === 'CRASHED' || app.status === 'FAILED') {
        stats.healthStatus = 'unhealthy'
      }
    }

    // Compute uptime from DB if process manager is unavailable
    if (stats.uptime === 0 && app.lastStartedAt) {
      if (app.status === 'RUNNING') {
        stats.uptime = Math.floor((Date.now() - app.lastStartedAt.getTime()) / 1000)
      }
    }

    return ok(stats)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to get monitoring data:', error)
    return err('INTERNAL_ERROR', 'Failed to get application metrics', undefined, undefined, 500)
  }
}