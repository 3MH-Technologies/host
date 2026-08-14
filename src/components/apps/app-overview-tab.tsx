'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useMonitoring, useLogs, useLifecycleAction } from '@/hooks/use-api'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Play, Square, RotateCcw, Hammer, Clock, AlertCircle, Cpu, MemoryStick, HardDrive, Copy, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import type { Application } from '@prisma/client'
import { TRANSIENT_STATES, APP_STATUS } from '@/lib/types'
import { APP_TYPE_LABELS } from '@/lib/constants'
import { toast } from 'sonner'

const fadeVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' },
  }),
}

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
      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
    </Button>
  )
}

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
    if (isTransient) { toast.info('App is transitioning'); return }
    lifecycle.mutate({ id: app.id, action })
  }

  const diskUsage = stats?.diskUsage ?? 0
  const diskMax = app.diskLimit || 1024
  const restartCount = stats?.restartCount ?? app.currentRestartCount ?? 0
  const maxRestarts = app.maxRestartAttempts || 5

  const infoItems = [
    { label: 'Type', value: APP_TYPE_LABELS[app.appType] || app.appType },
    { label: 'Runtime', value: `${app.runtime}${app.runtimeVersion ? ` ${app.runtimeVersion}` : ''}` },
    { label: 'Port', value: app.port ? String(app.port) : 'Not configured' },
    { label: 'Working Dir', value: app.workingDir || '.' },
    { label: 'Entry Point', value: app.entryPoint || 'auto-detected' },
    { label: 'Restart Policy', value: app.restartPolicy || 'on-failure' },
    {
      label: 'Health Check',
      value: app.healthCheckType && app.healthCheckType !== 'none'
        ? `${app.healthCheckType} · ${app.healthCheckInterval}s interval · ${app.healthCheckRetries} retries`
        : app.healthCheckType === 'none' ? 'Disabled' : 'process · 30s interval · 3 retries',
    },
  ]

  const commandItems = [
    { label: 'Install', value: app.installCmd },
    { label: 'Build', value: app.buildCmd },
    { label: 'Start', value: app.startCmd },
    { label: 'Stop', value: app.stopCmd },
  ]

  return (
    <div className="space-y-4">
      {/* Top row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div custom={0} variants={fadeVariants} initial="hidden" animate="visible">
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
        </motion.div>

        <motion.div custom={1} variants={fadeVariants} initial="hidden" animate="visible">
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
        </motion.div>

        {monLoading ? (
          <Skeleton className="h-28" />
        ) : (
          <motion.div custom={2} variants={fadeVariants} initial="hidden" animate="visible">
            <ResourceGauge label="CPU" value={stats?.cpu ?? 0} max={app.cpuLimit || 1} unit=" cores" icon={Cpu} />
          </motion.div>
        )}
        {monLoading ? (
          <Skeleton className="h-28" />
        ) : (
          <motion.div custom={3} variants={fadeVariants} initial="hidden" animate="visible">
            <ResourceGauge label="Memory" value={stats?.memory ?? 0} max={app.memoryLimit || 512} unit=" MB" icon={MemoryStick} />
          </motion.div>
        )}
      </div>

      {/* Second row - Disk Usage & Restart Count */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {monLoading ? (
          <Skeleton className="h-28" />
        ) : (
          <motion.div custom={4} variants={fadeVariants} initial="hidden" animate="visible">
            <ResourceGauge label="Disk Usage" value={diskUsage} max={diskMax} unit=" MB" icon={HardDrive} />
          </motion.div>
        )}
        <motion.div custom={5} variants={fadeVariants} initial="hidden" animate="visible">
          <Card className="p-4 gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RotateCcw className="h-4 w-4" />
              Restart Count
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono">{restartCount}</span>
              <span className="text-sm text-muted-foreground">/ {maxRestarts} max</span>
            </div>
            <div className="mt-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    restartCount >= maxRestarts
                      ? 'bg-red-500'
                      : restartCount >= maxRestarts * 0.6
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min((restartCount / maxRestarts) * 100, 100)}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {restartCount >= maxRestarts ? 'Limit reached' : `${maxRestarts - restartCount} attempts remaining`}
            </p>
          </Card>
        </motion.div>
      </div>

      {/* App Info */}
      <motion.div custom={6} variants={fadeVariants} initial="hidden" animate="visible">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">App Info</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-0">
              {infoItems.map((item, i) => (
                <div key={item.label}>
                  <div className="py-2.5">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</span>
                    <p className="text-sm font-medium mt-0.5 break-all">{item.value}</p>
                  </div>
                  {i < infoItems.length - 1 && (
                    <Separator className="opacity-50" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Commands */}
      <motion.div custom={7} variants={fadeVariants} initial="hidden" animate="visible">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Commands</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {commandItems.map((item) => (
                <div
                  key={item.label}
                  className="group relative rounded-lg border bg-muted/30 p-3"
                >
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</span>
                  {item.value ? (
                    <div className="flex items-start justify-between gap-2 mt-1">
                      <code className="text-sm font-mono break-all leading-relaxed">
                        {item.value}
                      </code>
                      <div className="shrink-0">
                        <CopyButton text={item.value} />
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground/60 mt-1 block">—</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions */}
      <motion.div custom={8} variants={fadeVariants} initial="hidden" animate="visible">
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
      </motion.div>

      {/* Recent Logs */}
      <motion.div custom={9} variants={fadeVariants} initial="hidden" animate="visible">
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
                {logs.map((log: any, i: number) => (
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
      </motion.div>
    </div>
  )
}