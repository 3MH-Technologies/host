'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMonitoring, useLogs, useLifecycleAction } from '@/hooks/use-api'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Play, Square, RotateCcw, Clock, AlertCircle, Cpu, MemoryStick, HardDrive, Copy, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Application } from '@prisma/client'
import { TRANSIENT_STATES, APP_STATUS } from '@/lib/types'
import { APP_TYPE_LABELS } from '@/lib/constants'
import { toast } from 'sonner'

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </Button>
  )
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}ث`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}د ${Math.floor(seconds % 60)}ث`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}س ${Math.floor((seconds % 3600) / 60)}د`
  return `${Math.floor(seconds / 86400)}ي ${Math.floor((seconds % 86400) / 3600)}س`
}

interface Props {
  app: Application
}

export function AppOverviewTab({ app }: Props) {
  const { data: monitoringData, isLoading: monLoading } = useMonitoring(app.id)
  const { data: logsData, isLoading: logsLoading } = useLogs(app.id, 'app', 8)
  const lifecycle = useLifecycleAction()

  const stats = monitoringData?.data
  const logs = (logsData?.data as any)?.lines || []
  const isTransient = TRANSIENT_STATES.includes(app.status)

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
    if (isTransient) { toast.info('التطبيق في حالة انتقالية'); return }
    lifecycle.mutate({ id: app.id, action })
  }

  const cpuPct = stats?.cpu ? Math.min((stats.cpu / (app.cpuLimit || 1)) * 100, 100) : 0
  const memPct = stats?.memory ? Math.min((stats.memory / (app.memoryLimit || 512)) * 100, 100) : 0
  const diskUsage = stats?.diskUsage ?? 0
  const diskMax = app.diskLimit || 1024
  const diskPct = diskMax > 0 ? Math.min((diskUsage / diskMax) * 100, 100) : 0

  return (
    <div className="space-y-4">
      {/* Status + Uptime + Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-1">الحالة</p>
          <StatusBadge status={app.status} />
          {app.lastError && (
            <div className="flex items-start gap-1.5 mt-2 p-2 rounded bg-red-500/5 border border-red-500/10">
              <AlertCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
              <span className="text-[11px] text-red-400 line-clamp-2">{app.lastError}</span>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Clock className="h-3.5 w-3.5" /> مدة التشغيل
          </div>
          {app.status === APP_STATUS.RUNNING ? (
            <>
              <p className="text-xl font-bold font-mono">{formatUptime(uptime)}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                أُطلق {app.lastStartedAt ? formatDistanceToNow(new Date(app.lastStartedAt), { addSuffix: true }) : '—'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">متوقف</p>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2">الموارد</p>
          {monLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : (
            <div className="space-y-1.5">
              <GaugeRow label="CPU" value={cpuPct} />
              <GaugeRow label="RAM" value={memPct} />
              <GaugeRow label="قرص" value={diskPct} />
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2">إجراءات سريعة</p>
          <div className="flex flex-col gap-1.5">
            {app.status !== APP_STATUS.RUNNING && !isTransient && (
              <Button size="sm" variant="outline" className="w-full gap-1.5 h-7 text-xs" onClick={() => handleAction('start')}>
                <Play className="h-3 w-3" /> تشغيل
              </Button>
            )}
            {app.status === APP_STATUS.RUNNING && (
              <Button size="sm" variant="outline" className="w-full gap-1.5 h-7 text-xs" onClick={() => handleAction('stop')}>
                <Square className="h-3 w-3" /> إيقاف
              </Button>
            )}
            {!isTransient && (
              <Button size="sm" variant="outline" className="w-full gap-1.5 h-7 text-xs" onClick={() => handleAction('restart')}>
                <RotateCcw className="h-3 w-3" /> إعادة تشغيل
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">معلومات التطبيق</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
            <InfoItem label="النوع" value={APP_TYPE_LABELS[app.appType] || app.appType} />
            <InfoItem label="البيئة" value={`${app.runtime} ${app.runtimeVersion}`} />
            <InfoItem label="المنفذ" value={app.port ? String(app.port) : '—'} />
            <InfoItem label="نقطة الدخول" value={app.entryPoint || 'تلقائي'} />
            <InfoItem label="سياسة الإعادة" value={app.restartPolicy} />
            <InfoItem label="البدء" value={app.startCmd} mono />
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">آخر السجلات</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">لا توجد سجلات</p>
          ) : (
            <div className="bg-zinc-950 rounded-lg p-3 max-h-40 overflow-y-auto font-mono text-[11px] space-y-0.5">
              {logs.map((log: any, i: number) => (
                <div key={i} className={log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-zinc-300'}>
                  <span className="text-zinc-500">[{log.timestamp?.slice(11, 19)}]</span>{' '}
                  <span className={log.level === 'error' ? 'text-red-400' : 'text-zinc-400'}>
                    {(log.level || 'info').toUpperCase().padEnd(5)}
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

function GaugeRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-8">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${value > 80 ? 'bg-red-500' : value > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-8 text-left">{value.toFixed(0)}%</span>
    </div>
  )
}

function InfoItem({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="py-1">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      {value ? (
        <p className={`text-xs font-medium mt-0.5 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      ) : (
        <p className="text-xs text-muted-foreground/50 mt-0.5">—</p>
      )}
    </div>
  )
}
