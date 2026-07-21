// Application Lifecycle States
export const APP_STATUS = {
  CREATED: 'CREATED',
  PREPARING: 'PREPARING',
  INSTALLING: 'INSTALLING',
  STARTING: 'STARTING',
  RUNNING: 'RUNNING',
  STOPPING: 'STOPPING',
  STOPPED: 'STOPPED',
  RESTARTING: 'RESTARTING',
  CRASHED: 'CRASHED',
  FAILED: 'FAILED',
  REBUILDING: 'REBUILDING',
  SUSPENDED: 'SUSPENDED',
  DELETING: 'DELETING',
} as const

export type AppStatus = (typeof APP_STATUS)[keyof typeof APP_STATUS]

// Terminal states for transitions
export const TRANSITIONS: Record<AppStatus, AppStatus[]> = {
  [APP_STATUS.CREATED]: [APP_STATUS.PREPARING, APP_STATUS.DELETING],
  [APP_STATUS.PREPARING]: [APP_STATUS.INSTALLING, APP_STATUS.STARTING, APP_STATUS.FAILED, APP_STATUS.DELETING],
  [APP_STATUS.INSTALLING]: [APP_STATUS.STARTING, APP_STATUS.STOPPED, APP_STATUS.FAILED, APP_STATUS.REBUILDING],
  [APP_STATUS.STARTING]: [APP_STATUS.RUNNING, APP_STATUS.CRASHED, APP_STATUS.FAILED, APP_STATUS.STOPPED],
  [APP_STATUS.RUNNING]: [APP_STATUS.STOPPING, APP_STATUS.RESTARTING, APP_STATUS.CRASHED, APP_STATUS.SUSPENDED],
  [APP_STATUS.STOPPING]: [APP_STATUS.STOPPED, APP_STATUS.FAILED],
  [APP_STATUS.STOPPED]: [APP_STATUS.STARTING, APP_STATUS.REBUILDING, APP_STATUS.DELETING],
  [APP_STATUS.RESTARTING]: [APP_STATUS.RUNNING, APP_STATUS.CRASHED, APP_STATUS.FAILED, APP_STATUS.STOPPED],
  [APP_STATUS.CRASHED]: [APP_STATUS.STARTING, APP_STATUS.REBUILDING, APP_STATUS.DELETING],
  [APP_STATUS.FAILED]: [APP_STATUS.REBUILDING, APP_STATUS.DELETING],
  [APP_STATUS.REBUILDING]: [APP_STATUS.INSTALLING, APP_STATUS.STARTING, APP_STATUS.FAILED, APP_STATUS.DELETING],
  [APP_STATUS.SUSPENDED]: [APP_STATUS.STARTING, APP_STATUS.STOPPING, APP_STATUS.DELETING],
  [APP_STATUS.DELETING]: [],
}

export const STABLE_STATES: AppStatus[] = [
  APP_STATUS.CREATED,
  APP_STATUS.RUNNING,
  APP_STATUS.STOPPED,
  APP_STATUS.CRASHED,
  APP_STATUS.FAILED,
  APP_STATUS.SUSPENDED,
]

// Active running states
export const ACTIVE_STATES: AppStatus[] = [
  APP_STATUS.RUNNING,
  APP_STATUS.STARTING,
  APP_STATUS.RESTARTING,
]

export const TRANSIENT_STATES: AppStatus[] = [
  APP_STATUS.PREPARING,
  APP_STATUS.INSTALLING,
  APP_STATUS.STARTING,
  APP_STATUS.STOPPING,
  APP_STATUS.RESTARTING,
  APP_STATUS.REBUILDING,
  APP_STATUS.DELETING,
]

// Application Types
export const APP_TYPES = {
  PYTHON_WEB: 'python-web',
  PYTHON_BOT: 'python-bot',
  PYTHON_DISCORD_BOT: 'python-discord-bot',
  PYTHON_WORKER: 'python-worker',
  PYTHON_API: 'python-api',
  PYTHON_SCRIPT: 'python-script',
  PHP_WEB: 'php-web',
  PHP_WORKER: 'php-worker',
  CUSTOM: 'custom',
} as const

export type AppType = (typeof APP_TYPES)[keyof typeof APP_TYPES]

