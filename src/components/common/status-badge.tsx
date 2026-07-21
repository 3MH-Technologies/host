'use client'

import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS } from '@/lib/constants'
import { TRANSIENT_STATES } from '@/lib/types'
import type { AppStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: AppStatus
  className?: string
  showDot?: boolean
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const isTransient = TRANSIENT_STATES.includes(status)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        STATUS_COLORS[status] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full shrink-0',
            status === 'RUNNING' && 'bg-emerald-500',
            status === 'CRASHED' && 'bg-red-500',
            status === 'FAILED' && 'bg-red-500',
            status === 'STOPPED' && 'bg-zinc-500',
            (status === 'STARTING' || status === 'RESTARTING') && 'bg-sky-500',
            isTransient && 'animate-pulse bg-amber-500'
          )}
        />
      )}
      {STATUS_LABELS[status] || status}
    </span>
  )
}