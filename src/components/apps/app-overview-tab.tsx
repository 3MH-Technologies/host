'use client'

import { useState, useEffect, useRef } from 'react'
import { useMonitoring, useLogs, useLifecycleAction } from '@/hooks/use-api'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Play, Square, RotateCcw, Hammer, Clock, AlertCircle, Activity, Cpu, MemoryStick, HardDrive } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Application } from '@prisma/client'
import { ACTIVE_STATES, TRANSIENT_STATES, APP_STATUS } from '@/lib/types'
import { toast } from 'sonner'

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

function ResourceGauge({ label, value, max, unit, icon: Icon }: { label: string; value: number; max: number; unit: string; icon: React.ElementType }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <Card className="p-4 gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-2xl font-bold">{value.toFixed(1)}<span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span></div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% of {max}{unit}</p>
    </Card>
  )
}

interface Props {
  app: Application
}

export function AppOverviewTab({ app }: Props) {
  const { data: monitoringData, isLoading: monLoading } = useMonitoring(app.id)
  const { data: logsData, isLoading: logsLoading } = useLogs(app.id, 'app', 10)
  const { data: errorData, isLoading: errLoading } = useLogs(app.id, 'app', 5)
  const lifecycle = useLifecycleAction()

  const stats = monitoringData?.data
  const logs = Array.isArray(logsData?.data) ? logsData.data : []
  const isTransient = TRANSIENT_STATES.includes(app.status)
  const isActive = ACTIVE_STATES.includes(app.status)

  const [uptime, setUptime] = useState(0)
  const baseUptime = useRef(0)
  const baseTime = useRef(Date.now())

  useEffect(() => {
    if (stats?.uptime != null) {
      baseUptime.current = stats.uptime
      baseTime.current = Date.now()
    }
  }, [stats?.uptime])

  useEffect(() => {
    if (app.status !== APP_STATUS.RUNNING) {
      setUptime(0)
      return
    }
    const updateUptime = () => {
      setUptime(baseUptime.current + (Date.now() - baseTime.current) / 1000)
    }
    updateUptime()
    const interval = setInterval(updateUptime, 1000)
    return () => clearInterval(interval)
  }, [app.status, stats?.uptime])

  const handleAction = (action: string) => {
    if (isTransient) { toast.info('App is transitioning'); return }
    lifecycle.mutate({ id: app.id, action })
  }

  return (
    <div className="space-y-4">
      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 gap-2">
          <div className="text-sm text-muted-foreground">Status</div>
          <StatusBadge status={app.status} className="text-sm" />
          {app.lastError && (
            <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-red-500/5 border border-red-500/10">
              <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
              <span className="text-xs text-red-400 line-clamp-2">{app.lastError}</span>
            </div>
          )}
        </Card>

        <Card className="p-4 gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" /> Uptime
          </div>
          {app.status === APP_STATUS.RUNNING ? (
            <>
              <div className="text-2xl font-bold font-mono">{formatUptime(uptime)}</div>
              <p className="text-xs text-muted-foreground">
                Started {app.lastStartedAt ? formatDistanceToNow(new Date(app.lastStartedAt), { addSuffix: true }) : 'N/A'}
              </p>
            </>
          ) : (
            <div className="text-lg text-muted-foreground">Not running</div>
          )}
        </Card>

        {monLoading ? (
          <Skeleton className="h-28" />
        ) : (
          <ResourceGauge label="CPU" value={stats?.cpu ?? 0} max={app.cpuLimit || 1} unit=" cores" icon={Cpu} />
        )}
        {monLoading ? (
          <Skeleton className="h-28" />
        ) : (
          <ResourceGauge label="Memory" value={stats?.memory ?? 0} max={app.memoryLimit || 512} unit=" MB" icon={MemoryStick} />
        )}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {app.status !== APP_STATUS.RUNNING && !isTransient && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleAction('start')}>
                <Play className="h-3.5 w-3.5" /> Start
              </Button>
            )}
            {app.status === APP_STATUS.RUNNING && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleAction('stop')}>
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            )}
            {!isTransient && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleAction('restart')}>
                <RotateCcw className="h-3.5 w-3.5" /> Restart
              </Button>
            )}
            {!isTransient && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleAction('rebuild')}>
                <Hammer className="h-3.5 w-3.5" /> Rebuild
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Last logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Recent Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No logs yet</p>
          ) : (
            <div className="bg-zinc-950 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-0.5">
              {logs.map((log, i) => (
                <div key={i} className={log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-zinc-300'}>
                  <span className="text-zinc-500">[{log.timestamp?.slice(11, 19)}]</span>{' '}
                  <span className={log.level === 'error' ? 'text-red-400 font-semibold' : log.level === 'warn' ? 'text-amber-400' : 'text-zinc-400'}>
                    {log.level?.toUpperCase().padEnd(5)}
                  </span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}