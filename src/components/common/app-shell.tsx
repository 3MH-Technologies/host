'use client'

import React, { useState } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sun,
  Moon,
  LogOut,
  User,
  Plus,
  Layers,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store/app-store'
import { useAuth } from '@/hooks/use-auth'
import { SimpleAppList } from '@/components/apps/simple-app-list'
import { SimpleAppCreateDialog } from '@/components/apps/simple-app-create'
import { AppDetailView } from '@/components/apps/app-detail-view'
import { ProfileView } from '@/components/profile/profile-view'

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

function TopBar({ onCreateClick }: { onCreateClick: () => void }) {
  const { user, logout } = useAuth()
  const { currentView, setCurrentView } = useAppStore()

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm h-14 shrink-0">
      <div className="h-full max-w-4xl mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="3MH Host" className="h-5 w-5 rounded" />
          <span className="font-bold text-sm">3MH Host</span>
        </div>

        <div className="flex items-center gap-1.5">
          {currentView === 'app-detail' && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setCurrentView('dashboard')}
            >
              <ArrowRight className="h-3.5 w-3.5" />
              التطبيقات
            </Button>
          )}

          {currentView !== 'app-detail' && currentView !== 'app-create' && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={onCreateClick}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">جديد</span>
            </Button>
          )}

          <ThemeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-emerald-500 text-xs font-bold">
                    {(user?.name || user?.email || 'م').charAt(0).toUpperCase()}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{user?.name || 'بدون اسم'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-xs cursor-pointer"
                onClick={() => setCurrentView('profile')}
              >
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
        </div>
      </div>
    </header>
  )
}

const fadeVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

function ViewRouter({ onCreateClick }: { onCreateClick: () => void }) {
  const { currentView, selectedAppId } = useAppStore()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentView + (selectedAppId || '')}
        variants={fadeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {currentView === 'dashboard' || currentView === 'apps' ? (
          <SimpleAppList onCreateClick={onCreateClick} />
        ) : currentView === 'app-detail' && selectedAppId ? (
          <AppDetailView />
        ) : currentView === 'profile' ? (
          <ProfileView />
        ) : (
          <SimpleAppList onCreateClick={onCreateClick} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

export function AppShell() {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar onCreateClick={() => setCreateOpen(true)} />
      <main className="flex-1 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <React.Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
            </div>
          }>
            <ViewRouter onCreateClick={() => setCreateOpen(true)} />
          </React.Suspense>
        </div>
      </main>

      <SimpleAppCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}