# Wolf Host - Work Log

---
Task ID: 1
Agent: Main
Task: Simplify design, add accounts system, improve landing page

Work Log:
- Removed z.ai favicon from layout.tsx, replaced with /logo.svg
- Rewrote landing page: removed paid plans (kept only free plan), added Telegram contact @j49_c, updated hero text to emphasize free hosting, added footer @j49_c link
- Added 'profile' to ViewType in types.ts
- Completely rewrote app-shell.tsx: removed sidebar/sidebar provider, replaced with simple top nav bar (logo, new button, theme toggle, user dropdown)
- Created simple-app-list.tsx: replaces both DashboardView and AppListView with a clean flat list design, search, inline start/stop/restart actions
- Created simple-app-create.tsx: replaces 3-step wizard with a single dialog form (name, type, file upload, advanced settings collapsible)
- Created profile-view.tsx: full profile page with user info editing, account stats (apps count, plan, join date), change password form
- Created /api/user/profile route.ts: GET (fetch profile) and PUT (update name)
- Created /api/user/password route.ts: PUT (change password with current password verification)

Stage Summary:
- Design is now drastically simplified: no sidebar, simple top nav, flat app list, dialog-based creation
- Landing page has only free plan and Telegram contact @j49_c
- Accounts system: profile viewing, name editing, password changing
- All new code passes ESLint and TypeScript checks
- Browser verification: landing page renders correctly with all sections, registration works and navigates to simplified dashboard
- Pre-existing TS errors in src/app/api/apps/route.ts remain (not related to this task)

Unresolved:
- Terminal mini-service on port 3004 still broken (deferred)
- Auto dependency installation before app start (deferred)
- Radix UI dropdowns/dialogs don't render in headless browser mode (works in real browsers)
