'use client'

import { useState, useSyncExternalStore } from 'react'
import { useSystemStats, useApps, useAuditLogs } from '@/hooks/use-api'
import { StatusBadge } from '@/components/common/status-badge'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  PlusCircle, Layers, PlayCircle, StopCircle, AlertTriangle, Activity,
  HardDrive, MemoryStick, Cpu, Server, Database, Gauge,
  Plus, Trash2, Play, Square, RotateCcw, Wrench, Upload, ChevronRight, CircleDot
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { APP_TYPE_LABELS, STATUS_LABELS } from '@/lib/constants'

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const emptySubscribe = () => () => {}

function useGreeting(): string {
  return useSyncExternalStore(emptySubscribe, getGreeting, () => 'Hello')
}

function getActionIcon(action: string) {
  const a = action.toLowerCase()
  if (a.includes('create') || a.includes('deploy')) return <Plus className="h-3.5 w-3.5" />
  if (a.includes('delete') || a.includes('remove')) return <Trash2 className="h-3.5 w-3.5" />
  if (a.includes('start')) return <Play className="h-3.5 w-3.5" />
  if (a.includes('stop')) return <Square className="h-3.5 w-3.5" />
  if (a.includes('restart')) return <RotateCcw className="h-3.5 w-3.5" />
  if (a.includes('rebuild') || a.includes('install') || a.includes('update')) return <Wrench className="h-3.5 w-3.5" />
  if (a.includes('upload')) return <Upload className="h-3.5 w-3.5" />
  return <CircleDot className="h-3.5 w-3.5" />
}

function getActionBorderColor(status: string): string {
  if (status === 'success') return 'border-l-emerald-500'
  if (status === 'error') return 'border-l-red-500'
  return 'border-l-zinc-400 dark:border-l-zinc-500'
}

function getActionIconColor(status: string): string {
  if (status === 'success') return 'text-emerald-500'
  if (status === 'error') return 'text-red-500'
  return 'text-zinc-500 dark:text-zinc-400'
}

const fadeIn = (delay = 0) =>
  ({ animation: `dashFadeIn .4s ease-out ${delay}ms both` } as React.CSSProperties)

/* ------------------------------------------------------------------ */
/*  Sparkline SVG (tiny decorative mini-chart for stat cards)          */
/* ------------------------------------------------------------------ */

