import { create } from 'zustand'
import type {
  ViewType,
  CreateAppPayload,
  UpdateAppPayload,
  PaginationParams,
  ApiResponse,
} from '@/lib/types'
import type { Application, AuditLog, Notification, EnvVar } from '@prisma/client'

// Extended Application type with envVars included
export type ApplicationWithRelations = Application & {
  envVars?: EnvVar[]
}

interface AppState {
  // Navigation
  currentView: ViewType
  selectedAppId: string | null
  selectedTab: string
  setCurrentView: (view: ViewType) => void
  selectApp: (id: string | null) => void
  setSelectedTab: (tab: string) => void

  // UI helpers
  appsListPage: number
  appsListSearch: string
  appsListStatus: string | null
  setAppsListPage: (page: number) => void
  setAppsListSearch: (search: string) => void
  setAppsListStatus: (status: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedAppId: null,
  selectedTab: 'overview',
  setCurrentView: (view) => set({ currentView: view, selectedAppId: null, selectedTab: 'overview' }),
  selectApp: (id) => set({ selectedAppId: id, currentView: 'app-detail', selectedTab: 'overview' }),
  setSelectedTab: (tab) => set({ selectedTab: tab }),

  appsListPage: 1,
  appsListSearch: '',
  appsListStatus: null,
  setAppsListPage: (page) => set({ appsListPage: page }),
  setAppsListSearch: (search) => set({ appsListSearch: search, appsListPage: 1 }),
  setAppsListStatus: (status) => set({ appsListStatus: status, appsListPage: 1 }),
}))