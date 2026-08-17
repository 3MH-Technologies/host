'use client'

import { useState, useCallback } from 'react'
import { useCreateApp, useLifecycleAction } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Check,
  Upload,
  X,
  File,
  FileArchive,
  Globe,
  Bot,
  Server,
  Code,
  Settings,
} from 'lucide-react'
import { APP_TYPE_LABELS, DEFAULT_RUNTIME_COMMANDS, DEFAULT_PYTHON_VERSION, DEFAULT_PHP_VERSION } from '@/lib/constants'
import { APP_TYPES, RUNTIMES } from '@/lib/types'
import type { AppType, Runtime, CreateAppPayload } from '@/lib/types'
import { cn } from '@/lib/utils'

const STEPS = ['المعلومات', 'الملفات', 'المراجعة']

const APP_TYPE_ICONS: Record<string, React.ElementType> = {
  'python-web': Globe,
  'python-bot': Bot,
  'python-discord-bot': Bot,
  'python-worker': Server,
  'python-api': Code,
  'python-script': Code,
  'php-web': Globe,
  'php-worker': Server,
  'custom': Settings,
}

function getRuntimeForType(appType: AppType): Runtime {
  if (appType.startsWith('php')) return 'php'
  return 'python'
}

function getDefaultVersion(runtime: Runtime): string {
  return runtime === 'php' ? DEFAULT_PHP_VERSION : DEFAULT_PYTHON_VERSION
}

export function AppCreateWizard() {
  const { setCurrentView, selectApp } = useAppStore()
  const createApp = useCreateApp()
  const lifecycle = useLifecycleAction()
  const [step, setStep] = useState(0)
  const [startAfterCreate, setStartAfterCreate] = useState(true)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [appType, setAppType] = useState<AppType>('python-web')
  const [files, setFiles] = useState<File[]>([])
  const [zipFile, setZipFile] = useState<File | null>(null)
  const [runtimeVersion, setRuntimeVersion] = useState(DEFAULT_PYTHON_VERSION)
  const [entryPoint, setEntryPoint] = useState('main.py')
  const [installCmd, setInstallCmd] = useState('pip install -r requirements.txt')
  const [startCmd, setStartCmd] = useState('python main.py')
  const [port, setPort] = useState('8080')

  const runtime = getRuntimeForType(appType)

  const handleTypeChange = (type: AppType) => {
    setAppType(type)
    const rt = getRuntimeForType(type)
    const ver = getDefaultVersion(rt)
    setRuntimeVersion(ver)
    const defaults = DEFAULT_RUNTIME_COMMANDS[type]
    if (defaults) {
      if (defaults.install) setInstallCmd(defaults.install)
      if (defaults.start) setStartCmd(defaults.start.replace('{port}', '8080'))
      setEntryPoint(rt === 'python' ? 'main.py' : 'public/index.php')
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

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index))

  const canNext = () => {
    if (step === 0) return name.trim().length > 0
    return true
  }

  const handleCreate = async () => {
    const payload: CreateAppPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
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
      if (newApp && startAfterCreate) {
        setTimeout(() => lifecycle.mutate({ id: newApp.id, action: 'start' }), 500)
      }
      if (newApp) selectApp(newApp.id)
    } catch {
      // Error handled in mutation
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView('apps')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-bold">إنشاء تطبيق جديد</h1>
          <p className="text-xs text-muted-foreground">نشر تطبيق جديد على 3MH Host</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                i === step ? 'bg-emerald-500/10 text-emerald-500' : i < step ? 'text-emerald-500 cursor-pointer' : 'text-muted-foreground'
              )}
            >
              <span className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px] border',
                i === step ? 'border-emerald-500 bg-emerald-500 text-white' : i < step ? 'border-emerald-500 text-emerald-500' : 'border-muted-foreground/30'
              )}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{s}</span>
            </button>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-5">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم التطبيق *</Label>
                <Input placeholder="my-app" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الوصف</Label>
                <Textarea placeholder="وصف مختصر..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نوع التطبيق</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(APP_TYPE_LABELS).map(([key, label]) => {
                    const Icon = APP_TYPE_ICONS[key] || Settings
                    return (
                      <button
                        key={key}
                        onClick={() => handleTypeChange(key as AppType)}
                        className={cn(
                          'flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors',
                          appType === key ? 'border-emerald-500 bg-emerald-500/5' : 'hover:bg-muted'
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs">{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-emerald-500/50 transition-colors cursor-pointer"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm">اسحب الملفات هنا أو انقر للاختيار</p>
                <p className="text-[11px] text-muted-foreground mt-1">ملفات ZIP سيتم فك ضغطها تلقائيًا</p>
                <input id="file-input" type="file" multiple className="hidden" onChange={(e) => {
                  const f = Array.from(e.target.files || [])
                  const zips = f.filter((x) => x.name.endsWith('.zip'))
                  const others = f.filter((x) => !x.name.endsWith('.zip'))
                  if (zips.length > 0) setZipFile(zips[0])
                  setFiles((prev) => [...prev, ...others])
                }} />
              </div>

              {zipFile && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <FileArchive className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{zipFile.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(zipFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZipFile(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}

              {files.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted">
                      <File className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs flex-1 truncate">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeFile(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">مراجعة</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">الاسم</div><div className="font-medium text-xs">{name}</div>
                <div className="text-muted-foreground">النوع</div><div className="text-xs">{APP_TYPE_LABELS[appType]}</div>
                <div className="text-muted-foreground">البيئة</div><div className="text-xs">{runtime} {runtimeVersion}</div>
                <div className="text-muted-foreground">نقطة الدخول</div><div className="text-xs font-mono">{entryPoint}</div>
                {installCmd && <><div className="text-muted-foreground">التثبيت</div><div className="text-[11px] font-mono break-all">{installCmd}</div></>}
                {startCmd && <><div className="text-muted-foreground">التشغيل</div><div className="text-[11px] font-mono break-all">{startCmd}</div></>}
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={startAfterCreate} onCheckedChange={setStartAfterCreate} id="auto-start" />
                <Label htmlFor="auto-start" className="text-xs">تشغيل التطبيق بعد الإنشاء</Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" size="sm" onClick={() => setCurrentView('apps')} disabled={createApp.isPending}>
          إلغاء
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              السابق
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(step + 1)} disabled={!canNext()}>
              التالي
            </Button>
          ) : (
            <Button size="sm" onClick={handleCreate} disabled={createApp.isPending} className="gap-1.5">
              {createApp.isPending ? (
                <><div className="animate-spin h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full" /> جارٍ الإنشاء...</>
              ) : (
                <><Check className="h-3.5 w-3.5" /> إنشاء</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}