# Update and Backup System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an auto-update system via GitHub releases and a backup UI so non-technical employees can keep reRun up to date without losing data.

**Architecture:** Server polls GitHub releases API for new versions, exposes update status/install endpoints. A standalone update script handles the download-replace-restart cycle. Settings page gets backup management UI. Daily automatic backups run as middleware.

**Tech Stack:** Node.js (child_process for update script), GitHub releases API, PM2 (process management), Hono (routes), React (UI components), Vitest (tests)

---

### Task 1: Add backup API methods to frontend client

**Files:**
- Modify: `client/src/api/client.ts`

**Step 1: Read the current API client**

Read `client/src/api/client.ts` to understand the pattern.

**Step 2: Add backup namespace**

Add after the `dashboard` section:

```typescript
backup: {
  create: () => post<any>('/api/backup'),
  list: () => get<any>('/api/backup/list'),
  restore: (filename: string) => post<any>(`/api/backup/restore/${encodeURIComponent(filename)}`),
  exportTable: (table: string) => `/api/backup/export/${encodeURIComponent(table)}`,
},
```

Note: `exportTable` returns the URL string (not a fetch call) because the browser needs to navigate to it for the CSV download.

**Step 3: Commit**

```bash
git add client/src/api/client.ts
git commit -m "feat: add backup API methods to frontend client"
```

---

### Task 2: Build Settings page backup section

**Files:**
- Modify: `client/src/components/settings/SettingsPage.tsx`

**Step 1: Read the current SettingsPage**

Read `client/src/components/settings/SettingsPage.tsx` fully. Note the panel styling patterns, the section layout, and how data is fetched.

**Step 2: Add a BackupManager component section**

Add a new section to SettingsPage (after the System section, around line 530) or create an inline component. It should:

- Fetch backup list on mount via `api.backup.list()`
- Show "Last backup" timestamp from `api.settings.get('last_backup_at')` (already stored by the backup endpoint)
- **Create Backup button**: calls `api.backup.create()`, refreshes list, shows success message
- **Backup list**: table showing filename, size (human-readable), date. Each row has:
  - "Restore" button with confirmation dialog ("This will replace the current database. Are you sure?")
  - "Download" link pointing to the export URL
- **Restore flow**: calls `api.backup.restore(filename)`, shows "Restart required" message
- Match the CRT panel styling used throughout the page (panelStyle, panelHeaderStyle, panelBodyStyle)

**Step 3: Test manually**

Create a backup, verify it appears in the list, try restore flow.

**Step 4: Commit**

```bash
git add client/src/components/settings/SettingsPage.tsx
git commit -m "feat: add backup management section to Settings page"
```

---

### Task 3: Daily automatic backup middleware

**Files:**
- Create: `server/middleware/auto-backup.ts`
- Create: `tests/server/middleware/auto-backup.test.ts`
- Modify: `server/app.ts` (mount middleware)

**Step 1: Write the failing test**

Create `tests/server/middleware/auto-backup.test.ts`:

```typescript
// ABOUTME: Tests for automatic daily backup middleware
// ABOUTME: Verifies backup creation triggers once per day on first request

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shouldRunDailyBackup } from '../../server/middleware/auto-backup.js';

describe('shouldRunDailyBackup', () => {
  it('returns true when no backup exists for today', () => {
    const lastBackup = '2026-03-04T10:00:00.000Z';
    const now = new Date('2026-03-05T08:00:00.000Z');
    expect(shouldRunDailyBackup(lastBackup, now)).toBe(true);
  });

  it('returns false when backup already exists for today', () => {
    const lastBackup = '2026-03-05T06:00:00.000Z';
    const now = new Date('2026-03-05T08:00:00.000Z');
    expect(shouldRunDailyBackup(lastBackup, now)).toBe(false);
  });

  it('returns true when no backup has ever been made', () => {
    expect(shouldRunDailyBackup(null, new Date())).toBe(true);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/middleware/auto-backup.test.ts`

**Step 3: Implement the middleware**

Create `server/middleware/auto-backup.ts`:

