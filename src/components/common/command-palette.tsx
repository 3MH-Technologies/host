'use client'

import React, { useEffect, useCallback } from 'react'
import {
  LayoutDashboard,
  Layers,
  PlusCircle,
  ScrollText,
  Play,
  Square,
  RotateCcw,
  Hammer,
  Clock,
  AppWindow,
} from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useAppStore } from '@/store/app-store'
import { useUIStore } from '@/store/ui-store'
import { useLifecycleAction, useApp } from '@/hooks/use-api'

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, recentApps, addRecentApp } = useUIStore()
  const { currentView, selectedAppId, setCurrentView, selectApp } = useAppStore()
  const lifecycleAction = useLifecycleAction()
  const { data: selectedAppData } = useApp(selectedAppId)
  const selectedApp = (selectedAppData?.data as any) ?? null

  const handleRunCommand = useCallback(
    (command: () => void) => {
      command()
      setCommandPaletteOpen(false)
    },
    [setCommandPaletteOpen]
  )

  // Track visited apps in recent list
  useEffect(() => {
    if (selectedAppId && selectedApp && currentView === 'app-detail') {
      addRecentApp({
        id: selectedApp.id,
        name: selectedApp.name,
        status: selectedApp.status,
      })
    }
  }, [selectedAppId, selectedApp, currentView, addRecentApp])

  // Global keyboard listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  const isAppSelected = !!selectedAppId

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
    >
      <CommandInput placeholder="Type a command or search..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>No commands found.</CommandEmpty>

        {/* Navigation group */}
        <CommandGroup heading="Navigation">
          <CommandItem
            onSelect={() =>
              handleRunCommand(() => setCurrentView('dashboard'))
            }
          >
            <LayoutDashboard className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Go to Dashboard</span>
            <CommandShortcut>1</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleRunCommand(() => setCurrentView('apps'))
            }
          >
            <Layers className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Go to Applications</span>
            <CommandShortcut>2</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleRunCommand(() => setCurrentView('audit'))
            }
          >
            <ScrollText className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Go to Audit Logs</span>
            <CommandShortcut>3</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() =>
              handleRunCommand(() => setCurrentView('app-create'))
            }
          >
            <PlusCircle className="mr-2 h-4 w-4 text-emerald-500" />
            <span>Create New App</span>
            <CommandShortcut>4</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* Quick Actions - only if an app is selected */}
        {isAppSelected && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() =>
                  handleRunCommand(() =>
                    lifecycleAction.mutate({ id: selectedAppId!, action: 'start' })
                  )
                }
              >
                <Play className="mr-2 h-4 w-4 text-emerald-500" />
                <span>Start App</span>
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  handleRunCommand(() =>
                    lifecycleAction.mutate({ id: selectedAppId!, action: 'stop' })
                  )
                }
              >
                <Square className="mr-2 h-4 w-4 text-red-500" />
                <span>Stop App</span>
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  handleRunCommand(() =>
                    lifecycleAction.mutate({ id: selectedAppId!, action: 'restart' })
                  )
                }
              >
                <RotateCcw className="mr-2 h-4 w-4 text-amber-500" />
                <span>Restart App</span>
              </CommandItem>
              <CommandItem
                onSelect={() =>
                  handleRunCommand(() =>
                    lifecycleAction.mutate({ id: selectedAppId!, action: 'rebuild' })
                  )
                }
              >
                <Hammer className="mr-2 h-4 w-4 text-blue-500" />
                <span>Rebuild App</span>
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {/* Recent apps - show last 3 */}
        {recentApps.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent">
              {recentApps.slice(0, 3).map((app) => (
                <CommandItem
                  key={app.id}
                  onSelect={() =>
                    handleRunCommand(() => selectApp(app.id))
                  }
                >
                  <AppWindow className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{app.name}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    {app.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>

      {/* Footer hint */}
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            {isAppSelected ? `Acting on: ${selectedApp?.name ?? 'selected app'}` : 'No app selected'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ↑↓
          </kbd>
          <span>navigate</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ↵
          </kbd>
          <span>run</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            esc
          </kbd>
          <span>close</span>
        </div>
      </div>
    </CommandDialog>
  )
}
