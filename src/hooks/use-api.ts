'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Application, AuditLog, Notification, EnvVar, Backup, Schedule } from '@prisma/client'
import type {
  ApiResponse,
  PaginationParams,
  CreateAppPayload,
  UpdateAppPayload,
  SystemStats,
  AppStats,
  FileEntry,
  LogEntry,
} from '@/lib/types'

async function apiFetch<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(err?.error?.message || `Request failed: ${res.status}`)
  }
  return res.json()
}

export function useApps(params: PaginationParams = {}) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  if (params.search) q.set('search', params.search)
  if (params.status) q.set('status', params.status)
  if (params.sort) q.set('sort', params.sort)
  if (params.order) q.set('order', params.order)
  return useQuery({
    queryKey: ['apps', params],
    queryFn: () => apiFetch<Application[]>(`/api/apps?${q.toString()}`),
  })
}

export function useApp(id: string | null) {
  return useQuery({
    queryKey: ['app', id],
    queryFn: () => apiFetch<Application & { envVars?: EnvVar[] }>(`/api/apps/${id}`),
    enabled: !!id,
    refetchInterval: 5000,
  })
}

export function useCreateApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreateAppPayload) => {
      const formData = new FormData()
      formData.append('data', JSON.stringify({
        name: payload.name, appType: payload.appType, runtime: payload.runtime,
        runtimeVersion: payload.runtimeVersion, description: payload.description,
        startCmd: payload.startCmd, installCmd: payload.installCmd, buildCmd: payload.buildCmd,
        port: payload.port, envVars: payload.envVars,
      }))
      if (payload.zipFile) formData.append('zipFile', payload.zipFile)
      if (payload.files) payload.files.forEach((f) => formData.append('files', f))
      const res = await fetch('/api/apps', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
        throw new Error(err?.error?.message || 'Failed to create app')
      }
      return res.json() as Promise<ApiResponse<Application>>
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apps'] }); toast.success('Application created successfully') },
    onError: (err) => toast.error(err.message),
  })
}

export function useUpdateApp(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateAppPayload) => apiFetch<Application>(`/api/apps/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['app', id] }); qc.invalidateQueries({ queryKey: ['apps'] }); toast.success('Application updated') },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteApp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/apps/${id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apps'] }); toast.success('Application deleted') },
    onError: (err) => toast.error(err.message),
  })
}

export function useLifecycleAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => apiFetch(`/api/apps/${id}/lifecycle?action=${action}`, { method: 'POST' }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['app', vars.id] }); qc.invalidateQueries({ queryKey: ['apps'] }); toast.success(`${vars.action.charAt(0).toUpperCase() + vars.action.slice(1)} initiated`) },
    onError: (err) => toast.error(err.message),
  })
}

export function useSystemStats() {
  return useQuery({ queryKey: ['system', 'stats'], queryFn: () => apiFetch<SystemStats>('/api/system?action=stats'), refetchInterval: 5000 })
}

export function useAuditLogs(params: PaginationParams = {}) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  if (params.sort) q.set('sort', params.sort)
  if (params.order) q.set('order', params.order)
  return useQuery({ queryKey: ['audit', params], queryFn: () => apiFetch<AuditLog[]>(`/api/audit?${q.toString()}`) })
}

export function useFiles(appId: string | null, path: string = '/') {
  return useQuery({
    queryKey: ['files', appId, path],
    queryFn: () => apiFetch<FileEntry[]>(`/api/apps/${appId}/files?path=${encodeURIComponent(path)}`),
    enabled: !!appId,
  })
}

export function useUploadFiles(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ files, path }: { files: File[]; path: string }) => {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      formData.append('path', path)
      const res = await fetch(`/api/apps/${appId}/files/upload`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      return res.json()
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', appId] }); toast.success('Files uploaded') },
    onError: () => toast.error('Upload failed'),
  })
}

export function useCreateDirectory(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path, name }: { path: string; name: string }) => apiFetch(`/api/apps/${appId}/files/mkdir`, { method: 'POST', body: JSON.stringify({ path, name }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', appId] }); toast.success('Directory created') },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteFile(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (filePath: string) => apiFetch(`/api/apps/${appId}/files?path=${encodeURIComponent(filePath)}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', appId] }); toast.success('Deleted') },
    onError: (err) => toast.error(err.message),
  })
}