```typescript
// ABOUTME: Middleware that creates a daily automatic backup of the SQLite database
// ABOUTME: Triggers on first request after midnight if no backup exists for today

import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema.js';

let lastCheckDate: string | null = null;

export function shouldRunDailyBackup(lastBackupAt: string | null, now: Date): boolean {
  const todayStr = now.toISOString().split('T')[0];
  if (!lastBackupAt) return true;
  const lastBackupDate = lastBackupAt.split('T')[0];
  return lastBackupDate < todayStr;
}

export function createAutoBackupMiddleware(db: any, dbPath: string, backupDir: string) {
  return async function autoBackup(_c: any, next: () => Promise<void>) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Only check once per calendar day
    if (lastCheckDate === todayStr) {
      return next();
    }

    try {
      const [setting] = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.key, 'last_backup_at'));

      const lastBackupAt = setting?.value ?? null;

      if (shouldRunDailyBackup(lastBackupAt, new Date())) {
        // Create backup
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }

        const sqlite = db.$client;
        sqlite.pragma('wal_checkpoint(TRUNCATE)');

        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', 'T');
        const filename = `rerun-daily-${timestamp}.db`;
        fs.copyFileSync(dbPath, path.join(backupDir, filename));

        // Update last_backup_at
        await db
          .insert(storeSettings)
          .values({ key: 'last_backup_at', value: new Date().toISOString() })
          .onConflictDoUpdate({ target: storeSettings.key, set: { value: new Date().toISOString() } });

        // Prune old backups (keep last 30)
        const files = fs.readdirSync(backupDir)
          .filter(f => f.startsWith('rerun-') && f.endsWith('.db'))
          .sort()
          .reverse();
        for (const old of files.slice(30)) {
          fs.unlinkSync(path.join(backupDir, old));
        }
      }

      lastCheckDate = todayStr;
    } catch (err) {
      console.error('[AUTO-BACKUP] Failed:', err);
      // Don't block the request on backup failure
    }

    return next();
  };
}
```

**Step 4: Mount in app.ts**

In `server/app.ts`, import and use the middleware before route mounts:

```typescript
import { createAutoBackupMiddleware } from './middleware/auto-backup.js';

// After db import, before routes
app.use('/api/*', createAutoBackupMiddleware(db, DB_PATH, path.join(path.dirname(DB_PATH), 'backups')));
```

**Step 5: Run tests**

Run: `npx vitest run tests/server/middleware/auto-backup.test.ts`

**Step 6: Commit**

```bash
git add server/middleware/auto-backup.ts tests/server/middleware/auto-backup.test.ts server/app.ts
git commit -m "feat: add daily automatic backup middleware"
```

---

### Task 4: Version check service

**Files:**
- Create: `server/services/update.ts`
- Create: `tests/server/services/update.test.ts`

**Step 1: Write the failing tests**

Create `tests/server/services/update.test.ts`:

```typescript
// ABOUTME: Tests for the update check service
// ABOUTME: Validates version comparison and update status logic

import { describe, it, expect } from 'vitest';
import { isNewerVersion, parseGitHubRelease } from '../../server/services/update.js';

describe('isNewerVersion', () => {
  it('detects newer major version', () => {
    expect(isNewerVersion('0.1.0', '1.0.0')).toBe(true);
  });

  it('detects newer minor version', () => {
    expect(isNewerVersion('0.1.0', '0.2.0')).toBe(true);
  });

  it('detects newer patch version', () => {
    expect(isNewerVersion('0.1.0', '0.1.1')).toBe(true);
  });

  it('returns false for same version', () => {
    expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false);
  });

  it('returns false for older version', () => {
    expect(isNewerVersion('0.2.0', '0.1.0')).toBe(false);
  });

  it('handles v prefix in remote version', () => {
    expect(isNewerVersion('0.1.0', 'v0.2.0')).toBe(true);
  });
});

describe('parseGitHubRelease', () => {
  it('extracts version and download URL from release data', () => {
    const release = {
      tag_name: 'v0.2.0',
      assets: [
        { name: 'rerun-v0.2.0.zip', browser_download_url: 'https://example.com/rerun-v0.2.0.zip' },
      ],
    };
    const result = parseGitHubRelease(release);
    expect(result).toEqual({
      version: '0.2.0',
      downloadUrl: 'https://example.com/rerun-v0.2.0.zip',
      tagName: 'v0.2.0',
    });
  });

  it('returns null when no zip asset found', () => {
    const release = { tag_name: 'v0.2.0', assets: [] };
    expect(parseGitHubRelease(release)).toBeNull();
  });
});
```

