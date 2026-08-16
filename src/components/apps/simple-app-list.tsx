'use client'

import { useApps, useLifecycleAction } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import { StatusBadge } from '@/components/common/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, PlusCircle, Play, Square, RotateCcw, Layers } from 'lucide-react'
import { APP_TYPE_LABELS } from '@/lib/constants'
import { ACTIVE_STATES, TRANSIENT_STATES } from '@/lib/types'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

export function SimpleAppList({ onCreateClick }: { onCreateClick: () => void }) {
  const { selectApp } = useAppStore()
  const [search, setSearch] = useState('')
  const { data, isLoading } = useApps({ search: search || undefined })
  const apps = data?.data || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">التطبيقات</h1>
        <Button onClick={onCreateClick} size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500">
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">تطبيق جديد</span>
          <span className="sm:hidden">جديد</span>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="text-center py-16">
          <Layers className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">لا توجد تطبيقات بعد</p>
          <p className="text-xs text-muted-foreground/70">اضغط على &quot;تطبيق جديد&quot; لتبدأ</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apps.map((app: any) => (
            <AppRow key={app.id} app={app} onClick={() => selectApp(app.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function AppRow({ app, onClick }: { app: any; onClick: () => void }) {
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
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 p-3.5 rounded-lg border bg-card hover:border-emerald-500/30 transition-colors text-right group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
          <span className="text-emerald-500 text-sm font-bold">
            {(app.name || '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate group-hover:text-emerald-500 transition-colors">{app.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {APP_TYPE_LABELS[app.appType] || app.appType} · {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={app.status} />
        {!isActive && !isTransient && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleAction(e, 'start')}>
            <Play className="h-3.5 w-3.5 text-emerald-500" />
          </Button>
        )}
        {isActive && (
          <>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleAction(e, 'restart')}>
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => handleAction(e, 'stop')}>
              <Square className="h-3.5 w-3.5 text-red-400" />
            </Button>
          </>
        )}
      </div>
    </button>
  )
}