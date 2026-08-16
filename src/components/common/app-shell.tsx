'use client'

import React from 'react'
import { useTheme } from 'next-themes'
import {
  LayoutDashboard,
  Layers,
  PlusCircle,
  Sun,
  Moon,
  LogOut,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { useAppStore } from '@/store/app-store'
import { useAuth } from '@/hooks/use-auth'

const NAV_ITEMS = [
  { id: 'dashboard' as const, label: 'لوحة التحكم', icon: LayoutDashboard },
  { id: 'apps' as const, label: 'التطبيقات', icon: Layers },
]

const APP_TABS = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'files', label: 'الملفات' },
  { id: 'terminal', label: 'الطرفية' },
  { id: 'logs', label: 'السجلات' },
  { id: 'settings', label: 'الإعدادات' },
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
      <span className="sr-only">تبديل المظهر</span>
    </Button>
  )
}

function TopBar() {
  const { user, logout } = useAuth()
  const { currentView } = useAppStore()

  const viewLabels: Record<string, string> = {
    dashboard: 'لوحة التحكم',
    apps: 'التطبيقات',
    'app-create': 'إنشاء تطبيق جديد',
    'app-detail': 'تفاصيل التطبيق',
  }

  return (
    <header className="flex h-12 items-center gap-3 border-b bg-background/80 backdrop-blur-sm px-4 shrink-0">
      <SidebarTrigger className="-ml-1" />
      <span className="text-sm font-medium text-muted-foreground">
        {viewLabels[currentView] || 'لوحة التحكم'}
      </span>
      <div className="flex-1" />
      <ThemeToggle />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 gap-2 px-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold">
                {(user?.name || user?.email || 'م').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs hidden sm:inline max-w-[120px] truncate">
              {user?.name || user?.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 text-xs cursor-pointer">
            <User className="h-3.5 w-3.5" />
            الملف الشخصي
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="gap-2 text-xs text-red-500 cursor-pointer">
            <LogOut className="h-3.5 w-3.5" />
            تسجيل الخروج
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

function AppSidebar() {
  const { currentView, setCurrentView, setAppsListPage } = useAppStore()
  const { user } = useAuth()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-500/10">
                <img src="/logo.svg" alt="" className="size-4" />
              </div>
              <div className="grid flex-1 text-right text-sm leading-tight">
                <span className="truncate font-semibold">Wolf Host</span>
                <span className="truncate text-[10px] text-muted-foreground">3MH TECHNOLOGIES</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={currentView === item.id}
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={currentView === 'app-create'}
                  onClick={() => setCurrentView('app-create')}
                  tooltip="إنشاء تطبيق"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>إنشاء تطبيق</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className="bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold">
                {(user?.name || user?.email || 'م').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-[11px] font-medium truncate">{user?.name}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

function AppDetailSidebar() {
  const { selectedAppId, selectedTab, setSelectedTab, setCurrentView } = useAppStore()

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
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-muted">
                ←
              </div>
              <div className="grid flex-1 text-right text-sm leading-tight">
                <span className="truncate font-semibold text-xs">العودة للتطبيقات</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
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
    </Sidebar>
  )
}

function ViewRouter() {
  const { currentView, selectedAppId } = useAppStore()

  if (currentView === 'dashboard') return <DashboardView />
  if (currentView === 'apps') return <AppListView />
  if (currentView === 'app-create') return <AppCreateWizard />
  if (currentView === 'audit') return <AuditView />
  if (currentView === 'app-detail' && selectedAppId) {
    return <AppDetailView />
  }
  return <DashboardView />
}

// Lazy imports
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
          <React.Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
            </div>
          }>
            <ViewRouter />
          </React.Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}