'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApp, useLifecycleAction, useDeleteApp, useMonitoring, useLogs } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import { StatusBadge } from '@/components/common/status-badge'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Play, Square, RotateCcw, Hammer, Trash2, ArrowLeft, RefreshCw,
  Terminal, FileText, FolderOpen, Settings, Activity, Shield, Clock, Database,
} from 'lucide-react'
import { APP_TYPE_LABELS } from '@/lib/constants'
import { ACTIVE_STATES, TRANSIENT_STATES, APP_STATUS } from '@/lib/types'
import { AppOverviewTab } from './app-overview-tab'
import { FileManager } from '@/components/files/file-manager'
import { TerminalView } from '@/components/terminal/terminal-view'
import { LogViewer } from '@/components/logs/log-viewer'
import { EnvEditor } from '@/components/settings/env-editor'
import { AppSettings } from '@/components/settings/app-settings'
import { MonitoringView } from '@/components/monitoring/monitoring-view'
import { BackupManager } from './backup-manager'
import { ScheduleManager } from './schedule-manager'

const TAB_ITEMS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'environment', label: 'Environment', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'monitoring', label: 'Monitoring', icon: Activity },
  { id: 'backups', label: 'Backups', icon: Database },
  { id: 'schedules', label: 'Schedules', icon: Clock },
]

export function AppDetailView() {
  const { selectedAppId, selectedTab, setSelectedTab, setCurrentView } = useAppStore()
  const { data, isLoading } = useApp(selectedAppId)
  const lifecycle = useLifecycleAction()
  const deleteApp = useDeleteApp()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const app = data?.data
  const isTransient = app ? TRANSIENT_STATES.includes(app.status) : false

  // Reset tab when switching apps
  useEffect(() => {
    setSelectedTab('overview')
  }, [selectedAppId, setSelectedTab])

  const handleAction = (action: string) => {
    if (isTransient) {
      toast.info('App is currently transitioning. Please wait.')
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
      <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!app) {
    return (
      <div className="p-4 md:p-6 text-center text-muted-foreground">
        Application not found
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView('apps')} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{app.name}</h1>
              <StatusBadge status={app.status} />
              <Badge variant="outline" className="text-[10px]">{APP_TYPE_LABELS[app.appType] || app.appType}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {app.runtime} {app.runtimeVersion} {app.port ? `· Port ${app.port}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {app.status !== APP_STATUS.RUNNING && !isTransient && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction('start')}>
              <Play className="h-3.5 w-3.5" /> Start
            </Button>
          )}
          {app.status === APP_STATUS.RUNNING && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction('stop')}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          )}
          {!isTransient && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction('restart')}>
              <RotateCcw className="h-3.5 w-3.5" /> Restart
            </Button>
          )}
          {!isTransient && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAction('rebuild')}>
              <Hammer className="h-3.5 w-3.5" /> Rebuild
            </Button>
          )}
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      </div>

      {/* Tabs - mobile friendly, horizontal scroll */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
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
          <TabsContent value="environment" className="mt-4">
            <EnvEditor appId={selectedAppId!} />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <AppSettings appId={selectedAppId!} />
          </TabsContent>
          <TabsContent value="monitoring" className="mt-4">
            <MonitoringView appId={selectedAppId!} />
          </TabsContent>
          <TabsContent value="backups" className="mt-4">
            <BackupManager appId={selectedAppId!} />
          </TabsContent>
          <TabsContent value="schedules" className="mt-4">
            <ScheduleManager appId={selectedAppId!} />
          </TabsContent>
        </Tabs>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Application"
        description={`Are you sure you want to delete "${app.name}"? This will permanently remove all files, configurations, and data. This action cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}