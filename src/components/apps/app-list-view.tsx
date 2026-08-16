'use client'

import { useState } from 'react'
import { useApps, useLifecycleAction } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import { StatusBadge } from '@/components/common/status-badge'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  PlusCircle,
  Play,
  Square,
  RotateCcw,
  Layers,
} from 'lucide-react'
import { APP_TYPE_LABELS } from '@/lib/constants'
import { APP_STATUS, ACTIVE_STATES, TRANSIENT_STATES } from '@/lib/types'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

function AppCard({ app }: { app: any }) {
  const { selectApp } = useAppStore()
  const lifecycle = useLifecycleAction()
  const isActive = ACTIVE_STATES.includes(app.status)
  const isTransient = TRANSIENT_STATES.includes(app.status)

  const handleAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation()
    if (isTransient) {
      toast.info('التطبيق في حالة انتقالية')
      return
    }
    lifecycle.mutate({ id: app.id, action })
  }

  return (
    <Card
      className="cursor-pointer hover:border-emerald-500/30 transition-colors group"
      onClick={() => selectApp(app.id)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate group-hover:text-emerald-500 transition-colors">{app.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {APP_TYPE_LABELS[app.appType] || app.appType} · {app.runtime} {app.runtimeVersion}
            </p>
          </div>
          <StatusBadge status={app.status} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
          </span>
          <div className="flex items-center gap-1">
            {!isActive && !isTransient && (
              <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={(e) => handleAction(e, 'start')}>
                <Play className="h-3 w-3" /> تشغيل
              </Button>
            )}
            {isActive && (
              <>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={(e) => handleAction(e, 'restart')}>
                  <RotateCcw className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] gap-1 px-2" onClick={(e) => handleAction(e, 'stop')}>
                  <Square className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function AppListView() {
  const { setCurrentView, appsListPage, appsListSearch, setAppsListPage, setAppsListSearch } = useAppStore()

  const { data, isLoading } = useApps({
    page: appsListPage,
    limit: 12,
    search: appsListSearch || undefined,
  })

  const apps = data?.data || []
  const meta = data?.meta
  const totalPages = meta?.total ? Math.ceil(meta.total / 12) : 1

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">التطبيقات</h1>
        <Button onClick={() => setCurrentView('app-create')} size="sm" className="gap-1.5">
          <PlusCircle className="h-3.5 w-3.5" />
          تطبيق جديد
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث في التطبيقات..."
          value={appsListSearch}
          onChange={(e) => setAppsListSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : apps.length === 0 ? (
        <Card className="p-8 text-center">
          <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">لا توجد تطبيقات بعد</p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setCurrentView('app-create')}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            أنشئ تطبيقك الأول
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {apps.map((app: any) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={appsListPage <= 1}
            onClick={() => setAppsListPage(appsListPage - 1)}
          >
            السابق
          </Button>
          <span className="text-xs text-muted-foreground">{appsListPage} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            disabled={appsListPage >= totalPages}
            onClick={() => setAppsListPage(appsListPage + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  )
}