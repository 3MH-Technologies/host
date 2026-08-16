'use client'

import { useState, useEffect } from 'react'
import { useApp, useLifecycleAction, useDeleteApp } from '@/hooks/use-api'
import { useProcessEvents } from '@/hooks/use-process-events'
import { useAppStore } from '@/store/app-store'
import { StatusBadge } from '@/components/common/status-badge'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Play, Square, RotateCcw, Trash2, ArrowLeft,
  Terminal, FileText, FolderOpen, Settings, Activity,
} from 'lucide-react'
import { APP_TYPE_LABELS } from '@/lib/constants'
import { TRANSIENT_STATES, APP_STATUS } from '@/lib/types'
import { AppOverviewTab } from './app-overview-tab'
import { FileManager } from '@/components/files/file-manager'
import { TerminalView } from '@/components/terminal/terminal-view'
import { LogViewer } from '@/components/logs/log-viewer'
import { AppSettings } from '@/components/settings/app-settings'

const TAB_ITEMS = [
  { id: 'overview', label: 'نظرة عامة', icon: Activity },
  { id: 'files', label: 'الملفات', icon: FolderOpen },
  { id: 'terminal', label: 'الطرفية', icon: Terminal },
  { id: 'logs', label: 'السجلات', icon: FileText },
  { id: 'settings', label: 'الإعدادات', icon: Settings },
]

export function AppDetailView() {
  const { selectedAppId, selectedTab, setSelectedTab, setCurrentView } = useAppStore()
  const { data, isLoading } = useApp(selectedAppId)
  const lifecycle = useLifecycleAction()
  const deleteApp = useDeleteApp()
  const [deleteOpen, setDeleteOpen] = useState(false)

  useProcessEvents(selectedAppId)

  const app = data?.data
  const isTransient = app ? TRANSIENT_STATES.includes(app.status) : false

  useEffect(() => {
    setSelectedTab('overview')
  }, [selectedAppId, setSelectedTab])

  const handleAction = (action: string) => {
    if (isTransient) {
      toast.info('التطبيق في حالة انتقالية حاليًا')
      return
    }
    lifecycle.mutate({ id: selectedAppId!, action })
  }

  const handleDelete = () => {
    deleteApp.mutate(selectedAppId!, {
      onSuccess: () => {
        setDeleteOpen(false)
        setCurrentView('apps')
      },
    })
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!app) {
    return (
      <div className="p-4 md:p-6 text-center text-muted-foreground">
        التطبيق غير موجود
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('apps')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold truncate">{app.name}</h1>
              <StatusBadge status={app.status} />
              <Badge variant="outline" className="text-[10px]">{APP_TYPE_LABELS[app.appType] || app.appType}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {app.runtime} {app.runtimeVersion}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {app.status !== APP_STATUS.RUNNING && !isTransient && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction('start')}>
              <Play className="h-3.5 w-3.5" /> تشغيل
            </Button>
          )}
          {app.status === APP_STATUS.RUNNING && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction('stop')}>
              <Square className="h-3.5 w-3.5" /> إيقاف
            </Button>
          )}
          {!isTransient && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction('restart')}>
              <RotateCcw className="h-3.5 w-3.5" /> إعادة تشغيل
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-fit">
          {TAB_ITEMS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="gap-1.5 text-xs">
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <AppOverviewTab app={app} />
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <FileManager appId={selectedAppId!} />
        </TabsContent>
        <TabsContent value="terminal" className="mt-4">
          <TerminalView appId={selectedAppId!} />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <LogViewer appId={selectedAppId!} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <AppSettings appId={selectedAppId!} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="حذف التطبيق"
        description={`هل أنت متأكد من حذف "${app.name}"؟ سيتم حذف جميع الملفات والإعدادات نهائيًا.`}
        confirmText="حذف"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}