**Step 2: Run to verify they fail**

Run: `npx vitest run tests/server/services/update.test.ts`

**Step 3: Implement the service**

Create `server/services/update.ts`:

```typescript
// ABOUTME: Service for checking GitHub releases for app updates
// ABOUTME: Polls periodically, compares semver, caches update status in memory

const GITHUB_REPO = 'your-org/rerun';  // Update with actual repo
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface UpdateInfo {
  version: string;
  downloadUrl: string;
  tagName: string;
}

interface UpdateStatus {
  currentVersion: string;
  availableUpdate: UpdateInfo | null;
  lastChecked: string | null;
  updating: boolean;
}

let cachedStatus: UpdateStatus = {
  currentVersion: '',
  availableUpdate: null,
  lastChecked: null,
  updating: false,
};

let checkTimer: ReturnType<typeof setInterval> | null = null;

export function isNewerVersion(current: string, remote: string): boolean {
  const clean = (v: string) => v.replace(/^v/, '');
  const [cMajor, cMinor, cPatch] = clean(current).split('.').map(Number);
  const [rMajor, rMinor, rPatch] = clean(remote).split('.').map(Number);

  if (rMajor !== cMajor) return rMajor > cMajor;
  if (rMinor !== cMinor) return rMinor > cMinor;
  return rPatch > cPatch;
}

export function parseGitHubRelease(release: any): UpdateInfo | null {
  const tag = release.tag_name;
  const zipAsset = release.assets?.find((a: any) => a.name.endsWith('.zip'));
  if (!zipAsset) return null;

  return {
    version: tag.replace(/^v/, ''),
    downloadUrl: zipAsset.browser_download_url,
    tagName: tag,
  };
}

export async function checkForUpdates(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'reRun-updater' },
    });
    if (!res.ok) return null;

    const release = await res.json();
    const info = parseGitHubRelease(release);
    if (!info) return null;

    return isNewerVersion(currentVersion, info.version) ? info : null;
  } catch {
    return null;
  }
}

export function getUpdateStatus(): UpdateStatus {
  return { ...cachedStatus };
}

export function setUpdating(updating: boolean): void {
  cachedStatus.updating = updating;
}

export function startUpdateChecker(currentVersion: string): void {
  cachedStatus.currentVersion = currentVersion;

  async function check() {
    const update = await checkForUpdates(currentVersion);
    cachedStatus.availableUpdate = update;
    cachedStatus.lastChecked = new Date().toISOString();
  }

  // Check immediately on startup
  check();

  // Then check every 6 hours
  checkTimer = setInterval(check, CHECK_INTERVAL_MS);
}

export function stopUpdateChecker(): void {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run tests/server/services/update.test.ts`

**Step 5: Commit**

```bash
git add server/services/update.ts tests/server/services/update.test.ts
git commit -m "feat: add version check service for GitHub releases"
```

---

### Task 5: Update API routes

**Files:**
- Create: `server/routes/update.ts`
- Create: `tests/server/routes/update.test.ts`
- Modify: `server/app.ts` (mount routes, start checker)

**Step 1: Write the failing tests**

Create `tests/server/routes/update.test.ts`:

```typescript
// ABOUTME: Tests for update status and install API endpoints
// ABOUTME: Validates update status response shape and install trigger

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Test GET /api/update/status returns expected shape
// Test POST /api/update/install returns 400 when no update available
```

Write tests that:
1. `GET /status` returns `{ currentVersion, availableUpdate, lastChecked, updating }`
2. `POST /install` returns 400 with error message when no update is available

**Step 2: Implement the routes**

Create `server/routes/update.ts`:

