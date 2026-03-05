# Update and Backup System Design

## Problem

reRun runs locally on a store computer. Employees need a zero-effort way to update the app without losing data, and a reliable backup system to protect against data loss.

## App Lifecycle

### How it runs

- Built Node.js app managed by PM2
- `npm run build` produces `dist/` (compiled server + client)
- PM2 runs `node dist/server/index.js` via `ecosystem.config.cjs`
- PM2 configured to start on boot (`pm2 startup` + `pm2 save`)
- SQLite database lives in `data/rerun.db`, separate from `dist/`
- Employee opens browser to `http://localhost:1987`

### First-time setup

An installer script handles one-time setup:
- Verify/install Node.js
- Install PM2 globally
- Extract the app to an install directory
- Run initial build and database setup
- Configure PM2 to start on boot
- Cross-platform: Windows first, Mac/Linux compatible

### Directory structure

```
rerun/
  dist/           # Built app (replaced on update)
  node_modules/   # Dependencies (replaced on update)
  data/           # Never touched by updates
    rerun.db      # SQLite database
    backups/      # Backup files
  package.json
  ecosystem.config.cjs
```

## Update Mechanism

### Version checking

- Current version tracked in `package.json`
- On startup and every 6 hours, server checks GitHub releases API for newer version tag
- Compares semver: current `package.json` version vs latest GitHub release tag
- Stores update info (available version, download URL) in memory

### Update API

- `GET /api/update/status` — returns current version, available update (if any), last check time
- `POST /api/update/install` — triggers the update process

### Update flow

1. Employee sees banner on Dashboard: "Update available: v0.2.0"
2. Employee clicks "Install Update" (from Dashboard banner or Settings page)
3. Server responds immediately with "updating" status
4. Update process runs:
   a. Create pre-update backup labeled `pre-update-v0.2.0`
   b. Download release zip from GitHub
   c. Extract to temp directory
   d. Replace `dist/` and `node_modules/` with new versions
   e. Run database migrations (`npx drizzle-kit push`)
   f. Restart app via PM2 (`pm2 restart rerun`)
5. Browser shows "Updating... please wait" overlay, polls server health endpoint
6. When server responds, browser auto-refreshes

### Update script

The actual update logic runs as a standalone script (`scripts/update.ts` compiled to `dist/scripts/update.js`) so it can survive the replacement of `dist/`. The flow:

1. Server receives POST /update/install
2. Server spawns the update script as a detached child process
3. Server responds to client with "updating" status
4. Update script runs independently: backup, download, extract, replace, migrate, PM2 restart
5. New server starts, client reconnects

### Release process (for you)

1. Bump version in `package.json`
2. `npm run build`
3. Create GitHub release with tag `vX.Y.Z`
4. Attach release zip (built app + node_modules + migrations)
5. Every store picks it up automatically

## Backup System

### Existing infrastructure

Backup API already exists:
- `POST /api/backup` — create backup
- `GET /api/backup/list` — list backups
- `POST /api/backup/restore/:filename` — restore from backup
- `GET /api/backup/export/:table` — export table as CSV

### New: Settings page backup UI

- "Create Backup" button
- List of existing backups with size, date, restore button, download button
- Last backup timestamp displayed prominently
- Restore requires confirmation dialog (destructive action)

### New: Automatic backups

- **Pre-update backup**: every update creates a backup before touching anything
- **Daily backup**: server creates a backup on first request after midnight if no backup exists for today (no cron dependency)
- Backup filenames: `rerun-YYYYMMDDTHHMMSS.db` (existing format) and `pre-update-vX.Y.Z.db` for update backups

### Storage

- Backups in `data/backups/`
- No cloud backup (local only for now)
- Keep last 30 daily backups, prune older ones automatically

## What to build

1. Move database to `data/` directory (migration path for existing installs)
2. Update `ecosystem.config.cjs` for production data directory
3. Version check service (GitHub releases API polling)
4. Update API endpoints (`/api/update/status`, `/api/update/install`)
5. Update script (download, extract, replace, migrate, restart)
6. Dashboard update banner component
7. Settings page backup section (create, list, restore, download)
8. Settings page update section (current version, check/install)
9. Daily automatic backup middleware
10. Installer script (cross-platform, Windows-first)
11. GitHub release packaging script

## What stays the same

- All existing backup API endpoints
- Database schema (migrations handle changes)
- All app functionality
