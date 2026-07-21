# Task 3: Mini-services Developer

## Status: ✅ Complete

## Work Completed

### Process Manager (Port 3003)
- **File**: `mini-services/process-manager/index.ts`
- **Package**: socket.io ^4.8.0
- **Architecture**: HTTP REST + Socket.IO on same port
- **Socket.IO path**: `/socket.io` (required to avoid HTTP endpoint interference)
- **HTTP Endpoints**:
  - `POST /start` - Spawn child process with cmd, cwd, env, port
  - `POST /stop` - SIGTERM then SIGKILL after 5s
  - `POST /restart` - Stop + wait + start with restart count increment
  - `GET /status/:appId` - Full process info (pid, status, cpu, memory, uptime, etc.)
  - `GET /all` - Summary of all managed processes
  - `POST /install` - Run install command, stream output via Socket.IO
- **Socket.IO Events**:
  - `process:started`, `process:stopped`, `process:crashed`
  - `process:output` (line by line, stdout/stderr)
  - `process:stats` (every 2s: cpu, memory)
  - `process:install-progress`, `process:crash-loop-detected`
- **Features**:
  - In-memory `ManagedProcess` store with full lifecycle tracking
  - CPU tracking via `/proc/{pid}/stat` (utime/stime delta)
  - Memory tracking via `/proc/{pid}/statm` (RSS pages)
  - Auto-restart with exponential backoff (5s → 80s, max 5 attempts)
  - Output buffer: 1000-line FIFO
  - Log file writing: `{project_root}/logs/{appId}/app.log`
  - Configurable restart policy and max restart attempts

### Terminal Service (Port 3004)
- **File**: `mini-services/terminal-service/index.ts`
- **Package**: socket.io ^4.8.0
- **Socket.IO path**: `/` (standard, as per gateway requirements)
- **Events**:
  - Client → Server: `terminal:join`, `terminal:input`, `terminal:resize`
  - Server → Client: `terminal:output`, `terminal:exit`, `terminal:error`
- **Features**:
  - Per-socket sessions (keyed by socket.id)
  - Spawns `/bin/bash` (falls back to `/bin/sh`) in `{project_root}/apps/{appId}`
  - 5-minute inactivity timeout (auto-kill)
  - 1MB output buffer
  - Terminal resize event for future PTY support
  - Clean session management on disconnect

## Key Design Decisions
1. **Process Manager Socket.IO path**: Used `/socket.io` instead of `/` because Socket.IO with `path: '/'` intercepts ALL HTTP requests, making REST endpoints inaccessible. Frontend must connect with `io("/socket.io/?XTransformPort=3003")`.
2. **Terminal Service Socket.IO path**: Uses `/` as specified since it has no HTTP endpoints.
3. **Process startup**: Uses `bun index.ts` (not `bun --hot index.ts`) for background stability. The `--hot` flag causes processes to exit in background mode.
4. **No arbitrary command execution in terminal**: Spawns a shell in the app directory; user types commands via stdin.

## Frontend Integration Notes
```typescript
// Process Manager Socket.IO
import { io } from 'socket.io-client'
const pmSocket = io("/socket.io/?XTransformPort=3003")

// Terminal Service Socket.IO
const termSocket = io("/?XTransformPort=3004")
termSocket.emit('terminal:join', { appId: 'my-app' })
termSocket.on('terminal:output', ({ data }) => terminal.write(data))
```
