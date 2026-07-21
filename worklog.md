# HostForge - Professional Hosting Platform - Worklog

## Project Overview
Building a professional hosting platform for Python & PHP applications with full lifecycle management.

## Architecture
- **Frontend**: Next.js 16 SPA (single `/` route) with Zustand client-side navigation
- **Backend**: Next.js API Routes (13 route files)
- **Database**: SQLite via Prisma ORM (8 models)
- **Process Manager**: Mini-service on port 3003 (Socket.IO + HTTP)
- **Terminal Service**: Mini-service on port 3004 (Socket.IO)
- **State Management**: Zustand (client), TanStack Query (server state)
- **Real-time**: Socket.IO for process events and terminal I/O

## Completed Phases

### Phase 1: Foundation ✅
- Database schema: Application, EnvVar, AuditLog, Backup, Schedule, Notification, SystemSetting
- Core types: AppStatus (13 states), AppType (9 types), Runtime, RestartPolicy, HealthCheckType, ProcessInfo, FileEntry, LogEntry, SystemStats, AppStats, ApiResponse
- Constants: DEFAULT_RUNTIME_COMMANDS, APP_TYPE_LABELS, STATUS_COLORS, STATUS_LABELS, resource limits
- Security utilities: validatePath (path traversal prevention), sanitizeFileName, sanitizeCommand, slugify, maskSecret
- File utilities: listFiles, readFileContent, writeFileContent, createFile, createDirectory, deletePath, renamePath, getDirectorySize, saveUploadedFile, pathExists, getContentType, detectProjectType, searchInFiles

### Phase 2: Backend APIs ✅
- `GET/POST /api/apps` - List (paginated/filtered/searchable) and Create (with slug generation, storage dir creation, user lookup)
- `GET/PUT/DELETE /api/apps/[id]` - Get (with disk usage), Update (with state validation), Delete (cascade with files)
- `POST /api/apps/[id]/lifecycle` - Start/Stop/Restart/Rebuild/Install (with state machine validation, process-manager forwarding)
- `GET/POST/DELETE /api/apps/[id]/files` - Full file manager (list, read, write, upload, mkdir, rename, search, download)
- `GET/POST/DELETE /api/apps/[id]/env` - Environment variables (with secret masking, reveal mechanism)
- `GET/DELETE /api/apps/[id]/logs` - Log viewer (tail with rotation, per-source clearing)
- `GET/POST /api/apps/[id]/backups` - Backup management (create tar.gz, restore, delete)
- `GET/POST/PUT/DELETE /api/apps/[id]/schedules` - Schedule CRUD with cron validation
- `GET /api/apps/[id]/monitoring` - Real-time metrics (CPU, memory, disk from process-manager + filesystem)
- `GET /api/system?action=stats|health` - System statistics and health checks
- `GET /api/audit` - Paginated audit logs
- `GET/PATCH /api/notifications` - Notification management

### Phase 3: Mini-Services ✅
- **Process Manager (port 3003)**:
  - HTTP: POST /start, /stop, /restart, /install; GET /status/:appId, /all
  - Socket.IO events: process:started, process:stopped, process:crashed, process:output, process:stats (2s interval), process:install-progress, process:crash-loop-detected
  - CPU/memory tracking via /proc/{pid}/stat and /proc/{pid}/statm
  - Auto-restart with exponential backoff (5s→80s, max 5 attempts, crash loop detection)
  - Output buffer (1000-line FIFO) + log file writing
  - Socket.IO path: /socket.io (to avoid HTTP interception)

- **Terminal Service (port 3004)**:
  - Socket.IO events: terminal:join, terminal:input, terminal:resize, terminal:output, terminal:exit, terminal:error
  - Spawns /bin/bash in app's storage directory
  - 5-minute inactivity timeout, 1MB output buffer
  - Per-socket session management with clean disconnect handling

### Phase 4-7: Frontend ✅
- **Zustand Stores**: app-store (navigation, pagination, search, status filters), ui-store (sidebar, command palette)
- **API Hooks (use-api.ts)**: 20+ hooks covering all API endpoints with TanStack Query
- **App Shell**: Responsive sidebar navigation with emerald accent theme, dark mode toggle, notification bell
- **Dashboard**: 4 stat cards, resource usage bars, quick actions, apps needing attention, recent activity
- **Application List**: Search, status filter, sort, grid of app cards with status badges, resource bars, quick actions, pagination
- **App Creation Wizard**: 5-step wizard (Basic Info → Upload Files → Configuration → Advanced → Review) with drag-drop upload, auto-detection, env vars
- **App Detail Page**: Tabbed interface with Overview, Files, Terminal, Logs, Environment, Settings, Monitoring, Backups, Schedules
- **Components**: StatusBadge, EmptyState, ConfirmDialog, Providers (QueryClient, ThemeProvider)

## Key Decisions
1. SPA with client-side routing via Zustand (single `/` route constraint)
2. Path validation layer to prevent traversal attacks in file manager
3. Process state machine with 13 explicit states and valid transitions
4. In-memory process tracking in process-manager mini-service
5. Terminal as separate WebSocket service for security isolation
6. Socket.IO for real-time process events and terminal I/O
7. FormData support in create app API for file uploads
8. Secret masking in environment variables with explicit reveal mechanism

## Files Created
### Backend (src/app/api/)
- apps/route.ts, apps/[id]/route.ts, apps/[id]/lifecycle/route.ts
- apps/[id]/files/route.ts, apps/[id]/env/route.ts, apps/[id]/logs/route.ts
- apps/[id]/backups/route.ts, apps/[id]/backups/[backupId]/route.ts
- apps/[id]/schedules/route.ts, apps/[id]/schedules/[sid]/route.ts
- apps/[id]/monitoring/route.ts
- system/route.ts, audit/route.ts, notifications/route.ts

### Mini-Services
- mini-services/process-manager/index.ts (port 3003)
- mini-services/terminal-service/index.ts (port 3004)

### Frontend
- src/store/app-store.ts, src/store/ui-store.ts
- src/hooks/use-api.ts
- src/components/common/app-shell.tsx, providers.tsx, status-badge.tsx, empty-state.tsx, confirm-dialog.tsx, audit-view.tsx
- src/components/dashboard/dashboard-view.tsx
- src/components/apps/app-list-view.tsx, app-create-wizard.tsx, app-detail-view.tsx, app-overview-tab.tsx, backup-manager.tsx, schedule-manager.tsx
- src/components/files/file-manager.tsx
- src/components/terminal/terminal-view.tsx
- src/components/logs/log-viewer.tsx
- src/components/settings/env-editor.tsx, app-settings.tsx
- src/components/monitoring/monitoring-view.tsx

### Foundation
- src/lib/types.ts, src/lib/constants.ts
- src/lib/utils/security.ts, src/lib/utils/files.ts
- prisma/schema.prisma

## Verified Via Browser Testing
- ✅ Dashboard renders with stats, resource bars, quick actions
- ✅ Applications list with search, filter, sort
- ✅ App creation wizard (5 steps with auto-detection)
- ✅ App created successfully in database and filesystem
- ✅ App detail page loads with tabs
- ✅ Dark mode toggle works
- ✅ Responsive sidebar navigation
- ✅ Professional design confirmed by VLM analysis