'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useLogs, useClearLogs } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/common/empty-state'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { FileText, Search, Trash2, Download, ArrowDown, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const LOG_SOURCES = [
  { value: 'app', label: 'App' },
  { value: 'system', label: 'System' },
  { value: 'build', label: 'Build' },
  { value: 'install', label: 'Install' },
]

interface Props {
  appId: string
}

export function LogViewer({ appId }: Props) {
  const [source, setSource] = useState('app')
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [clearOpen, setClearOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch } = useLogs(appId, source, 500)
  const clearLogs = useClearLogs(appId)

  const allLogs = ((data?.data as any)?.lines || [])
  const logs = allLogs.filter((l: any) =>
    !search || l.message.toLowerCase().includes(search.toLowerCase())
  )

  // Auto scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const handleDownload = () => {
    const text = allLogs.map((l: any) => `[${l.timestamp}] [${l.level?.toUpperCase()}] ${l.message}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${source}-logs.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="w-full sm:w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOG_SOURCES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter logs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAutoScroll(!autoScroll)}>
            <ArrowDown className="h-3.5 w-3.5" /> {autoScroll ? 'Following' : 'Paused'}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setClearOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Log display */}
      <div
        ref={scrollRef}
        className="bg-zinc-950 rounded-lg border overflow-y-auto font-mono text-xs p-4 space-y-0.5"
        style={{ height: '520px' }}
      >
        {isLoading ? (
          <div className="text-zinc-500 text-center py-8">Loading logs...</div>
        ) : logs.length === 0 ? (
          <EmptyState icon={FileText} title="No logs" description="No log entries found." className="py-16" />
        ) : (
          logs.map((log: any, i: number) => (
            <div
              key={i}
              className={cn(
                'leading-relaxed',
                log.level === 'error' && 'text-red-400',
                log.level === 'warn' && 'text-amber-400',
                log.level === 'debug' && 'text-zinc-500',
                (!log.level || log.level === 'info') && 'text-zinc-300'
              )}
            >
              <span className="text-zinc-600">{log.timestamp?.slice(11, 23)}</span>{' '}
              <span className={cn(
                'inline-block w-12',
                log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-zinc-500'
              )}>
                {(log.level || 'info').toUpperCase().padEnd(5)}
              </span>{' '}
              {log.message}
            </div>
          ))
        )}
      </div>

      {/* Scroll to bottom button */}
      {!autoScroll && (
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-20 right-8 gap-1.5 shadow-lg z-10"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-3.5 w-3.5" /> Jump to Bottom
        </Button>
      )}

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear Logs"
        description="Are you sure you want to clear all logs for this source?"
        confirmText="Clear"
        onConfirm={() => clearLogs.mutate(source, { onSuccess: () => setClearOpen(false) })}
        variant="destructive"
      />
    </div>
  )
}