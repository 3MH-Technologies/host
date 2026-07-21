'use client'

import { useAuditLogs } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState } from '@/components/common/empty-state'
import { ScrollText, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useAppStore } from '@/store/app-store'
import { useState } from 'react'

const ACTIONS_FILTER = [
  'all',
  'create_app',
  'delete_app',
  'start',
  'stop',
  'restart',
  'rebuild',
  'upload_file',
  'delete_file',
  'install_deps',
  'change_env',
  'update_settings',
  'create_backup',
  'restore_backup',
]

export function AuditView() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('all')

  const { data, isLoading } = useAuditLogs({
    page,
    limit: 20,
    action: actionFilter !== 'all' ? actionFilter : undefined,
  })

  const auditLogs = data?.data || []
  const meta = data?.meta
  const totalPages = meta?.total ? Math.ceil(meta.total / 20) : 1

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">Track all platform activity</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            {ACTIONS_FILTER.map((a) => (
              <SelectItem key={a} value={a}>{a === 'all' ? 'All Actions' : a.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : auditLogs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No audit logs" description="Activity will appear here as you use the platform." />
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <div className="hidden md:grid grid-cols-[160px_140px_1fr_100px_180px] gap-2 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground">
            <span>Timestamp</span>
            <span>Action</span>
            <span>Details</span>
            <span>Status</span>
            <span>Resource</span>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="grid grid-cols-1 md:grid-cols-[160px_140px_1fr_100px_180px] gap-1 md:gap-2 px-4 py-3 text-sm border-t hover:bg-muted/30"
              >
                <span className="text-xs text-muted-foreground">
                  {new Date(log.createdAt).toLocaleString()}
                </span>
                <span className="font-medium text-xs">{log.action?.replace(/_/g, ' ')}</span>
                <span className="text-xs text-muted-foreground truncate">{log.details || '-'}</span>
                <span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
                      log.status === 'success'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    {log.status}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground truncate">{log.resource || '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}