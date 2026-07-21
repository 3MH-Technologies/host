'use client'

import { useState } from 'react'
import { useEnvVars, useSetEnvVar, useDeleteEnvVar } from '@/hooks/use-api'
import { EmptyState } from '@/components/common/empty-state'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { PlusCircle, Trash2, Eye, EyeOff, Download, Upload, Search, Pencil } from 'lucide-react'
import type { EnvVar } from '@prisma/client'

interface Props {
  appId: string
}

export function EnvEditor({ appId }: Props) {
  const { data, isLoading, refetch } = useEnvVars(appId)
  const setVar = useSetEnvVar(appId)
  const deleteVar = useDeleteEnvVar(appId)

  const [search, setSearch] = useState('')
  const [editKey, setEditKey] = useState('')
  const [editValue, setEditValue] = useState('')
  const [editSecret, setEditSecret] = useState(false)
  const [editScope, setEditScope] = useState('all')
  const [editOpen, setEditOpen] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [deleteKey, setDeleteKey] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  const vars: EnvVar[] = data?.data || []
  const filtered = vars.filter((v) => !search || v.key.toLowerCase().includes(search.toLowerCase()))

  const openNew = () => {
    setEditingKey(null)
    setEditKey('')
    setEditValue('')
    setEditSecret(false)
    setEditScope('all')
    setEditOpen(true)
  }

  const openEdit = (v: EnvVar) => {
    setEditingKey(v.key)
    setEditKey(v.key)
    setEditValue(v.isSecret ? '' : v.value)
    setEditSecret(v.isSecret)
    setEditScope(v.scope)
    setEditOpen(true)
  }

  const handleSave = () => {
    if (!editKey.trim()) return
    setVar.mutate({
      key: editKey.trim(),
      value: editValue,
      isSecret: editSecret,
      scope: editScope,
    }, {
      onSuccess: () => setEditOpen(false),
    })
  }

  const handleDelete = () => {
    if (!deleteKey) return
    deleteVar.mutate(deleteKey, {
      onSuccess: () => setDeleteKey(null),
    })
  }

  const toggleReveal = (key: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleExport = () => {
    const obj: Record<string, string> = {}
    vars.forEach((v) => { obj[v.key] = v.value })
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'env.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string)
        for (const [key, value] of Object.entries(json)) {
          await fetch(`/api/apps/${appId}/env`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value }),
          })
        }
        refetch()
        toast.success(`Imported ${Object.keys(json).length} variables`)
      } catch {
        toast.error('Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search variables..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => document.getElementById('env-import')?.click()}>
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <input id="env-import" type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_1fr_80px_80px_60px] gap-2 px-4 py-2.5 bg-muted/50 text-xs font-medium text-muted-foreground">
          <span>Key</span>
          <span>Value</span>
          <span>Scope</span>
          <span className="text-center">Secret</span>
          <span>Actions</span>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={PlusCircle} title="No environment variables" description="Add variables to configure your application." className="py-8" />
        ) : (
          <div className="max-h-[400px] overflow-y-auto">
            {filtered.map((v) => (
              <div
                key={v.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_80px_80px_60px] gap-2 px-4 py-2.5 items-center text-sm border-t hover:bg-muted/30 group"
              >
                <span className="font-mono text-xs font-semibold truncate">{v.key}</span>
                <span className="font-mono text-xs text-muted-foreground truncate">
                  {v.isSecret && !revealed.has(v.key) ? '••••••••' : v.value}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{v.scope}</span>
                <div className="flex justify-center">
                  {v.isSecret ? (
                    <button onClick={() => toggleReveal(v.key)} className="text-amber-400 hover:text-amber-300">
                      {revealed.has(v.key) ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => setDeleteKey(v.key)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button variant="outline" className="w-full gap-1.5" onClick={openNew}>
        <PlusCircle className="h-4 w-4" /> Add Variable
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingKey ? 'Edit Variable' : 'Add Variable'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input value={editKey} onChange={(e) => setEditKey(e.target.value)} placeholder="VARIABLE_NAME" className="font-mono" disabled={!!editingKey} />
            </div>
            <div className="space-y-2">
              <Label>Value {editingKey && '(leave empty to keep current value)'}</Label>
              <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} type={editSecret ? 'password' : 'text'} className="font-mono" placeholder="value" />
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={editSecret} onCheckedChange={setEditSecret} id="secret-toggle" />
                <Label htmlFor="secret-toggle" className="text-sm">Secret</Label>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground">Scope</Label>
                <Select value={editScope} onValueChange={setEditScope}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="build">Build</SelectItem>
                    <SelectItem value="runtime">Runtime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={setVar.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteKey}
        onOpenChange={(open) => !open && setDeleteKey(null)}
        title="Delete Variable"
        description={`Delete "${deleteKey}"? This cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleDelete}
        variant="destructive"
      />
    </div>
  )
}