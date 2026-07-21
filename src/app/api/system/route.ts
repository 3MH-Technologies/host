import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError } from '@/lib/utils/security'
import { getDirectorySizeSync } from '@/lib/utils/files'
import type { SystemStats } from '@/lib/types'

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data })
}

function err(code: string, message: string, details?: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status }
  )
}

const PROCESS_MANAGER_URL = 'http://localhost:3003'
const TERMINAL_SERVICE_URL = 'http://localhost:3004'

// GET /api/system/stats - System-wide statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'health') {
      return handleHealthCheck()
    }

    return handleStats()
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, 403)
    }
    console.error('System stats failed:', error)
    return err('INTERNAL_ERROR', 'Failed to get system statistics', undefined, 500)
  }
}

async function handleStats() {
  // Count apps by status
  const appsByStatus = await db.application.groupBy({
    by: ['status'],
    _count: true,
  })

  const statusCounts: Record<string, number> = {}
  for (const item of appsByStatus) {
    statusCounts[item.status] = item._count
  }

  const totalApps = await db.application.count()

  // Get total disk usage across all apps
  const apps = await db.application.findMany({
    select: { storagePath: true },
  })

  let totalDisk = 0
  for (const app of apps) {
    totalDisk += getDirectorySizeSync(app.storagePath)
  }

  // Get recent audit logs
  const recentLogs = await db.auditLog.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: { id: true, action: true, details: true, status: true, createdAt: true },
  })

  // Get recent notifications
  const recentNotifications = await db.notification.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    where: { read: false },
    select: { id: true, type: true, title: true, level: true, createdAt: true },
  })

  // Collect process stats from process manager
  let processStats: { total: number; running: number } = { total: 0, running: 0 }
  try {
    const response = await fetch(`${PROCESS_MANAGER_URL}/all`, {
      signal: AbortSignal.timeout(3000),
    })
    if (response.ok) {
      const data = (await response.json()) as unknown[]
      processStats = { total: data.length, running: data.filter((p: unknown) => (p as Record<string, string>).status === 'running').length }
    }
  } catch {
    // Process manager not available
  }

  const stats: SystemStats & {
    statusCounts: Record<string, number>
    recentLogs: typeof recentLogs
    recentNotifications: typeof recentNotifications
    processStats: typeof processStats
  } = {
    totalApps,
    runningApps: statusCounts['RUNNING'] || 0,
    stoppedApps: statusCounts['STOPPED'] || 0,
    failedApps: (statusCounts['FAILED'] || 0) + (statusCounts['CRASHED'] || 0),
    totalCpu: 0,
    totalMemory: 0,
    totalDisk: 0,
    usedDisk: totalDisk,
    statusCounts,
    recentLogs,
    recentNotifications,
    processStats,
  }

  return ok(stats)
}

async function handleHealthCheck() {
  const checks: { service: string; status: 'healthy' | 'unhealthy'; latency: number; error?: string }[] = []

  // Check database
  const dbStart = Date.now()
  try {
    await db.application.count()
    checks.push({ service: 'database', status: 'healthy', latency: Date.now() - dbStart })
  } catch (error: unknown) {
    checks.push({ service: 'database', status: 'unhealthy', latency: Date.now() - dbStart, error: error instanceof Error ? error.message : 'Unknown error' })
  }

  // Check process manager
  const pmStart = Date.now()
  try {
    const response = await fetch(`${PROCESS_MANAGER_URL}/all`, {
      signal: AbortSignal.timeout(3000),
    })
    checks.push({ service: 'process-manager', status: response.ok ? 'healthy' : 'unhealthy', latency: Date.now() - pmStart, error: response.ok ? undefined : `HTTP ${response.status}` })
  } catch (error: unknown) {
    checks.push({ service: 'process-manager', status: 'unhealthy', latency: Date.now() - pmStart, error: error instanceof Error ? error.message : 'Not reachable' })
  }

  // Check terminal service
  const tsStart = Date.now()
  try {
    const response = await fetch(`${TERMINAL_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    checks.push({ service: 'terminal-service', status: response.ok ? 'healthy' : 'unhealthy', latency: Date.now() - tsStart, error: response.ok ? undefined : `HTTP ${response.status}` })
  } catch (error: unknown) {
    checks.push({ service: 'terminal-service', status: 'unhealthy', latency: Date.now() - tsStart, error: error instanceof Error ? error.message : 'Not reachable' })
  }

  const allHealthy = checks.every(c => c.status === 'healthy')

  return ok({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  })
}