export function useWriteFile(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) => apiFetch(`/api/apps/${appId}/files/write`, { method: 'POST', body: JSON.stringify({ path, content }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', appId] }); toast.success('File saved') },
    onError: (err) => toast.error(err.message),
  })
}

export function useRenameFile(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) => apiFetch(`/api/apps/${appId}/files/rename`, { method: 'POST', body: JSON.stringify({ oldPath, newPath }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['files', appId] }); toast.success('Renamed') },
    onError: (err) => toast.error(err.message),
  })
}

export function useEnvVars(appId: string | null) {
  return useQuery({ queryKey: ['env', appId], queryFn: () => apiFetch<EnvVar[]>(`/api/apps/${appId}/env`), enabled: !!appId })
}

export function useSetEnvVar(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { key: string; value: string; isSecret?: boolean; scope?: string }) => apiFetch(`/api/apps/${appId}/env`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['env', appId] }); toast.success('Environment variable saved') },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteEnvVar(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => apiFetch(`/api/apps/${appId}/env?key=${encodeURIComponent(key)}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['env', appId] }); toast.success('Variable deleted') },
    onError: (err) => toast.error(err.message),
  })
}

export function useLogs(appId: string | null, source: string = 'app', tail: number = 200) {
  return useQuery({
    queryKey: ['logs', appId, source],
    queryFn: () => apiFetch<LogEntry[]>(`/api/apps/${appId}/logs?source=${source}&tail=${tail}`),
    enabled: !!appId,
    refetchInterval: 2000,
  })
}

export function useClearLogs(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (source: string) => apiFetch(`/api/apps/${appId}/logs?source=${source}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['logs', appId] }); toast.success('Logs cleared') },
    onError: (err) => toast.error(err.message),
  })
}

export function useMonitoring(appId: string | null) {
  return useQuery({ queryKey: ['monitoring', appId], queryFn: () => apiFetch<AppStats>(`/api/apps/${appId}/monitoring`), enabled: !!appId, refetchInterval: 2000 })
}

export function useBackups(appId: string | null) {
  return useQuery({ queryKey: ['backups', appId], queryFn: () => apiFetch<Backup[]>(`/api/apps/${appId}/backups`), enabled: !!appId })
}

export function useCreateBackup(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data?: { name?: string }) => apiFetch(`/api/apps/${appId}/backups`, { method: 'POST', body: JSON.stringify(data || {}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups', appId] }); toast.success('Backup created') },
    onError: (err) => toast.error(err.message),
  })
}

export function useRestoreBackup(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (backupId: string) => apiFetch(`/api/apps/${appId}/backups/${backupId}/restore`, { method: 'POST' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups', appId] }); toast.success('Backup restored') },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteBackup(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (backupId: string) => apiFetch(`/api/apps/${appId}/backups/${backupId}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backups', appId] }); toast.success('Backup deleted') },
    onError: (err) => toast.error(err.message),
  })
}

export function useSchedules(appId: string | null) {
  return useQuery({ queryKey: ['schedules', appId], queryFn: () => apiFetch<Schedule[]>(`/api/apps/${appId}/schedules`), enabled: !!appId })
}

export function useCreateSchedule(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; action: string; command?: string; cronExpr?: string; cronKind?: string; enabled?: boolean }) => apiFetch(`/api/apps/${appId}/schedules`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules', appId] }); toast.success('Schedule created') },
    onError: (err) => toast.error(err.message),
  })
}

export function useDeleteSchedule(appId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (scheduleId: string) => apiFetch(`/api/apps/${appId}/schedules/${scheduleId}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules', appId] }); toast.success('Schedule deleted') },
    onError: (err) => toast.error(err.message),
  })
}

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: () => apiFetch<Notification[]>('/api/notifications'), refetchInterval: 10000 })
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids?: string[]) => apiFetch('/api/notifications', { method: 'PATCH', body: JSON.stringify({ ids }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })
}