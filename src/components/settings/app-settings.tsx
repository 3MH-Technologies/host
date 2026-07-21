'use client'

import { useState } from 'react'
import { useApp, useUpdateApp } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Save, RotateCcw } from 'lucide-react'
import { APP_TYPE_LABELS } from '@/lib/constants'
import type { UpdateAppPayload, RestartPolicy, HealthCheckType } from '@/lib/types'
import { RESTART_POLICIES, HEALTH_CHECK_TYPES } from '@/lib/types'

function buildFormFromApp(app: any): UpdateAppPayload {
  return {
    name: app.name,
    description: app.description || '',
    appType: app.appType,
    runtime: app.runtime,
    runtimeVersion: app.runtimeVersion,
    entryPoint: app.entryPoint,
    workingDir: app.workingDir,
    installCmd: app.installCmd,
    buildCmd: app.buildCmd,
    startCmd: app.startCmd,
    stopCmd: app.stopCmd,
    restartCmd: app.restartCmd,
    healthCheckCmd: app.healthCheckCmd,
    port: app.port,
    healthCheckType: app.healthCheckType as HealthCheckType,
    healthCheckPath: app.healthCheckPath,
    healthCheckInterval: app.healthCheckInterval,
    healthCheckTimeout: app.healthCheckTimeout,
    healthCheckRetries: app.healthCheckRetries,
    restartPolicy: app.restartPolicy as RestartPolicy,
    maxRestartAttempts: app.maxRestartAttempts,
    restartDelay: app.restartDelay,
    restartBackoff: app.restartBackoff,
    cpuLimit: app.cpuLimit,
    memoryLimit: app.memoryLimit,
    diskLimit: app.diskLimit,
  }
}

interface Props {
  appId: string
}

