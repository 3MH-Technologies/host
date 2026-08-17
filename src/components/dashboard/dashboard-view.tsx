'use client'

import { useSystemStats, useApps, useAuditLogs } from '@/hooks/use-api'
import { StatusBadge } from '@/components/common/status-badge'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PlusCircle, Layers, PlayCircle, StopCircle, AlertTriangle, Activity } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { APP_TYPE_LABELS } from '@/lib/constants'

export function DashboardView() {
  const { data: statsData, isLoading: statsLoading } = useSystemStats()
  const { data: appsData, isLoading: appsLoading } = useApps({ limit: 10 })
  const { data: auditData, isLoading: auditLoading } = useAuditLogs({ limit: 8 })
  const { setCurrentView, selectApp } = useAppStore()

  const stats = statsData?.data
  const apps = appsData?.data || []
  const auditLogs = auditData?.data || []
  const failedApps = apps.filter((a: any) => a.status === 'CRASHED' || a.status === 'FAILED')

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mt-0.5">مرحبًا بك في 3MH Host</p>
        </div>
        <Button onClick={() => setCurrentView('app-create')} size="sm" className="gap-1.5">
          <PlusCircle className="h-3.5 w-3.5" />
          تطبيق جديد
        </Button>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="التطبيقات" value={stats?.totalApps ?? 0} icon={Layers} />
          <StatCard label="يعمل" value={stats?.runningApps ?? 0} icon={PlayCircle} color="text-emerald-500" />
          <StatCard label="متوقف" value={stats?.stoppedApps ?? 0} icon={StopCircle} />
          <StatCard label="أخطاء" value={stats?.failedApps ?? 0} icon={AlertTriangle} color="text-red-500" />
        </div>
      )}

      {/* Failed Apps Alert */}
      {failedApps.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium text-red-400">{failedApps.length} تطبيق يحتاج انتباهك</span>
            </div>
            <div className="space-y-2">
              {failedApps.map((app: any) => (
                <button
                  key={app.id}
                  onClick={() => selectApp(app.id)}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-background/50 hover:bg-background/80 transition-colors text-right"
                >
                  <span className="text-sm font-medium truncate">{app.name}</span>
                  <StatusBadge status={app.status as any} />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apps Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">تطبيقاتك</h2>
          <button
            onClick={() => setCurrentView('apps')}
            className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            عرض الكل
          </button>
        </div>
        {appsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4"><Skeleton className="h-20 w-full" /></Card>
            ))}
          </div>
        ) : apps.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">لا توجد تطبيقات بعد</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => setCurrentView('app-create')}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              أنشئ تطبيقك الأول
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {apps.slice(0, 6).map((app: any) => (
              <Card
                key={app.id}
                className="group cursor-pointer hover:border-emerald-500/30 transition-colors"
                onClick={() => selectApp(app.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-sm truncate group-hover:text-emerald-500 transition-colors">
                      {app.name}
                    </h3>
                    <StatusBadge status={app.status as any} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{APP_TYPE_LABELS[app.appType] || app.appType}</span>
                    <span>{formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">النشاط الأخير</h2>
        <Card>
          {auditLoading ? (
            <CardContent className="p-4">
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </CardContent>
          ) : auditLogs.length === 0 ? (
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">لا يوجد نشاط بعد</p>
            </CardContent>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {auditLogs.map((log: any) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between px-4 py-2.5 border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      log.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm truncate">{log.action}</span>
                    {log.resource && (
                      <span className="text-xs text-muted-foreground truncate">— {log.resource}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 mr-3">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-foreground',
}: {
  label: string
  value: number
  icon: React.ElementType
  color?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
    </Card>
  )
}
