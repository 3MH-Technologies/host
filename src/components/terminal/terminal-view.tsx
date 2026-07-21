'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Terminal as TerminalIcon, Copy, Trash2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  appId: string
}

export function TerminalView({ appId }: Props) {
  const termRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const socketRef = useRef<Socket | null>(null)
  const fitAddonRef = useRef<any>(null)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)

  const initTerminal = useCallback(async () => {
    if (xtermRef.current) return

    try {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')

      const term = new Terminal({
        theme: {
          background: '#09090b',
          foreground: '#d4d4d8',
          cursor: '#22c55e',
          cursorAccent: '#09090b',
          selectionBackground: 'rgba(34, 197, 94, 0.3)',
        },
        fontFamily: '"Geist Mono", monospace',
        fontSize: 13,
        lineHeight: 1.5,
        cursorBlink: true,
        convertEol: true,
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)

      if (termRef.current) {
        term.open(termRef.current)
        fitAddon.fit()
      }

      term.onData((data: string) => {
        if (socketRef.current?.connected) {
          socketRef.current.emit('terminal:input', { data, appId })
        }
      })

      xtermRef.current = term
      fitAddonRef.current = fitAddon

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        try { fitAddon.fit() } catch {}
      })
      if (termRef.current) resizeObserver.observe(termRef.current)

      return () => resizeObserver.disconnect()
    } catch (err) {
      console.error('Failed to initialize terminal:', err)
      toast.error('Failed to initialize terminal')
    }
  }, [])

  const connectSocket = useCallback(async () => {
    if (socketRef.current?.connected) return

    setConnecting(true)

    await initTerminal()

    const socket = io('/?XTransformPort=3004', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    socket.on('connect', () => {
      setConnected(true)
      setConnecting(false)
      socket.emit('terminal:join', { appId })
      xtermRef.current?.writeln('\x1b[32mConnected to terminal\x1b[0m\r\n')
    })

    socket.on('terminal:output', ({ data }: { data: string }) => {
      xtermRef.current?.write(data)
    })

    socket.on('disconnect', () => {
      setConnected(false)
      xtermRef.current?.writeln('\x1b[31mDisconnected from terminal\x1b[0m\r\n')
    })

    socket.on('connect_error', (err) => {
      setConnecting(false)
      setConnected(false)
      console.error('Terminal connection error:', err)
    })

    socketRef.current = socket
  }, [appId, initTerminal])

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
    setConnected(false)
  }, [])

  useEffect(() => {
    connectSocket()
    return () => {
      disconnect()
      xtermRef.current?.dispose()
      xtermRef.current = null
    }
  }, [appId])

  useEffect(() => {
    const handleResize = () => {
      try { fitAddonRef.current?.fit() } catch {}
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <Card className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b">
        <TerminalIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Terminal</span>
        <div className="flex-1" />
        <div className={cn(
          'flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full',
          connected ? 'text-emerald-400 bg-emerald-500/10' : connecting ? 'text-amber-400 bg-amber-500/10' : 'text-red-400 bg-red-500/10'
        )}>
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {connected ? 'Connected' : connecting ? 'Connecting...' : 'Disconnected'}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => xtermRef.current?.clear()} title="Clear">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => xtermRef.current?.selectAll()} title="Select All">
          <Copy className="h-3.5 w-3.5" />
        </Button>
        {!connected && (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={connectSocket}>
            <RefreshCw className="h-3 w-3" /> Reconnect
          </Button>
        )}
      </div>

      {/* Terminal Container */}
      <div
        ref={termRef}
        className="h-[500px] bg-[#09090b] p-2"
        style={{ overflow: 'hidden' }}
      />

      {/* xterm CSS */}
      <style jsx global>{`
        .xterm { height: 100%; }
        .xterm-viewport { overflow-y: auto !important; }
        .xterm-viewport::-webkit-scrollbar { width: 8px; }
        .xterm-viewport::-webkit-scrollbar-track { background: transparent; }
        .xterm-viewport::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
        .xterm-viewport::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
      `}</style>
    </Card>
  )
}