```typescript
// ABOUTME: API routes for checking and installing app updates
// ABOUTME: GET /status returns update availability, POST /install triggers the update process

import { Hono } from 'hono';
import { spawn } from 'child_process';
import path from 'path';
import { getUpdateStatus, setUpdating } from '../services/update.js';

export function createUpdateRoutes(dbPath: string, backupDir: string) {
  const routes = new Hono();

  routes.get('/status', async (c) => {
    const status = getUpdateStatus();
    return c.json(status);
  });

  routes.post('/install', async (c) => {
    const status = getUpdateStatus();

    if (!status.availableUpdate) {
      return c.json({ error: 'No update available' }, 400);
    }

    if (status.updating) {
      return c.json({ error: 'Update already in progress' }, 400);
    }

    setUpdating(true);

    // Spawn the update script as a detached process
    const scriptPath = path.resolve('scripts/do-update.js');
    const child = spawn('node', [
      scriptPath,
      '--version', status.availableUpdate.tagName,
      '--url', status.availableUpdate.downloadUrl,
      '--db-path', dbPath,
      '--backup-dir', backupDir,
    ], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    return c.json({ message: 'Update started', version: status.availableUpdate.version });
  });

  return routes;
}
```

**Step 3: Mount routes and start checker in app.ts**

In `server/app.ts`:

```typescript
import { createUpdateRoutes } from './routes/update.js';
import { startUpdateChecker } from './services/update.js';

// Mount routes
app.route('/api/update', createUpdateRoutes(DB_PATH, path.join(path.dirname(DB_PATH), 'backups')));

// Start version checker (reads version from package.json)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
startUpdateChecker(pkg.version);
```

**Step 4: Add to API client**

In `client/src/api/client.ts`, add:

```typescript
update: {
  status: () => get<any>('/api/update/status'),
  install: () => post<any>('/api/update/install'),
},
```

**Step 5: Run tests**

Run: `npx vitest run tests/server/routes/update.test.ts`

**Step 6: Commit**

```bash
git add server/routes/update.ts tests/server/routes/update.test.ts server/app.ts client/src/api/client.ts
git commit -m "feat: add update status and install API endpoints"
```

---

### Task 6: Update script

**Files:**
- Create: `scripts/do-update.ts`

**Step 1: Implement the standalone update script**

Create `scripts/do-update.ts`:

This script runs as a detached process and:
1. Parses CLI args (--version, --url, --db-path, --backup-dir)
2. Creates a pre-update backup of the database
3. Downloads the release zip from GitHub to a temp directory
4. Extracts the zip
5. Replaces `dist/` and `node_modules/` with the new versions
6. Copies any new migration files from the release's `drizzle/` directory
7. Runs `npx drizzle-kit push` to apply migrations
8. Restarts the app via `pm2 restart rerun`
9. Logs all steps to `data/update.log`

