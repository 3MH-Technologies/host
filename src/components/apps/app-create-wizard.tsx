'use client'

import { useState, useCallback } from 'react'
import { useCreateApp, useLifecycleAction } from '@/hooks/use-api'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Upload,
  X,
  File,
  FileArchive,
  Code,
  Bot,
  Globe,
  Server,
  Cpu,
  Settings,
  Eye,
  Trash2,
  PlusCircle,
} from 'lucide-react'
import { APP_TYPE_LABELS, DEFAULT_RUNTIME_COMMANDS, DEFAULT_PYTHON_VERSION, DEFAULT_PHP_VERSION } from '@/lib/constants'
import { APP_TYPES, RUNTIMES, RESTART_POLICIES, HEALTH_CHECK_TYPES } from '@/lib/types'
import type { AppType, Runtime, CreateAppPayload } from '@/lib/types'
import { cn } from '@/lib/utils'

const STEPS = ['Basic Info', 'Upload Files', 'Configuration', 'Advanced', 'Review']

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

  // Step 1: Basic Info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [appType, setAppType] = useState<AppType>('python-web')

  // Step 2: Files
  const [files, setFiles] = useState<File[]>([])
  const [zipFile, setZipFile] = useState<File | null>(null)

  // Step 3: Configuration
  const [runtimeVersion, setRuntimeVersion] = useState(DEFAULT_PYTHON_VERSION)
  const [entryPoint, setEntryPoint] = useState('main.py')
  const [installCmd, setInstallCmd] = useState('pip install -r requirements.txt')
  const [buildCmd, setBuildCmd] = useState('')
  const [startCmd, setStartCmd] = useState('python main.py')
  const [port, setPort] = useState('8080')
  const [envVars, setEnvVars] = useState<{ key: string; value: string; isSecret: boolean }[]>([])

  // Step 4: Advanced
  const [restartPolicy, setRestartPolicy] = useState('on-failure')
  const [healthCheckType, setHealthCheckType] = useState('process')
  const [healthCheckPath, setHealthCheckPath] = useState('/')
  const [healthCheckInterval, setHealthCheckInterval] = useState(30)
  const [healthCheckTimeout, setHealthCheckTimeout] = useState(5)
  const [healthCheckRetries, setHealthCheckRetries] = useState(3)
  const [cpuLimit, setCpuLimit] = useState(1.0)
  const [memoryLimit, setMemoryLimit] = useState(512)

  const runtime = getRuntimeForType(appType)

  const handleTypeChange = (type: AppType) => {
    setAppType(type)
    const rt = getRuntimeForType(type)
    const ver = getDefaultVersion(rt)
    setRuntimeVersion(ver)
    const defaults = DEFAULT_RUNTIME_COMMANDS[type]
    if (defaults) {
      if (defaults.install) setInstallCmd(defaults.install)
      if (defaults.start) {
        const startWithPort = defaults.start.replace('{port}', '8080')
        setStartCmd(startWithPort)
      }
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

  const addEnvVar = () => setEnvVars((prev) => [...prev, { key: '', value: '', isSecret: false }])
  const removeEnvVar = (index: number) => setEnvVars((prev) => prev.filter((_, i) => i !== index))
  const updateEnvVar = (index: number, field: 'key' | 'value' | 'isSecret', val: string | boolean) => {
    setEnvVars((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: val } : v)))
  }

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
      buildCmd: buildCmd.trim() || undefined,
      port: port ? parseInt(port) : undefined,
      envVars: envVars.filter((v) => v.key.trim()),
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setCurrentView('apps')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Application</h1>
          <p className="text-sm text-muted-foreground">Deploy a new application to Wolf Host</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => i < step && setStep(i)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                i === step ? 'bg-emerald-500/10 text-emerald-500' : i < step ? 'text-emerald-500 cursor-pointer hover:bg-emerald-500/5' : 'text-muted-foreground'
              )}
            >
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] border', i === step ? 'border-emerald-500 bg-emerald-500 text-white' : i < step ? 'border-emerald-500 text-emerald-500' : 'border-muted-foreground/30')}>
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
        <CardContent className="p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Application Name *</Label>
                <Input placeholder="my-awesome-app" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Brief description of your application..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Application Type</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(APP_TYPE_LABELS).map(([key, label]) => {
                    const Icon = APP_TYPE_ICONS[key] || Settings
                    return (
                      <button
                        key={key}
                        onClick={() => handleTypeChange(key as AppType)}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border text-left text-sm transition-colors',
                          appType === key ? 'border-emerald-500 bg-emerald-500/5' : 'hover:bg-muted'
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
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
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Drag & drop files here, or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">ZIP files will be extracted automatically</p>
                <input id="file-input" type="file" multiple className="hidden" onChange={(e) => {
                  const f = Array.from(e.target.files || [])
                  const zips = f.filter((x) => x.name.endsWith('.zip'))
                  const others = f.filter((x) => !x.name.endsWith('.zip'))
                  if (zips.length > 0) setZipFile(zips[0])
                  setFiles((prev) => [...prev, ...others])
                }} />
              </div>

              {zipFile && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <FileArchive className="h-5 w-5 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{zipFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(zipFile.size / 1024).toFixed(1)} KB - Will be extracted</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZipFile(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {files.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                      <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Runtime</Label>
                  <Select value={runtime} disabled>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="php">PHP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Version</Label>
                  <Input value={runtimeVersion} onChange={(e) => setRuntimeVersion(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Entry Point</Label>
                <Input value={entryPoint} onChange={(e) => setEntryPoint(e.target.value)} placeholder="main.py" />
              </div>
              <div className="space-y-2">
                <Label>Install Command</Label>
                <Input value={installCmd} onChange={(e) => setInstallCmd(e.target.value)} placeholder="pip install -r requirements.txt" />
              </div>
              <div className="space-y-2">
                <Label>Build Command</Label>
                <Input value={buildCmd} onChange={(e) => setBuildCmd(e.target.value)} placeholder="npm run build" />
              </div>
              <div className="space-y-2">
                <Label>Start Command</Label>
                <Input value={startCmd} onChange={(e) => setStartCmd(e.target.value)} placeholder="python main.py" />
              </div>
              {(appType.includes('web') || appType.includes('api')) && (
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input type="number" value={port} onChange={(e) => setPort(e.target.value)} placeholder="8080" />
                </div>
              )}

              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Environment Variables</Label>
                  <Button variant="outline" size="sm" onClick={addEnvVar} className="gap-1">
                    <PlusCircle className="h-3 w-3" /> Add
                  </Button>
                </div>
                {envVars.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input placeholder="KEY" value={ev.key} onChange={(e) => updateEnvVar(i, 'key', e.target.value)} className="flex-1 font-mono text-sm" />
                    <Input placeholder="value" value={ev.value} onChange={(e) => updateEnvVar(i, 'value', e.target.value)} className="flex-1 font-mono text-sm" type={ev.isSecret ? 'password' : 'text'} />
                    <Switch checked={ev.isSecret} onCheckedChange={(v) => updateEnvVar(i, 'isSecret', v)} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeEnvVar(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Restart Policy</Label>
                <Select value={restartPolicy} onValueChange={setRestartPolicy}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="always">Always</SelectItem>
                    <SelectItem value="on-failure">On Failure</SelectItem>
                    <SelectItem value="never">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Health Check Type</Label>
                <Select value={healthCheckType} onValueChange={setHealthCheckType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="process">Process</SelectItem>
                    <SelectItem value="port">Port</SelectItem>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="command">Command</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {healthCheckType === 'http' && (
                <div className="space-y-2">
                  <Label>Health Check Path</Label>
                  <Input value={healthCheckPath} onChange={(e) => setHealthCheckPath(e.target.value)} placeholder="/health" />
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Interval (s)</Label>
                  <Input type="number" value={healthCheckInterval} onChange={(e) => setHealthCheckInterval(parseInt(e.target.value) || 30)} />
                </div>
                <div className="space-y-2">
                  <Label>Timeout (s)</Label>
                  <Input type="number" value={healthCheckTimeout} onChange={(e) => setHealthCheckTimeout(parseInt(e.target.value) || 5)} />
                </div>
                <div className="space-y-2">
                  <Label>Retries</Label>
                  <Input type="number" value={healthCheckRetries} onChange={(e) => setHealthCheckRetries(parseInt(e.target.value) || 3)} />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <Label className="text-base font-semibold">Resource Limits</Label>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>CPU Limit</span>
                    <span className="font-mono">{cpuLimit.toFixed(1)} cores</span>
                  </div>
                  <Slider value={[cpuLimit]} onValueChange={([v]) => setCpuLimit(v)} min={0.1} max={4} step={0.1} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Memory Limit</span>
                    <span className="font-mono">{memoryLimit} MB</span>
                  </div>
                  <Slider value={[memoryLimit]} onValueChange={([v]) => setMemoryLimit(v)} min={64} max={4096} step={64} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Review Configuration</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="text-muted-foreground">Name</div><div className="font-medium">{name}</div>
                <div className="text-muted-foreground">Type</div><div>{APP_TYPE_LABELS[appType]}</div>
                <div className="text-muted-foreground">Runtime</div><div>{runtime} {runtimeVersion}</div>
                <div className="text-muted-foreground">Entry Point</div><div className="font-mono text-xs">{entryPoint}</div>
                {installCmd && <><div className="text-muted-foreground">Install</div><div className="font-mono text-xs">{installCmd}</div></>}
                {startCmd && <><div className="text-muted-foreground">Start</div><div className="font-mono text-xs">{startCmd}</div></>}
                {port && <><div className="text-muted-foreground">Port</div><div>{port}</div></>}
                <div className="text-muted-foreground">Restart Policy</div><div className="capitalize">{restartPolicy.replace('-', ' ')}</div>
                <div className="text-muted-foreground">CPU</div><div>{cpuLimit.toFixed(1)} cores</div>
                <div className="text-muted-foreground">Memory</div><div>{memoryLimit} MB</div>
              </div>
              {envVars.length > 0 && (
                <div className="space-y-2">
                  <Label>Environment Variables ({envVars.length})</Label>
                  <div className="rounded-lg bg-muted p-3 space-y-1">
                    {envVars.map((ev, i) => (
                      <div key={i} className="text-xs font-mono flex items-center gap-2">
                        <span className="font-semibold">{ev.key}</span>=<span>{ev.isSecret ? '••••••' : ev.value}</span>
                        {ev.isSecret && <Badge variant="outline" className="text-[10px] h-4">secret</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-2">
                <Switch checked={startAfterCreate} onCheckedChange={setStartAfterCreate} id="auto-start" />
                <Label htmlFor="auto-start" className="text-sm">Start application after creation</Label>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentView('apps')} disabled={step === 0 && createApp.isPending}>
          Cancel
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext()}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={createApp.isPending} className="gap-2">
              {createApp.isPending ? (
                <><div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> Creating...</>
              ) : (
                <><Check className="h-4 w-4" /> Create {startAfterCreate ? '& Start' : ''}</>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}