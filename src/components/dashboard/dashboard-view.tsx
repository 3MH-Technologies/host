'use client'

import { useSystemStats, useApps, useAuditLogs } from '@/hooks/use-api'
import { StatusBadge } from '@/components/common/status-badge'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PlusCircle, Layers, PlayCircle, StopCircle, AlertTriangle, Activity, HardDrive, MemoryStick, Cpu } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

function StatCard({ title, value, icon: Icon, color, sub }: { title: string; value: number | string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <Card className="p-4 gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className={`rounded-lg p-2 ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  )
}

function ResourceBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}{unit} / {max}{unit}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function DashboardView() {
  const { data: statsData, isLoading: statsLoading } = useSystemStats()
  const { data: appsData, isLoading: appsLoading } = useApps({ limit: 10 })
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({ limit: 10 })
  const { setCurrentView } = useAppStore()

  const stats = statsData?.data
  const apps = appsData?.data || []
  const auditLogs = auditData?.data || []
  const failedApps = apps.filter((a) => a.status === 'CRASHED' || a.status === 'FAILED')

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your hosting platform</p>
        </div>
        <Button onClick={() => setCurrentView('app-create')} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">New App</span>
        </Button>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Apps" value={stats?.totalApps ?? 0} icon={Layers} color="bg-zinc-500/10 text-zinc-500" />
          <StatCard title="Running" value={stats?.runningApps ?? 0} icon={PlayCircle} color="bg-emerald-500/10 text-emerald-500" />
          <StatCard title="Stopped" value={stats?.stoppedApps ?? 0} icon={StopCircle} color="bg-zinc-500/10 text-zinc-400" />
          <StatCard title="Failed" value={stats?.failedApps ?? 0} icon={AlertTriangle} color="bg-red-500/10 text-red-500" />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Resource Usage */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Resource Usage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsLoading ? (
              <>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </>
            ) : (
              <>
                <ResourceBar label="CPU" value={stats?.totalCpu ?? 0} max={400} unit="%" />
                <ResourceBar label="Memory" value={stats?.totalMemory ?? 0} max={8192} unit="MB" />
                <ResourceBar label="Disk" value={stats?.usedDisk ?? 0} max={stats?.totalDisk ?? 10240} unit="MB" />
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('app-create')}>
              <PlusCircle className="h-4 w-4 text-emerald-500" />
              Create New App
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('apps')}>
              <Layers className="h-4 w-4" />
              View All Apps
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setCurrentView('audit')}>
              <Activity className="h-4 w-4" />
              Audit Logs
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Apps Needing Attention */}
      {failedApps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-red-400">
              <AlertTriangle className="h-4 w-4" />
              Apps Needing Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failedApps.map((app) => (
                <div key={app.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{app.name}</span>
                    <StatusBadge status={app.status as any} />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => useAppStore.getState().selectApp(app.id)}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No activity yet</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 text-sm">
                  <span
                    className={`h-2 w-2 rounded-full shrink-0 ${log.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}
                  />
                  <span className="font-medium min-w-0 truncate">{log.action}</span>
                  {log.resource && <span className="text-muted-foreground truncate">{log.resource}</span>}
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}