```typescript
// ABOUTME: Standalone update script that downloads and installs new reRun versions
// ABOUTME: Runs detached from the server process — backs up DB, replaces files, restarts PM2

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';

// Parse args
const args = process.argv.slice(2);
function getArg(name: string): string {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) throw new Error(`Missing arg: ${name}`);
  return args[idx + 1];
}

const version = getArg('--version');
const url = getArg('--url');
const dbPath = getArg('--db-path');
const backupDir = getArg('--backup-dir');
const appDir = process.cwd();
const logFile = path.join(path.dirname(dbPath), 'update.log');

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logFile, line + '\n');
}

async function main() {
  try {
    log(`Starting update to ${version}`);

    // 1. Pre-update backup
    log('Creating pre-update backup...');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const backupName = `pre-update-${version}.db`;
    fs.copyFileSync(dbPath, path.join(backupDir, backupName));
    log(`Backup created: ${backupName}`);

    // 2. Download release zip
    const tmpDir = path.join(appDir, '.update-tmp');
    if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true });
    fs.mkdirSync(tmpDir, { recursive: true });

    const zipPath = path.join(tmpDir, 'release.zip');
    log(`Downloading ${url}...`);
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as any), createWriteStream(zipPath));
    log('Download complete');

    // 3. Extract zip
    log('Extracting...');
    // Use platform-appropriate unzip
    if (process.platform === 'win32') {
      execSync(`powershell -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${tmpDir}/extracted'"`, { stdio: 'pipe' });
    } else {
      execSync(`unzip -o "${zipPath}" -d "${tmpDir}/extracted"`, { stdio: 'pipe' });
    }

    // Find the extracted root (might be nested in a folder)
    const extractedDir = path.join(tmpDir, 'extracted');
    let sourceDir = extractedDir;
    const entries = fs.readdirSync(extractedDir);
    if (entries.length === 1 && fs.statSync(path.join(extractedDir, entries[0])).isDirectory()) {
      sourceDir = path.join(extractedDir, entries[0]);
    }

    // 4. Replace dist/
    log('Replacing dist/...');
    const distSource = path.join(sourceDir, 'dist');
    const distTarget = path.join(appDir, 'dist');
    if (fs.existsSync(distSource)) {
      if (fs.existsSync(distTarget)) fs.rmSync(distTarget, { recursive: true });
      fs.cpSync(distSource, distTarget, { recursive: true });
    }

    // 5. Replace node_modules/ if included
    const nmSource = path.join(sourceDir, 'node_modules');
    const nmTarget = path.join(appDir, 'node_modules');
    if (fs.existsSync(nmSource)) {
      log('Replacing node_modules/...');
      if (fs.existsSync(nmTarget)) fs.rmSync(nmTarget, { recursive: true });
      fs.cpSync(nmSource, nmTarget, { recursive: true });
    }

    // 6. Copy new package.json
    const pkgSource = path.join(sourceDir, 'package.json');
    if (fs.existsSync(pkgSource)) {
      fs.copyFileSync(pkgSource, path.join(appDir, 'package.json'));
    }

    // 7. Copy drizzle migrations
    const drizzleSource = path.join(sourceDir, 'drizzle');
    const drizzleTarget = path.join(appDir, 'drizzle');
    if (fs.existsSync(drizzleSource)) {
      log('Copying migrations...');
      fs.cpSync(drizzleSource, drizzleTarget, { recursive: true });
    }

    // 8. Run migrations
    log('Running migrations...');
    try {
      execSync('npx drizzle-kit push', { cwd: appDir, stdio: 'pipe' });
      log('Migrations complete');
    } catch (err: any) {
      log(`Migration warning: ${err.message}`);
    }

    // 9. Cleanup temp
    fs.rmSync(tmpDir, { recursive: true });

    // 10. Restart via PM2
    log('Restarting app...');
    execSync('npx pm2 restart rerun', { cwd: appDir, stdio: 'pipe' });

    log(`Update to ${version} complete!`);
  } catch (err: any) {
    log(`UPDATE FAILED: ${err.message}`);
    process.exit(1);
  }
}

main();
```

**Step 2: Add to tsconfig.server.json include**

Make sure `scripts/**/*` is included in the server build so it compiles to `dist/scripts/do-update.js`. Read `tsconfig.server.json` and update the include array.

**Step 3: Commit**

```bash
git add scripts/do-update.ts tsconfig.server.json
git commit -m "feat: add standalone update script for download-replace-restart"
```

---

### Task 7: Dashboard update banner

**Files:**
- Modify: `client/src/components/dashboard/Dashboard.tsx`

**Step 1: Read the Dashboard component**

Read the full file to understand the layout and styling patterns.

**Step 2: Add update banner**

At the top of the Dashboard (before the grid), add an update banner that:
1. Fetches `api.update.status()` on mount
2. If `availableUpdate` exists, shows a banner: "Update available: v0.2.0" with an "Install Update" button
3. If `updating` is true, shows "Updating... please wait" with a spinner/pulse animation
4. When updating, polls `/api/health` every 3 seconds. When it responds, reload the page.
5. Style: full-width, amber/yellow background matching CRT theme, prominent but not blocking

**Step 3: Commit**

```bash
git add client/src/components/dashboard/Dashboard.tsx
git commit -m "feat: add update available banner to Dashboard"
```

---

### Task 8: Settings page update section

**Files:**
- Modify: `client/src/components/settings/SettingsPage.tsx`

**Step 1: Add update info to System section**

In the existing System section (around line 521), replace the hardcoded version with dynamic version from `api.update.status()`. Show:
- Current version (from API, not hardcoded)
- Update status: "Up to date" or "Update available: vX.Y.Z"
- "Check for Updates" button that re-fetches status
- "Install Update" button (when update available)
- Last checked timestamp

**Step 2: Commit**

```bash
git add client/src/components/settings/SettingsPage.tsx
git commit -m "feat: add update controls to Settings page system section"
```

---

### Task 9: Installer script

**Files:**
- Create: `scripts/install.ps1` (Windows PowerShell)
- Create: `scripts/install.sh` (Mac/Linux bash)

**Step 1: Write the Windows installer**

Create `scripts/install.ps1`:

PowerShell script that:
1. Checks if Node.js is installed, if not downloads and installs it (from nodejs.org MSI)
2. Installs PM2 globally: `npm install -g pm2`
3. Installs PM2 windows startup: `npm install -g pm2-windows-startup` then `pm2-startup install`
4. Creates install directory (e.g., `C:\reRun\`)
5. Extracts the app files to the install directory
6. Runs `npm install --production` in the install directory
7. Runs `npm run build`
8. Starts the app: `pm2 start ecosystem.config.cjs`
9. Saves PM2 state: `pm2 save`
10. Opens browser to `http://localhost:1987`
11. Prints success message

