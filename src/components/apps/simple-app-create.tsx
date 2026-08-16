'use client'

import { useState, useCallback } from 'react'
import { useCreateApp, useLifecycleAction } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Upload, X, File, FileArchive, Loader2 } from 'lucide-react'
import { APP_TYPE_LABELS, DEFAULT_RUNTIME_COMMANDS, DEFAULT_PYTHON_VERSION, DEFAULT_PHP_VERSION } from '@/lib/constants'
import { APP_TYPES } from '@/lib/types'
import type { AppType, Runtime, CreateAppPayload } from '@/lib/types'

function getRuntimeForType(appType: AppType): Runtime {
  if (appType.startsWith('php')) return 'php'
  return 'python'
}

function getDefaultVersion(runtime: Runtime): string {
  return runtime === 'php' ? DEFAULT_PHP_VERSION : DEFAULT_PYTHON_VERSION
}

export function SimpleAppCreateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { selectApp } = useAppStore()
  const createApp = useCreateApp()
  const lifecycle = useLifecycleAction()

  const [name, setName] = useState('')
  const [appType, setAppType] = useState<AppType>('python-web')
  const [files, setFiles] = useState<File[]>([])
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [runtimeVersion, setRuntimeVersion] = useState(DEFAULT_PYTHON_VERSION)
  const [installCmd, setInstallCmd] = useState('uv pip install -r requirements.txt')
  const [startCmd, setStartCmd] = useState('python3 main.py')
  const [port, setPort] = useState('8080')

  const handleTypeChange = (type: AppType) => {
    setAppType(type)
    const rt = getRuntimeForType(type)
    const ver = getDefaultVersion(rt)
    setRuntimeVersion(ver)
    const defaults = DEFAULT_RUNTIME_COMMANDS[type]
    if (defaults) {
      if (defaults.install) setInstallCmd(defaults.install)
      if (defaults.start) setStartCmd(defaults.start.replace('{port}', '8080'))
    }
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files)
    const zips = dropped.filter((f) => f.name.endsWith('.zip'))
    const others = dropped.filter((f) => !f.name.endsWith('.zip'))
    if (zips.length > 0) setZipFile(zips[0])
    setFiles((prev) => [...prev, ...others])
  }, [])

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('اسم التطبيق مطلوب')
      return
    }
    const runtime = getRuntimeForType(appType)
    const payload: CreateAppPayload = {
      name: name.trim(),
      appType,
      runtime,
      runtimeVersion,
      startCmd: startCmd.trim() || undefined,
      installCmd: installCmd.trim() || undefined,
      port: port ? parseInt(port) : undefined,
      files: files.length > 0 ? files : undefined,
      zipFile: zipFile || undefined,
    }
    try {
      const result = await createApp.mutateAsync(payload)
      const newApp = result.data
      if (newApp) {
        toast.success('تم إنشاء التطبيق!')
        onOpenChange(false)
        selectApp(newApp.id)
      }
    } catch {
      // Error handled in mutation
    }
  }

  const handleClose = () => {
    if (createApp.isPending) return
    onOpenChange(false)
  }

  const totalFiles = files.length + (zipFile ? 1 : 0)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">تطبيق جديد</DialogTitle>
          <DialogDescription className="text-sm">
            أنشئ تطبيقًا جديدًا على Wolf Host
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">اسم التطبيق *</Label>
            <Input placeholder="my-app" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label className="text-xs">نوع التطبيق</Label>
            <Select value={appType} onValueChange={(v) => handleTypeChange(v as AppType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(APP_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label className="text-xs">الملفات</Label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed rounded-lg p-6 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
              onClick={() => document.getElementById('simple-file-input')?.click()}
            >
              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">اسحب الملفات هنا أو انقر للاختيار</p>
              <input id="simple-file-input" type="file" multiple className="hidden" onChange={(e) => {
                const f = Array.from(e.target.files || [])
                const zips = f.filter((x) => x.name.endsWith('.zip'))
                const others = f.filter((x) => !x.name.endsWith('.zip'))
                if (zips.length > 0) setZipFile(zips[0])
                setFiles((prev) => [...prev, ...others])
              }} />
            </div>

            {totalFiles > 0 && (
              <div className="space-y-1.5 max-h-24 overflow-y-auto">
                {zipFile && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-emerald-500/5 border border-emerald-500/10">
                    <FileArchive className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs flex-1 truncate">{zipFile.name}</span>
                    <button onClick={() => setZipFile(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
                  </div>
                )}
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted">
                    <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs flex-1 truncate">{f.name}</span>
                    <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}><X className="h-3 w-3 text-muted-foreground" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advanced (collapsible) */}
          <details className="group">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              إعدادات متقدمة ▾
            </summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">أمر التثبيت</Label>
                <Input value={installCmd} onChange={(e) => setInstallCmd(e.target.value)} dir="ltr" className="text-left font-mono text-xs" placeholder="pip install -r requirements.txt" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">أمر التشغيل</Label>
                <Input value={startCmd} onChange={(e) => setStartCmd(e.target.value)} dir="ltr" className="text-left font-mono text-xs" placeholder="python main.py" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">المنفذ</Label>
                <Input value={port} onChange={(e) => setPort(e.target.value)} dir="ltr" className="text-left text-xs w-24" placeholder="8080" />
              </div>
            </div>
          </details>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={createApp.isPending}>
            إلغاء
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createApp.isPending || !name.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 gap-1.5"
          >
            {createApp.isPending ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> جارٍ الإنشاء...</>
            ) : (
              'إنشاء'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
