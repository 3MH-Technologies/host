'use client'

import React from 'react'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Layers,
  PlusCircle,
  ScrollText,
  Bell,
  Sun,
  Moon,
  Anvil,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useAppStore } from '@/store/app-store'
import { useNotifications } from '@/hooks/use-api'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
  { id: 'apps' as const, label: 'Applications', icon: Layers },
  { id: 'app-create' as const, label: 'Create New App', icon: PlusCircle },
  { id: 'audit' as const, label: 'Audit Logs', icon: ScrollText },
]

const APP_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'files', label: 'Files' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'logs', label: 'Logs' },
  { id: 'environment', label: 'Environment' },
  { id: 'settings', label: 'Settings' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'backups', label: 'Backups' },
  { id: 'schedules', label: 'Schedules' },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-8 w-8"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}

function NotificationBell() {
  const { data } = useNotifications()
  const unread = (data?.data || []).filter((n) => !n.read).length
  return (
    <Button variant="ghost" size="icon" className="relative h-8 w-8">
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
      <span className="sr-only">Notifications</span>
    </Button>
  )
}

function TopBar() {
  return (
    <header className="flex h-14 items-center gap-2 border-b bg-background px-4 shrink-0">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex items-center gap-1.5 font-semibold text-sm">
        <Anvil className="h-5 w-5 text-emerald-500" />
        <span>HostForge</span>
      </div>
      <div className="flex-1" />
      <NotificationBell />
      <ThemeToggle />
      <Avatar className="h-7 w-7">
        <AvatarFallback className="bg-emerald-500/10 text-emerald-500 text-xs font-semibold">A</AvatarFallback>
      </Avatar>
    </header>
  )
}

function AppSidebar() {
  const { currentView, selectedAppId, selectedTab, setCurrentView, selectApp, setSelectedTab, setAppsListPage } = useAppStore()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <Anvil className="size-4 text-emerald-500" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">HostForge</span>
                <span className="truncate text-xs text-muted-foreground">Hosting Platform</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentView === item.id && !selectedAppId}
                    onClick={() => {
                      setCurrentView(item.id)
                      setAppsListPage(1)
                    }}
                    tooltip={item.label}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-xs text-muted-foreground">
              <span>HostForge v1.0</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function AppDetailSidebar() {
  const { selectedAppId, selectedTab, setSelectedTab, setCurrentView } = useAppStore()
  const { data } = useNotifications()

  if (!selectedAppId) return null

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              onClick={() => setCurrentView('apps')}
              className="cursor-pointer"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <ChevronLeft className="size-4 text-emerald-500" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold text-xs text-muted-foreground">Back to Apps</span>
                <span className="truncate text-xs text-muted-foreground/60">Return to list</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>App Tabs</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {APP_TABS.map((tab) => (
                <SidebarMenuItem key={tab.id}>
                  <SidebarMenuButton
                    isActive={selectedTab === tab.id}
                    onClick={() => setSelectedTab(tab.id)}
                    tooltip={tab.label}
                  >
                    <span className="truncate">{tab.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="text-xs text-muted-foreground">
              <span>HostForge v1.0</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function ViewRouter() {
  const { currentView, selectedAppId, selectedTab } = useAppStore()

  if (currentView === 'dashboard') return <DashboardView />
  if (currentView === 'apps') return <AppListView />
  if (currentView === 'app-create') return <AppCreateWizard />
  if (currentView === 'audit') return <AuditView />
  if (currentView === 'app-detail' && selectedAppId) {
    return <AppDetailView />
  }
  return <DashboardView />
}

// Lazy imports to avoid circular deps
import { DashboardView } from '@/components/dashboard/dashboard-view'
import { AppListView } from '@/components/apps/app-list-view'
import { AppCreateWizard } from '@/components/apps/app-create-wizard'
import { AppDetailView } from '@/components/apps/app-detail-view'
import { AuditView } from '@/components/common/audit-view'

export function AppShell() {
  const { selectedAppId } = useAppStore()

  return (
    <SidebarProvider>
      {selectedAppId ? <AppDetailSidebar /> : <AppSidebar />}
      <SidebarInset>
        <TopBar />
        <main className="flex-1 overflow-auto">
          <React.Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>}>
            <ViewRouter />
          </React.Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}