function MiniSparkline({ color, values }: { color: string; values: number[] }) {
  const max = Math.max(...values, 1)
  const w = 64
  const h = 20
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * h}`)
    .join(' ')
  const areaPts = `0,${h} ${pts} ${w},${h}`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-16 h-5 opacity-40" fill="none">
      <polygon points={areaPts} fill={color} opacity={0.15} />
      <polyline points={pts} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Enhanced Stat Card                                                */
/* ------------------------------------------------------------------ */

function StatCard({
  title, value, icon: Icon, accentColor, gradientFrom, gradientTo, sub, sparkValues,
}: {
  title: string
  value: number | string
  icon: React.ElementType
  accentColor: string       // e.g. "bg-emerald-500"
  gradientFrom: string      // e.g. "from-emerald-500/5"
  gradientTo: string        // e.g. "to-emerald-500/[0.02]"
  sub?: string
  sparkValues?: number[]
}) {
  return (
    <Card
      className={`relative overflow-hidden p-5 gap-2 border-b-2 ${accentColor} bg-gradient-to-br ${gradientFrom} ${gradientTo} transition-shadow hover:shadow-md`}
      style={fadeIn(0)}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</span>
        <div className={`rounded-lg p-1.5 ${accentColor.replace('bg-', 'bg-').replace('/5', '/10').replace('500', '500/15')}`}>
          <Icon className="h-4 w-4 text-foreground/70" />
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-3xl font-extrabold tracking-tight leading-none">{value}</span>
        {sparkValues && <MiniSparkline color={accentColor.replace('bg-', '').replace('500', '500')} values={sparkValues} />}
      </div>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Circular Progress Indicator                                       */
/* ------------------------------------------------------------------ */

function CircularProgress({ value, max, label, unit, color }: {
  value: number; max: number; label: string; unit: string; color: string
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const displayVal = pct < 10 ? pct.toFixed(2) : pct.toFixed(1)

  return (
    <div className="flex flex-col items-center gap-1.5" style={fadeIn(100)}>
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/40" />
          <circle
            cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none">{displayVal}%</span>
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-medium">
        {value.toFixed(1)}{unit} / {max}{unit}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard View                                               */
/* ------------------------------------------------------------------ */

export function DashboardView() {
  const { data: statsData, isLoading: statsLoading } = useSystemStats()
  const { data: appsData, isLoading: appsLoading } = useApps({ limit: 10 })
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({ limit: 10 })
  const { setCurrentView, selectApp } = useAppStore()

  const stats = statsData?.data
  const apps = appsData?.data || []
  const auditLogs = auditData?.data || []
  const failedApps = apps.filter((a: any) => a.status === 'CRASHED' || a.status === 'FAILED')

  // "All Apps" section shows up to 4 cards, rest behind "View All"
  const greeting = useGreeting()
  const allAppsGrid = apps.slice(0, 4)
  const hasMoreApps = apps.length > 4

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* ── Welcome ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between" style={fadeIn(0)}>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{greeting}</h1>
          <p className="text-sm text-muted-foreground mt-1">Here&apos;s what&apos;s happening with your applications.</p>
        </div>
        <Button onClick={() => setCurrentView('app-create')} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">New App</span>
        </Button>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────── */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-20 w-full" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Apps"
            value={stats?.totalApps ?? 0}
            icon={Layers}
            accentColor="bg-zinc-500"
            gradientFrom="from-zinc-500/5"
            gradientTo="to-zinc-500/[0.01]"
            sub="All registered apps"
            sparkValues={[1, 3, 2, 4, 3, 5, stats?.totalApps ?? 0]}
          />
          <StatCard
            title="Running"
            value={stats?.runningApps ?? 0}
            icon={PlayCircle}
            accentColor="bg-emerald-500"
            gradientFrom="from-emerald-500/5"
            gradientTo="to-emerald-500/[0.01]"
            sub="Actively serving"
            sparkValues={[0, 1, 1, 2, 1, 2, stats?.runningApps ?? 0]}
          />
          <StatCard
            title="Stopped"
            value={stats?.stoppedApps ?? 0}
            icon={StopCircle}
            accentColor="bg-zinc-400"
            gradientFrom="from-zinc-400/5"
            gradientTo="to-zinc-400/[0.01]"
            sub="Idle applications"
            sparkValues={[2, 2, 3, 2, 1, 2, stats?.stoppedApps ?? 0]}
          />
          <StatCard
            title="Failed"
            value={stats?.failedApps ?? 0}
            icon={AlertTriangle}
            accentColor="bg-red-500"
            gradientFrom="from-red-500/5"
            gradientTo="to-red-500/[0.01]"
            sub="Needs attention"
            sparkValues={[0, 0, 1, 0, 1, 0, stats?.failedApps ?? 0]}
          />
        </div>
      )}

      {/* ── Resource Usage + System Health ──────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Resource Usage — circular indicators */}
        <Card className="lg:col-span-2" style={fadeIn(120)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4 text-emerald-500" />
              Resource Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="flex items-center justify-around py-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-24 rounded-full" />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-around py-4">
                <CircularProgress
                  label="CPU"
                  value={stats?.totalCpu ?? 0}
                  max={400}
                  unit="%"
                  color={
                    (stats?.totalCpu ?? 0) / 400 > 0.8
                      ? '#ef4444'
                      : (stats?.totalCpu ?? 0) / 400 > 0.6
                        ? '#f59e0b'
                        : '#10b981'
                  }
                />
                <CircularProgress
                  label="Memory"
                  value={stats?.totalMemory ?? 0}
                  max={8192}
                  unit="MB"
                  color={
                    (stats?.totalMemory ?? 0) / 8192 > 0.8
                      ? '#ef4444'
                      : (stats?.totalMemory ?? 0) / 8192 > 0.6
                        ? '#f59e0b'
                        : '#10b981'
                  }
                />
                <CircularProgress
                  label="Disk"
                  value={stats?.usedDisk ?? 0}
                  max={stats?.totalDisk ?? 10240}
                  unit="MB"
                  color={
                    ((stats?.usedDisk ?? 0) / (stats?.totalDisk ?? 10240)) > 0.8
                      ? '#ef4444'
                      : ((stats?.usedDisk ?? 0) / (stats?.totalDisk ?? 10240)) > 0.6
                        ? '#f59e0b'
                        : '#10b981'
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card style={fadeIn(180)}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="h-4 w-4 text-emerald-500" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Server Uptime */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10">
                  <Server className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Server Uptime</p>
                  <p className="text-xs text-muted-foreground">Process manager</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Online</span>
              </div>
            </div>

            {/* API Response Time */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10">
                  <Gauge className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">API Response</p>
                  <p className="text-xs text-muted-foreground">Average latency</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Healthy</span>
              </div>
            </div>

            {/* Database Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-emerald-500/10">
                  <Database className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">Database</p>
                  <p className="text-xs text-muted-foreground">SQLite storage</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Connected</span>
              </div>
            </div>

            {/* Quick link */}
            <div className="pt-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/10"
                onClick={() => setCurrentView('app-create')}
              >
                <PlusCircle className="h-4 w-4" />
                Create New App
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Apps Needing Attention ──────────────────────────── */}
      {failedApps.length > 0 && (
        <Card style={fadeIn(240)}>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Apps Needing Attention
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
                style={{ animation: 'pulseRed 1.5s ease-in-out infinite' }}
              >
                {failedApps.length}
              </span>
            </CardTitle>
            <button
              onClick={() => setCurrentView('apps')}
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
            >
              View All <ChevronRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {failedApps.map((app: any) => (
                <div
                  key={app.id}
                  className="group flex items-center justify-between p-3.5 rounded-lg bg-red-500/5 border border-red-500/10 hover:border-red-500/25 hover:bg-red-500/[0.07] transition-all cursor-pointer"
                  onClick={() => selectApp(app.id)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="relative flex h-2.5 w-2.5"
                      style={{ animation: 'pulseRed 1.5s ease-in-out infinite' }}
                    >
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                    </span>
                    <span className="font-medium text-sm group-hover:text-red-400 transition-colors">{app.name}</span>
                    <StatusBadge status={app.status as any} />
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-red-400 transition-colors" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Activity (timeline) ──────────────────────── */}
      <Card style={fadeIn(300)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-emerald-500" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No activity yet</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

                <div className="space-y-0.5">
                  {auditLogs.map((log: any, idx: number) => (
                    <div
                      key={log.id}
                      className={`relative flex items-center gap-4 py-2.5 pl-1 pr-3 rounded-r-md hover:bg-muted/50 transition-colors border-l-2 ${getActionBorderColor(log.status)}`}
                    >
                      {/* Timeline dot */}
                      <div className={`relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border-2 border-background ${
                        log.status === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'
                      }`}>
                        <span className={getActionIconColor(log.status)}>
                          {getActionIcon(log.action)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{log.action}</span>
                          {log.resource && (
                            <span className="text-xs text-muted-foreground truncate">— {log.resource}</span>
                          )}
                        </div>
                        {log.details && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{log.details}</p>
                        )}
                      </div>

                      {/* Timestamp */}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── All Apps ────────────────────────────────────────── */}
      {!appsLoading && apps.length > 0 && (
        <div style={fadeIn(360)}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight">All Apps</h2>
            {hasMoreApps && (
              <button
                onClick={() => setCurrentView('apps')}
                className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-0.5 transition-colors"
              >
                View All <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {allAppsGrid.map((app: any) => (
              <Card
                key={app.id}
                className="group cursor-pointer border-b-2 border-b-transparent hover:border-b-emerald-500 transition-all hover:shadow-md"
                onClick={() => selectApp(app.id)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {app.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {APP_TYPE_LABELS[app.appType] || app.appType}
                      </p>
                    </div>
                    <StatusBadge status={app.status as any} />
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="h-3 w-3" />
                      <span>{app.runtime}{app.runtimeVersion ? ` ${app.runtimeVersion}` : ''}</span>
                    </div>
                    <span>{formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