// Runtime Types
export const RUNTIMES = {
  PYTHON: 'python',
  PHP: 'php',
} as const

export type Runtime = (typeof RUNTIMES)[keyof typeof RUNTIMES]

// Restart Policies
export const RESTART_POLICIES = {
  ALWAYS: 'always',
  ON_FAILURE: 'on-failure',
  NEVER: 'never',
} as const

export type RestartPolicy = (typeof RESTART_POLICIES)[keyof typeof RESTART_POLICIES]

// Health Check Types
export const HEALTH_CHECK_TYPES = {
  PROCESS: 'process',
  PORT: 'port',
  HTTP: 'http',
  COMMAND: 'command',
  NONE: 'none',
} as const

export type HealthCheckType = (typeof HEALTH_CHECK_TYPES)[keyof typeof HEALTH_CHECK_TYPES]

// Process info from the mini-service
export interface ProcessInfo {
  pid: number
  appId: string
  status: 'running' | 'stopped' | 'crashed'
  cpu: number
  memory: number          // in MB
  uptime: number          // in seconds
  startedAt: string
  exitCode: number | null
  restartCount: number
  lastError: string | null
}

// File system entry
export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: string
  extension?: string
}

// Log entry
export interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  source: string
}

// Monitoring data point
export interface MetricPoint {
  timestamp: number
  cpu: number
  memory: number
  diskUsage: number
  networkIn: number
  networkOut: number
}

// System stats
export interface SystemStats {
  totalApps: number
  runningApps: number
  stoppedApps: number
  failedApps: number
  totalCpu: number
  totalMemory: number
  totalDisk: number
  usedDisk: number
}

// App stats
export interface AppStats {
  cpu: number
  memory: number
  diskUsage: number
  uptime: number
  restartCount: number
  healthStatus: 'healthy' | 'unhealthy' | 'unknown'
 lastError: string | null
  lastActivity: string | null
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: string
    stage?: string
    actionable?: string
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
    requestId?: string
  }
}

// Pagination params
export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: 'asc' | 'desc'
  search?: string
  status?: string
}

// Create app payload
export interface CreateAppPayload {
  name: string
  appType: AppType
  runtime: Runtime
  runtimeVersion?: string
  description?: string
  startCmd?: string
  installCmd?: string
  buildCmd?: string
  port?: number
  envVars?: { key: string; value: string; isSecret?: boolean }[]
 files?: File[]
 zipFile?: File
}

// Update app payload
export interface UpdateAppPayload {
  name?: string
  description?: string
  appType?: AppType
  runtime?: Runtime
  runtimeVersion?: string
  entryPoint?: string
  workingDir?: string
  installCmd?: string
  buildCmd?: string
  startCmd?: string
  stopCmd?: string
  restartCmd?: string
  healthCheckCmd?: string
  port?: number | null
  healthCheckType?: HealthCheckType
  healthCheckPath?: string
  healthCheckInterval?: number
  healthCheckTimeout?: number
  healthCheckRetries?: number
  restartPolicy?: RestartPolicy
  maxRestartAttempts?: number
  restartDelay?: number
  restartBackoff?: boolean
  cpuLimit?: number
  memoryLimit?: number
  diskLimit?: number | null
  maxProcesses?: number
}

// Navigation view types for SPA
export type ViewType = 
  | 'dashboard' 
  | 'apps' 
  | 'app-detail'
  | 'app-create'
  | 'settings'
  | 'audit'
  | 'notifications'

export interface AppDetailTab {
  id: string
  label: string
  icon: string
}

// Terminal session
export interface TerminalSession {
  id: string
  appId: string
  pid?: number
  createdAt: string
  lastActivity: string
}

// Backup info
export interface BackupInfo {
  id: string
  name: string
  fileSize: number
  status: string
  createdAt: string
  includeFiles: boolean
  includeEnv: boolean
  includeSettings: boolean
}

// Schedule info
export interface ScheduleInfo {
  id: string
  name: string
  action: string
  command?: string
  cronExpr?: string
  cronKind: string
  enabled: boolean
  lastRunAt?: string
  nextRunAt?: string
  lastResult?: string
  lastDuration?: number
}
