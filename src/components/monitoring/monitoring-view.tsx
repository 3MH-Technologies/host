'use client'

import { useMemo, useRef } from 'react'
import { useMonitoring, useApp } from '@/hooks/use-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, Clock, RotateCcw, Heart, AlertCircle } from 'lucide-react'
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatDistanceToNow } from 'date-fns'
import type { MetricPoint, AppStats } from '@/lib/types'

interface Props {
  appId: string
}

function useHistoryPoints(stats: AppStats | undefined, maxPoints: number = 60): MetricPoint[] {
  const historyRef = useRef<MetricPoint[]>([])
  if (stats) {
    const point: MetricPoint = {
      timestamp: Date.now(),
      cpu: stats.cpu,
      memory: stats.memory,
      diskUsage: stats.diskUsage,
      networkIn: 0,
      networkOut: 0,
    }
    historyRef.current = [...historyRef.current, point].slice(-maxPoints)
  }
  return historyRef.current
}

export function MonitoringView({ appId }: Props) {
  const { data: appData } = useApp(appId)
  const { data: monData, isLoading } = useMonitoring(appId)
  const stats = monData?.data
  const app = appData?.data
  const history = useHistoryPoints(stats)

  const cpuData = history.map((p) => ({ time: new Date(p.timestamp).toLocaleTimeString().slice(0, 8), cpu: p.cpu, memory: p.memory }))

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4 gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /> Uptime</div>
            <div className="text-xl font-bold font-mono">
              {stats?.uptime != null ? formatUptimeShort(stats.uptime) : 'N/A'}
            </div>
          </Card>
          <Card className="p-4 gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><RotateCcw className="h-4 w-4" /> Restarts</div>
            <div className="text-xl font-bold">{app?.currentRestartCount ?? 0}</div>
          </Card>
          <Card className="p-4 gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Heart className="h-4 w-4" /> Health</div>
            <div className={`text-xl font-bold ${stats?.healthStatus === 'healthy' ? 'text-emerald-400' : stats?.healthStatus === 'unhealthy' ? 'text-red-400' : 'text-zinc-400'}`}>
              {(stats?.healthStatus || 'unknown').charAt(0).toUpperCase() + (stats?.healthStatus || 'unknown').slice(1)}
            </div>
          </Card>
          <Card className="p-4 gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" /> Last Error</div>
            <div className="text-sm truncate font-mono text-red-400" title={app?.lastError || 'None'}>
              {app?.lastError ? app.lastError.slice(0, 30) : 'None'}
            </div>
          </Card>
        </div>
      )}

      {/* CPU Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" /> CPU Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cpuData.length < 2 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Collecting data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cpuData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="time" stroke="#52525b" fontSize={10} />
                <YAxis stroke="#52525b" fontSize={10} domain={[0, (app?.cpuLimit || 1) * 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'CPU']}
                />
                <Line type="monotone" dataKey="cpu" stroke="#22c55e" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Memory Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-500" /> Memory Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cpuData.length < 2 ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Collecting data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cpuData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="time" stroke="#52525b" fontSize={10} />
                <YAxis stroke="#52525b" fontSize={10} domain={[0, app?.memoryLimit || 512]} tickFormatter={(v) => `${v}MB`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }}
                  labelStyle={{ color: '#a1a1aa' }}
                  formatter={(value: number) => [`${value.toFixed(0)} MB`, 'Memory']}
                />
                <defs>
                  <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="memory" stroke="#f59e0b" strokeWidth={2} fill="url(#memGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatUptimeShort(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}