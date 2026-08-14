'use client'

import React from 'react'
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useNotifications, useMarkNotificationsRead } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import type { Notification } from '@prisma/client'

const LEVEL_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-l-blue-500',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-l-amber-500',
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-l-red-500',
  },
  critical: {
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-l-red-500',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-l-emerald-500',
  },
}

function getLevelConfig(level: string) {
  return LEVEL_CONFIG[level] || LEVEL_CONFIG.info
}

function NotificationItem({ notification }: { notification: Notification }) {
  const config = getLevelConfig(notification.level)
  const Icon = config.icon
  const isUnread = !notification.read

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50 cursor-default',
        isUnread && 'bg-muted/30 border-l-2 ' + config.border,
      )}
    >
      <div className={cn('mt-0.5 shrink-0', config.bg, 'rounded-md p-1.5')}>
        <Icon className={cn('h-3.5 w-3.5', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn('text-sm font-medium leading-tight truncate', isUnread && 'text-foreground')}>
            {notification.title}
          </p>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}

export function NotificationPanel() {
  const { data } = useNotifications()
  const markRead = useMarkNotificationsRead()
  const { setCurrentView } = useAppStore()
  const [open, setOpen] = React.useState(false)

  const notifications = (data?.data || []) as Notification[]
  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length > 0) {
      markRead.mutate(unreadIds)
    }
  }

  const handleViewAll = () => {
    setOpen(false)
    setCurrentView('audit')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 sm:w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
              disabled={markRead.isPending}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <Separator />

        {/* Notification List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground/60 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-border/50">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          </ScrollArea>
        )}

        <Separator />

        {/* Footer */}
        <div className="px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-8 text-xs text-muted-foreground hover:text-foreground justify-center gap-1.5"
            onClick={handleViewAll}
          >
            View all activity
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
