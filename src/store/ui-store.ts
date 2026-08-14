import { create } from 'zustand'

export interface RecentApp {
  id: string
  name: string
  status: string
}

interface UIState {
  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  toggleCommandPalette: () => void
  recentApps: RecentApp[]
  addRecentApp: (app: RecentApp) => void
}

const MAX_RECENT_APPS = 5

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  recentApps: [],
  addRecentApp: (app) =>
    set((s) => {
      const filtered = s.recentApps.filter((a) => a.id !== app.id)
      return { recentApps: [app, ...filtered].slice(0, MAX_RECENT_APPS) }
    }),
}))
