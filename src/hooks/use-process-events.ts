'use client'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getProcessSocket } from '@/lib/socket'
import { toast } from 'sonner'

export function useProcessEvents(appId: string | null) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!appId) return
    const socket = getProcessSocket()

    const onStarted = (data: any) => {
      if (data.appId === appId) {
        qc.invalidateQueries({ queryKey: ['app', appId] })
        qc.invalidateQueries({ queryKey: ['apps'] })
        toast.success('Process started')
      }
    }
    const onStopped = (data: any) => {
      if (data.appId === appId) {
        qc.invalidateQueries({ queryKey: ['app', appId] })
        qc.invalidateQueries({ queryKey: ['apps'] })
        toast.info('Process stopped')
      }
    }
    const onCrashed = (data: any) => {
      if (data.appId === appId) {
        qc.invalidateQueries({ queryKey: ['app', appId] })
        qc.invalidateQueries({ queryKey: ['apps'] })
        toast.error(`Process crashed: ${data.error || 'Unknown error'}`)
      }
    }
    const onStats = (data: any) => {
      if (data.appId === appId) {
        qc.invalidateQueries({ queryKey: ['monitoring', appId] })
      }
    }
    const onCrashLoop = (data: any) => {
      if (data.appId === appId) {
        toast.error('Crash loop detected! Auto-restart disabled.')
        qc.invalidateQueries({ queryKey: ['app', appId] })
      }
    }

    socket.on('process:started', onStarted)
    socket.on('process:stopped', onStopped)
    socket.on('process:crashed', onCrashed)
    socket.on('process:stats', onStats)
    socket.on('process:crash-loop-detected', onCrashLoop)

    return () => {
      socket.off('process:started', onStarted)
      socket.off('process:stopped', onStopped)
      socket.off('process:crashed', onCrashed)
      socket.off('process:stats', onStats)
      socket.off('process:crash-loop-detected', onCrashLoop)
    }
  }, [appId, qc])
}
