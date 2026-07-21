'use client'

import { useBackups, useCreateBackup, useRestoreBackup, useDeleteBackup } from '@/hooks/use-api'
import { EmptyState } from '@/components/common/empty-state'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Database, PlusCircle, Download, RotateCcw, Trash2, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  appId: string
}

export function BackupManager({ appId }: Props) {
  const { data, isLoading, refetch } = useBackups(appId)
  const createBackup = useCreateBackup(appId)
  const restoreBackup = useRestoreBackup(appId)
  const deleteBackup = useDeleteBackup(appId)

  const [createOpen, setCreateOpen] = useState(false)
  const [backupName, setBackupName] = useState('')
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const backups = data?.data || []

  const handleCreate = () => {
    createBackup.mutate(
      { name: backupName.trim() || undefined },
      {
        onSuccess: () => {
          setCreateOpen(false)
          setBackupName('')
          // Poll for completion
          const poll = setInterval(() => {
            refetch()
          }, 2000)
          setTimeout(() => clearInterval(poll), 30000)
        },
      }
    )
  }

  const handleRestore = () => {
    if (!restoreId) return
    restoreBackup.mutate(restoreId, {
      onSuccess: () => setRestoreId(null),
    })
  }

  const handleDelete = () => {
    if (!deleteId) return
    deleteBackup.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    })
  }

  const handleDownload = (id: string) => {
    window.open(`/api/apps/${appId}/backups/${id}/download`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{backups.length} backup(s)</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <PlusCircle className="h-4 w-4" /> Create Backup
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : backups.length === 0 ? (
        <EmptyState icon={Database} title="No backups" description="Create your first backup to save your application state." />
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {backups.map((b) => (
            <div key={b.id} className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/30 group">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Database className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">{b.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px]',
                      b.status === 'completed' && 'text-emerald-400 border-emerald-500/20',
                      b.status === 'pending' && 'text-amber-400 border-amber-500/20',
                      b.status === 'creating' && 'text-amber-400 border-amber-500/20',
                      b.status === 'failed' && 'text-red-400 border-red-500/20'
                    )}
                  >
                    {b.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}</span>
                  <span>{formatSize(b.fileSize)}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(b.id)} disabled={b.status !== 'completed'} title="Download">
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRestoreId(b.id)} disabled={b.status !== 'completed'} title="Restore">
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-300" onClick={() => setDeleteId(b.id)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Backup</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Backup Name (optional)</label>
            <Input value={backupName} onChange={(e) => setBackupName(e.target.value)} placeholder="Auto-generated if empty" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createBackup.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!restoreId}
        onOpenChange={(open) => !open && setRestoreId(null)}
        title="Restore Backup"
        description="This will overwrite your current files and settings. Are you sure?"
        confirmText="Restore"
        onConfirm={handleRestore}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Backup"
        description="Are you sure you want to delete this backup?"
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}