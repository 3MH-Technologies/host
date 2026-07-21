// App list view component
'use client'

import { useState } from 'react'
import { useApps, useLifecycleAction } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import { StatusBadge } from '@/components/common/status-badge'
import { EmptyState } from '@/components/common/empty-state'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Search,
  PlusCircle,
  Play,
  Square,
  RotateCcw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Cpu,
  HardDrive,
} from 'lucide-react'
import { APP_TYPE_LABELS } from '@/lib/constants'
import { APP_STATUS, ACTIVE_STATES, TRANSIENT_STATES } from '@/lib/types'
import { toast } from 'sonner'

function MiniBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className={`h-1.5 bg-muted rounded-full overflow-hidden w-16 ${className}`}>
      <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function AppCard({ app }: { app: any }) {
  const { selectApp } = useAppStore()
  const lifecycle = useLifecycleAction()
  const isActive = ACTIVE_STATES.includes(app.status)
  const isTransient = TRANSIENT_STATES.includes(app.status)

  const handleAction = (e: React.MouseEvent, action: string) => {
    e.stopPropagation()
    if (isTransient) {
      toast.info('App is currently transitioning. Please wait.')
      return
    }
    lifecycle.mutate({ id: app.id, action })
  }

  return (
    <Card
      className="cursor-pointer hover:border-emerald-500/30 transition-colors group py-4"
      onClick={() => selectApp(app.id)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate group-hover:text-emerald-400 transition-colors">{app.name}</h3>
            <Badge variant="outline" className="text-[10px] mt-1">
              {APP_TYPE_LABELS[app.appType] || app.appType}
            </Badge>
          </div>
          <StatusBadge status={app.status} />
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{app.runtime} {app.runtimeVersion}</span>
          {app.port && <span>:{app.port}</span>}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>CPU</span>
            <MiniBar value={app.cpuLimit || 0} max={4} />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>RAM</span>
            <MiniBar value={app.memoryLimit || 0} max={4096} />
          </div>
        </div>

        <div className="flex items-center gap-1 pt-1 border-t">
          {app.status === APP_STATUS.STOPPED || app.status === APP_STATUS.FAILED || app.status === APP_STATUS.CRASHED ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => handleAction(e, 'start')}>
              <Play className="h-3 w-3" /> Start
            </Button>
          ) : isActive ? (
            <>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => handleAction(e, 'restart')}>
                <RotateCcw className="h-3 w-3" /> Restart
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => handleAction(e, 'stop')}>
                <Square className="h-3 w-3" /> Stop
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => handleAction(e, 'rebuild')}>
              <RotateCcw className="h-3 w-3" /> Rebuild
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function AppListView() {
  const { setCurrentView, appsListPage, appsListSearch, appsListStatus, setAppsListPage, setAppsListSearch, setAppsListStatus } = useAppStore()
  const [sort, setSort] = useState('createdAt')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

  const { data, isLoading } = useApps({
    page: appsListPage,
    limit: 12,
    search: appsListSearch || undefined,
    status: appsListStatus || undefined,
    sort,
    order,
  })

  const apps = data?.data || []
  const meta = data?.meta
  const totalPages = meta?.total ? Math.ceil(meta.total / 12) : 1

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground">Manage your deployed applications</p>
        </div>
        <Button onClick={() => setCurrentView('app-create')} className="gap-2">
          <PlusCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Create App</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search applications..."
            value={appsListSearch}
            onChange={(e) => setAppsListSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={appsListStatus || 'all'} onValueChange={(v) => setAppsListStatus(v === 'all' ? null : v)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Filter status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="STOPPED">Stopped</SelectItem>
            <SelectItem value="CRASHED">Crashed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="CREATED">Created</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="createdAt">Created</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOrder(order === 'asc' ? 'desc' : 'asc')}
          className="shrink-0"
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="py-4"><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : apps.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No applications yet"
          description="Create your first application to get started with hosting."
          action={{ label: 'Create Application', onClick: () => setCurrentView('app-create') }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={appsListPage <= 1} onClick={() => setAppsListPage(appsListPage - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {appsListPage} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={appsListPage >= totalPages} onClick={() => setAppsListPage(appsListPage + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}