export function AppSettings({ appId }: Props) {
  const { data, isLoading } = useApp(appId)
  const updateApp = useUpdateApp(appId)
  const app = data?.data

  const buildForm = (): UpdateAppPayload => app ? buildFormFromApp(app) : {}
  const [form, setForm] = useState<UpdateAppPayload>(buildForm)
  const [changed, setChanged] = useState(false)

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setChanged(true)
  }

  const handleSave = () => {
    updateApp.mutate(form, {
      onSuccess: () => { setChanged(false); toast.success('Settings saved') },
    })
  }

  const handleReset = () => {
    if (app) {
      setForm({
        name: app.name, description: app.description || '', appType: app.appType,
        runtime: app.runtime, runtimeVersion: app.runtimeVersion, entryPoint: app.entryPoint,
        workingDir: app.workingDir, installCmd: app.installCmd, buildCmd: app.buildCmd,
        startCmd: app.startCmd, stopCmd: app.stopCmd, restartCmd: app.restartCmd,
        healthCheckCmd: app.healthCheckCmd, port: app.port,
        healthCheckType: app.healthCheckType as HealthCheckType, healthCheckPath: app.healthCheckPath,
        healthCheckInterval: app.healthCheckInterval, healthCheckTimeout: app.healthCheckTimeout,
        healthCheckRetries: app.healthCheckRetries, restartPolicy: app.restartPolicy as RestartPolicy,
        maxRestartAttempts: app.maxRestartAttempts, restartDelay: app.restartDelay,
        restartBackoff: app.restartBackoff, cpuLimit: app.cpuLimit, memoryLimit: app.memoryLimit,
        diskLimit: app.diskLimit,
      })
      setChanged(false)
    }
  }

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-64 w-full" /><Skeleton className="h-48 w-full" /></div>
  }

  if (!app) return null

  return (
    <div className="space-y-4 pb-16">
      <Accordion type="multiple" defaultValue={['general', 'runtime', 'commands', 'networking', 'health', 'restart', 'resources']}>

        <AccordionItem value="general">
          <AccordionTrigger className="text-sm font-medium">General</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name || ''} onChange={(e) => updateField('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description || ''} onChange={(e) => updateField('description', e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>App Type</Label>
              <Select value={form.appType} onValueChange={(v) => updateField('appType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APP_TYPE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="runtime">
          <AccordionTrigger className="text-sm font-medium">Runtime</AccordionTrigger>
          <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Runtime</Label>
              <Select value={form.runtime} onValueChange={(v) => updateField('runtime', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="php">PHP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Version</Label>
              <Input value={form.runtimeVersion || ''} onChange={(e) => updateField('runtimeVersion', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Working Directory</Label>
              <Input value={form.workingDir || '.'} onChange={(e) => updateField('workingDir', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Entry Point</Label>
              <Input value={form.entryPoint || ''} onChange={(e) => updateField('entryPoint', e.target.value)} />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="commands">
          <AccordionTrigger className="text-sm font-medium">Commands</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {[
              { key: 'installCmd', label: 'Install Command' },
              { key: 'buildCmd', label: 'Build Command' },
              { key: 'startCmd', label: 'Start Command' },
              { key: 'stopCmd', label: 'Stop Command' },
              { key: 'restartCmd', label: 'Restart Command' },
              { key: 'healthCheckCmd', label: 'Health Check Command' },
            ].map(({ key, label }) => (
              <div key={key} className="space-y-2">
                <Label>{label}</Label>
                <Input
                  value={(form as any)[key] || ''}
                  onChange={(e) => updateField(key, e.target.value || null)}
                  placeholder="Optional"
                  className="font-mono text-sm"
                />
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="networking">
          <AccordionTrigger className="text-sm font-medium">Networking</AccordionTrigger>
          <AccordionContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Port</Label>
              <Input type="number" value={form.port || ''} onChange={(e) => updateField('port', e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div className="space-y-2">
              <Label>Host</Label>
              <Input value={app.host || '0.0.0.0'} disabled />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="health">
          <AccordionTrigger className="text-sm font-medium">Health Check</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.healthCheckType || 'process'} onValueChange={(v) => updateField('healthCheckType', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(HEALTH_CHECK_TYPES).map(([k]) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.healthCheckType === 'http' && (
              <div className="space-y-2">
                <Label>Health Check Path</Label>
                <Input value={form.healthCheckPath || '/'} onChange={(e) => updateField('healthCheckPath', e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Interval (s)</Label>
                <Input type="number" value={form.healthCheckInterval ?? 30} onChange={(e) => updateField('healthCheckInterval', parseInt(e.target.value) || 30)} />
              </div>
              <div className="space-y-2">
                <Label>Timeout (s)</Label>
                <Input type="number" value={form.healthCheckTimeout ?? 5} onChange={(e) => updateField('healthCheckTimeout', parseInt(e.target.value) || 5)} />
              </div>
              <div className="space-y-2">
                <Label>Retries</Label>
                <Input type="number" value={form.healthCheckRetries ?? 3} onChange={(e) => updateField('healthCheckRetries', parseInt(e.target.value) || 3)} />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="restart">
          <AccordionTrigger className="text-sm font-medium">Restart Policy</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Policy</Label>
              <Select value={form.restartPolicy || 'on-failure'} onValueChange={(v) => updateField('restartPolicy', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RESTART_POLICIES).map(([k]) => <SelectItem key={k} value={k}>{k.replace('-', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max Attempts</Label>
                <Input type="number" value={form.maxRestartAttempts ?? 5} onChange={(e) => updateField('maxRestartAttempts', parseInt(e.target.value) || 5)} />
              </div>
              <div className="space-y-2">
                <Label>Delay (s)</Label>
                <Input type="number" value={form.restartDelay ?? 5} onChange={(e) => updateField('restartDelay', parseInt(e.target.value) || 5)} />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Switch checked={form.restartBackoff ?? true} onCheckedChange={(v) => updateField('restartBackoff', v)} id="backoff" />
                <Label htmlFor="backoff" className="text-sm">Backoff</Label>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="resources">
          <AccordionTrigger className="text-sm font-medium">Resources</AccordionTrigger>
          <AccordionContent className="space-y-6 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>CPU Limit</Label>
                <span className="font-mono text-xs">{(form.cpuLimit || 1).toFixed(1)} cores</span>
              </div>
              <Slider value={[form.cpuLimit || 1]} onValueChange={([v]) => updateField('cpuLimit', v)} min={0.1} max={4} step={0.1} />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <Label>Memory Limit</Label>
                <span className="font-mono text-xs">{form.memoryLimit || 512} MB</span>
              </div>
              <Slider value={[form.memoryLimit || 512]} onValueChange={([v]) => updateField('memoryLimit', v)} min={64} max={4096} step={64} />
            </div>
            <div className="space-y-2">
              <Label>Disk Limit (MB, empty = unlimited)</Label>
              <Input type="number" value={form.diskLimit || ''} onChange={(e) => updateField('diskLimit', e.target.value ? parseInt(e.target.value) : null)} placeholder="Unlimited" />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {changed && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-3 flex justify-end gap-2 z-10">
          <div className="max-w-7xl mx-auto w-full flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateApp.isPending} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}