**Step 2: Write the Mac/Linux installer**

Create `scripts/install.sh`:

Bash script with equivalent steps:
1. Check for Node.js (suggest nvm or brew if missing)
2. Install PM2 globally
3. Configure PM2 startup: `pm2 startup`
4. Same extract/install/build/start steps

Both scripts should be well-commented and print clear progress messages.

**Step 3: Commit**

```bash
git add scripts/install.ps1 scripts/install.sh
git commit -m "feat: add cross-platform installer scripts"
```

---

### Task 10: Release packaging script

**Files:**
- Create: `scripts/package-release.sh`

**Step 1: Write the packaging script**

Create `scripts/package-release.sh`:

```bash
#!/bin/bash
# ABOUTME: Packages a reRun release for distribution via GitHub releases
# ABOUTME: Builds the app, bundles dist + node_modules + drizzle + config into a zip

set -e

VERSION=$(node -p "require('./package.json').version")
echo "Packaging reRun v${VERSION}..."

# Clean build
rm -rf dist
npm run build

# Create release directory
RELEASE_DIR="rerun-v${VERSION}"
rm -rf "$RELEASE_DIR" "rerun-v${VERSION}.zip"
mkdir -p "$RELEASE_DIR"

# Copy release files
cp -r dist "$RELEASE_DIR/"
cp -r node_modules "$RELEASE_DIR/"
cp -r drizzle "$RELEASE_DIR/"
cp package.json "$RELEASE_DIR/"
cp ecosystem.config.cjs "$RELEASE_DIR/"
cp -r scripts "$RELEASE_DIR/"

# Create zip
zip -r "rerun-v${VERSION}.zip" "$RELEASE_DIR"
rm -rf "$RELEASE_DIR"

echo "Created rerun-v${VERSION}.zip"
echo "Upload this to GitHub releases with tag v${VERSION}"
```

**Step 2: Commit**

```bash
git add scripts/package-release.sh
chmod +x scripts/package-release.sh
git commit -m "feat: add release packaging script"
```

---

### Task 11: Update ecosystem.config.cjs and start script

**Files:**
- Modify: `ecosystem.config.cjs`
- Modify: `package.json`

**Step 1: Update ecosystem config**

Update `ecosystem.config.cjs` to use the correct script path and add environment variables:

```javascript
module.exports = {
  apps: [{
    name: 'rerun',
    script: 'dist/server/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 1987,
    },
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    restart_delay: 3000,
  }],
};
```

**Step 2: Update package.json start script**

Ensure `"start"` points to the right path:
```json
"start": "node dist/server/index.js"
```

Also check `package.json` `"start"` currently says `"node dist/index.js"` — it should be `"node dist/server/index.js"` to match the build output.

**Step 3: Commit**

```bash
git add ecosystem.config.cjs package.json
git commit -m "fix: align start script and PM2 config with build output"
```

---

### Task 12: End-to-end verification

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 2: Build and verify**

```bash
npm run build
```

Verify `dist/server/index.js` exists and `dist/scripts/do-update.js` exists.

**Step 3: Manual smoke test**

1. Dashboard shows current version (no update available since no releases yet)
2. Settings page shows backup section with Create Backup button
3. Create a backup → appears in list
4. Settings shows current version and "Up to date" in System section
5. Verify daily auto-backup logic by checking settings for `last_backup_at` after first request

**Step 4: Commit any fixes**
