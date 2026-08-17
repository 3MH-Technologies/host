'use client'

import { useAuth } from '@/hooks/use-auth'
import { AppShell } from '@/components/common/app-shell'
import { LandingPage } from '@/components/landing/landing-page'
import { Skeleton } from '@/components/ui/skeleton'

export default function Page() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo.jpg" alt="3MH Host" className="h-10 w-10 rounded-lg animate-pulse" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LandingPage />
  }

  return <AppShell />
}