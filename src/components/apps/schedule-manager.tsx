'use client'

import { useState } from 'react'
import { useSchedules, useCreateSchedule, useDeleteSchedule } from '@/hooks/use-api'
import { EmptyState } from '@/components/common/empty-state'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Clock, PlusCircle, Trash2, Play, CheckCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

const ACTIONS = [
  { value: 'run_command', label: 'Run Command' },
  { value: 'start_app', label: 'Start App' },
  { value: 'stop_app', label: 'Stop App' },
  { value: 'restart_app', label: 'Restart App' },
]

interface Props {
  appId: string
}

export function ScheduleManager({ appId }: Props) {
  const { data, isLoading, refetch } = useSchedules(appId)
  const createSchedule = useCreateSchedule(appId)
  const deleteSchedule = useDeleteSchedule(appId)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', action: 'run_command', command: '', cronExpr: '', enabled: true })

  const schedules = data?.data || []

  const handleCreate = () => {
    if (!form.name.trim()) return
    createSchedule.mutate({
      name: form.name.trim(),
      action: form.action,
      command: form.action === 'run_command' ? form.command : undefined,
      cronExpr: form.cronExpr || undefined,
      enabled: form.enabled,
    }, {
      onSuccess: () => {
        setCreateOpen(false)
        setForm({ name: '', action: 'run_command', command: '', cronExpr: '', enabled: true })
      },
    })
  }

  const handleDelete = () => {
    if (!deleteId) return
    deleteSchedule.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{schedules.length} schedule(s)</p>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
          <PlusCircle className="h-4 w-4" /> Create Schedule
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : schedules.length === 0 ? (
        <EmptyState icon={Clock} title="No schedules" description="Create scheduled tasks to automate actions." />
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {schedules.map((s) => (
            <div key={s.id} className="p-4 rounded-lg border hover:bg-muted/30 group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{s.name}</span>
                  <Badge variant="outline" className="text-[10px]">{s.action.replace('_', ' ')}</Badge>
                  <Badge variant={s.enabled ? 'default' : 'secondary'} className="text-[10px]">
                    {s.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setDeleteId(s.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {s.cronExpr && <span className="font-mono">{s.cronExpr}</span>}
                {s.lastRunAt && (
                  <span className="flex items-center gap-1">
                    Last: {formatDistanceToNow(new Date(s.lastRunAt), { addSuffix: true })}
                    {s.lastResult === 'success' && <CheckCircle className="h-3 w-3 text-emerald-400" />}
                    {s.lastResult === 'failure' && <XCircle className="h-3 w-3 text-red-400" />}
                  </span>
                )}
                {s.nextRunAt && <span>Next: {formatDistanceToNow(new Date(s.nextRunAt), { addSuffix: true })}</span>}
                {s.lastDuration != null && <span>Duration: {s.lastDuration}ms</span>}
              </div>

              {s.command && (
                <p className="mt-2 text-xs font-mono text-zinc-400 bg-muted rounded p-2">{s.command}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Schedule</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Daily Backup" />
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={form.action} onValueChange={(v) => setForm((f) => ({ ...f, action: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.action === 'run_command' && (
              <div className="space-y-2">
                <Label>Command</Label>
                <Input value={form.command} onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))} placeholder="python backup.py" className="font-mono" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Cron Expression (optional)</Label>
              <Input value={form.cronExpr} onChange={(e) => setForm((f) => ({ ...f, cronExpr: e.target.value }))} placeholder="0 * * * *" className="font-mono" />
              <p className="text-xs text-muted-foreground">Leave empty for manual trigger only</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, enabled: v }))} id="sched-enabled" />
              <Label htmlFor="sched-enabled">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createSchedule.isPending}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Schedule"
        description="Are you sure you want to delete this schedule?"
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}