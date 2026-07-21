import path from 'path'

export const APPS_DIR = path.join(process.cwd(), 'apps')
export const LOGS_DIR = path.join(process.cwd(), 'logs')
export const BACKUPS_DIR = path.join(process.cwd(), 'backups')

export const DEFAULT_PYTHON_VERSION = '3.11'
export const DEFAULT_PHP_VERSION = '8.2'

export const DEFAULT_RUNTIME_COMMANDS = {
  'python-web': {
    install: 'pip install -r requirements.txt',
    build: null,
    start: 'python main.py',
    stop: null,
  },
  'python-bot': {
    install: 'pip install -r requirements.txt',
    build: null,
    start: 'python main.py',
    stop: null,
  },
  'python-discord-bot': {
    install: 'pip install -r requirements.txt',
    build: null,
    start: 'python main.py',
    stop: null,
  },
  'python-worker': {
    install: 'pip install -r requirements.txt',
    build: null,
    start: 'python main.py',
    stop: null,
  },
  'python-api': {
    install: 'pip install -r requirements.txt',
    build: null,
    start: 'uvicorn main:app --host 0.0.0.0 --port {port}',
    stop: null,
  },
  'python-script': {
    install: 'pip install -r requirements.txt',
    build: null,
    start: 'python main.py',
    stop: null,
  },
  'php-web': {
    install: 'composer install --no-dev',
    build: null,
    start: 'php -S 0.0.0.0:{port} -t public',
    stop: null,
  },
  'php-worker': {
    install: 'composer install --no-dev',
    build: null,
    start: 'php worker.php',
    stop: null,
  },
  'custom': {
    install: null,
    build: null,
    start: null,
    stop: null,
  },
} as const

export const APP_TYPE_LABELS: Record<string, string> = {
  'python-web': 'Python Web App',
  'python-bot': 'Python Telegram Bot',
  'python-discord-bot': 'Python Discord Bot',
  'python-worker': 'Python Worker',
  'python-api': 'Python API',
  'python-script': 'Python Script',
  'php-web': 'PHP Web App',
  'php-worker': 'PHP Worker',
  'custom': 'Custom Application',
}

export const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Created',
  PREPARING: 'Preparing',
  INSTALLING: 'Installing',
  STARTING: 'Starting',
  RUNNING: 'Running',
  STOPPING: 'Stopping',
  STOPPED: 'Stopped',
  RESTARTING: 'Restarting',
  CRASHED: 'Crashed',
  FAILED: 'Failed',
  REBUILDING: 'Rebuilding',
  SUSPENDED: 'Suspended',
  DELETING: 'Deleting',
}

export const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  PREPARING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  INSTALLING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  STARTING: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  RUNNING: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  STOPPING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  STOPPED: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  RESTARTING: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  CRASHED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  REBUILDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  SUSPENDED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  DELETING: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

export const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
export const MAX_ZIP_SIZE = 200 * 1024 * 1024 // 200MB
export const MAX_TOTAL_DISK = 5 * 1024 * 1024 * 1024 // 5GB
export const LOG_MAX_SIZE = 50 * 1024 * 1024 // 50MB per app
export const LOG_ROTATION_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_LOG_LINES_STREAM = 500
export const TERMINAL_TIMEOUT = 300000 // 5 minutes
export const TERMINAL_MAX_OUTPUT = 1024 * 1024 // 1MB

export const PROCESS_MANAGER_PORT = 3003
export const TERMINAL_SERVICE_PORT = 3004