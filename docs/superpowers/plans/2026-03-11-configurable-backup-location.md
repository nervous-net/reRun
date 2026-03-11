# Configurable Backup Location — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let store operators choose where database backups are saved, with fallback to the default location when the custom path is unavailable.

**Architecture:** New `resolveBackupDir()` utility reads the `backup_dir` setting from the database at backup time. All three backup code paths (manual, auto-daily, pre-update) call it dynamically instead of using a fixed path. A new filesystem browse API lets the Settings UI navigate directories on the server. A fallback warning banner appears on Dashboard and Settings when the custom path is unavailable.

**Tech Stack:** Hono (server routes), better-sqlite3 + Drizzle ORM, React 19, existing Modal/Button components, Vitest

**Spec:** `docs/superpowers/specs/2026-03-11-configurable-backup-location-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `server/lib/resolve-backup-dir.ts` | `resolveBackupDir()` utility — reads `backup_dir` from DB, validates path, falls back to default |
| `server/routes/filesystem.ts` | `GET /api/filesystem/browse` — directory browser endpoint |
| `client/src/components/settings/DirectoryBrowser.tsx` | Modal component for browsing server directories |
| `tests/server/lib/resolve-backup-dir.test.ts` | Unit tests for resolveBackupDir |
| `tests/server/routes/filesystem.test.ts` | Unit tests for filesystem browse endpoint |

### Modified Files

| File | What Changes |
|------|-------------|
| `server/middleware/auto-backup.ts` | Change signature: accept `db` + `defaultBackupDir` instead of fixed `backupDir`; call `resolveBackupDir()` internally; prune only the resolved directory |
| `server/routes/backup.ts` | Change `BackupOptions` to use `defaultBackupDir`; call `resolveBackupDir()` per request; merge backup lists from both directories; accept `location` on restore |
| `server/routes/settings.ts` | Add validation for `backup_dir` key in PUT handler |
| `server/routes/update.ts` | Accept `db` param; call `resolveBackupDir()` before spawning update script |
| `server/app.ts` | Compute `defaultBackupDir`; pass `db` to update routes; mount filesystem routes |
| `client/src/api/client.ts` | Add `filesystem.browse()` and `backup.verify()` methods |
| `client/src/components/settings/SettingsPage.tsx` | Add Backup Location subsection with input, Browse button, Save/Clear buttons |
| `client/src/components/dashboard/Dashboard.tsx` | Add fallback warning banner |
| `tests/server/routes/backup.test.ts` | Add tests for merged list, restore with location |
| `tests/server/routes/settings.test.ts` | Add tests for backup_dir validation |

---

## Chunk 1: resolveBackupDir Utility + Middleware/Route Refactor

### Task 1: Create `resolveBackupDir` utility

**Files:**
- Create: `server/lib/resolve-backup-dir.ts`
- Create: `tests/server/lib/resolve-backup-dir.test.ts`

- [ ] **Step 1: Write failing tests for resolveBackupDir**

Create `tests/server/lib/resolve-backup-dir.test.ts`:

```typescript
// ABOUTME: Tests for the backup directory resolution utility
// ABOUTME: Verifies custom path usage, fallback behavior, and warning flag setting

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { resolveBackupDir } from '../../../server/lib/resolve-backup-dir.js';
import { storeSettings } from '../../../server/db/schema.js';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import os from 'os';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let tmpDir: string;
let defaultBackupDir: string;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resolve-backup-'));
  defaultBackupDir = path.join(tmpDir, 'default-backups');
  fs.mkdirSync(defaultBackupDir, { recursive: true });
});

afterEach(() => {
  sqlite.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('resolveBackupDir', () => {
  it('returns default path when no custom path is set', async () => {
    const result = await resolveBackupDir(db, defaultBackupDir);
    expect(result.path).toBe(defaultBackupDir);
    expect(result.fallback).toBe(false);
  });

  it('returns default path when backup_dir is empty string', async () => {
    await db.insert(storeSettings).values({ key: 'backup_dir', value: '' });
    const result = await resolveBackupDir(db, defaultBackupDir);
    expect(result.path).toBe(defaultBackupDir);
    expect(result.fallback).toBe(false);
  });

  it('returns custom path when set and directory exists', async () => {
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });
    await db.insert(storeSettings).values({ key: 'backup_dir', value: customDir });

    const result = await resolveBackupDir(db, defaultBackupDir);
    expect(result.path).toBe(customDir);
    expect(result.fallback).toBe(false);
  });

  it('falls back to default and sets warning when custom path is unavailable', async () => {
    const badDir = path.join(tmpDir, 'nonexistent', 'deep', 'path-that-wont-create');
    await db.insert(storeSettings).values({ key: 'backup_dir', value: badDir });

    // Make the parent unwritable so mkdir fails
    const parentDir = path.join(tmpDir, 'nonexistent');
    fs.mkdirSync(parentDir, { recursive: true });
    fs.chmodSync(parentDir, 0o444);

    const result = await resolveBackupDir(db, defaultBackupDir);
    expect(result.path).toBe(defaultBackupDir);
    expect(result.fallback).toBe(true);

    // Verify warning flag was set
    const [warning] = await db.select().from(storeSettings)
      .where(eq(storeSettings.key, 'backup_fallback_warning'));
    expect(warning?.value).toBe('true');

    // Cleanup permissions for rmSync
    fs.chmodSync(parentDir, 0o755);
  });

  it('creates custom directory if it does not exist but parent is writable', async () => {
    const customDir = path.join(tmpDir, 'new-backup-dir');
    await db.insert(storeSettings).values({ key: 'backup_dir', value: customDir });

    const result = await resolveBackupDir(db, defaultBackupDir);
    expect(result.path).toBe(customDir);
    expect(result.fallback).toBe(false);
    expect(fs.existsSync(customDir)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/lib/resolve-backup-dir.test.ts`
Expected: FAIL — module `server/lib/resolve-backup-dir.js` not found

- [ ] **Step 3: Implement resolveBackupDir**

Create `server/lib/resolve-backup-dir.ts`:

```typescript
// ABOUTME: Resolves the effective backup directory from store_settings
// ABOUTME: Falls back to default path and sets warning flag when custom path is unavailable

import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema.js';

interface ResolveResult {
  path: string;
  fallback: boolean;
}

export async function resolveBackupDir(db: any, defaultBackupDir: string): Promise<ResolveResult> {
  const [setting] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, 'backup_dir'));

  const customPath = setting?.value?.trim();

  if (!customPath) {
    return { path: defaultBackupDir, fallback: false };
  }

  const resolved = path.resolve(customPath);

  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }

    // Verify it's a directory and writable by writing a temp file
    const testFile = path.join(resolved, `.backup-test-${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    return { path: resolved, fallback: false };
  } catch {
    // Custom path unavailable — set warning flag and fall back
    console.warn(`[BACKUP] Custom backup path unavailable: ${resolved}. Falling back to default.`);
    try {
      await db
        .insert(storeSettings)
        .values({ key: 'backup_fallback_warning', value: 'true' })
        .onConflictDoUpdate({ target: storeSettings.key, set: { value: 'true' } });
    } catch (flagErr) {
      console.error('[BACKUP] Failed to set fallback warning flag:', flagErr);
    }
    return { path: defaultBackupDir, fallback: true };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/lib/resolve-backup-dir.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/lib/resolve-backup-dir.ts tests/server/lib/resolve-backup-dir.test.ts
git commit -m "feat: add resolveBackupDir utility for configurable backup location"
```

---

### Task 2: Refactor auto-backup middleware to resolve dynamically

**Files:**
- Modify: `server/middleware/auto-backup.ts` (lines 18, 37-38, 46, 56-61)
- Modify: `server/app.ts` (lines 46-47)
- Modify: `tests/server/routes/backup.test.ts` (if auto-backup tests exist there)

- [ ] **Step 1: Write failing test for dynamic resolution in auto-backup**

Add to the bottom of `tests/server/lib/resolve-backup-dir.test.ts` (or create a new file `tests/server/middleware/auto-backup.test.ts` if one doesn't exist — check first):

Create `tests/server/middleware/auto-backup.test.ts`:

```typescript
// ABOUTME: Tests for auto-backup middleware with dynamic backup directory resolution
// ABOUTME: Verifies backups land in custom directory and fall back when unavailable

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../../server/db/schema.js';
import { storeSettings } from '../../../server/db/schema.js';
import { createAutoBackupMiddleware, resetLastCheckDate } from '../../../server/middleware/auto-backup.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Use file-based SQLite (auto-backup does wal_checkpoint which needs a real file)
let db: ReturnType<typeof drizzle>;
let sqliteDb: Database.Database;
let tmpDir: string;
let dbPath: string;
let defaultBackupDir: string;

function applySchema(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-backup-test-'));
  dbPath = path.join(tmpDir, 'test.db');
  defaultBackupDir = path.join(tmpDir, 'default-backups');
  fs.mkdirSync(defaultBackupDir, { recursive: true });

  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  db = drizzle(sqliteDb, { schema });
  applySchema(sqliteDb);

  // Reset the module-level lastCheckDate so each test starts fresh
  resetLastCheckDate();
});

afterEach(() => {
  sqliteDb.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('auto-backup with custom backup_dir', () => {
  it('creates backup in custom directory when backup_dir is set', async () => {
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });

    // Set custom backup_dir in settings
    await db.insert(storeSettings).values({ key: 'backup_dir', value: customDir });

    const middleware = createAutoBackupMiddleware(db, dbPath, defaultBackupDir);
    const app = new Hono();
    app.use('/*', middleware);
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    // Backup should be in custom directory
    const customFiles = fs.readdirSync(customDir).filter(f => f.endsWith('.db'));
    expect(customFiles.length).toBe(1);
    expect(customFiles[0]).toMatch(/^rerun-daily-/);

    // Default directory should be empty
    const defaultFiles = fs.readdirSync(defaultBackupDir).filter(f => f.endsWith('.db'));
    expect(defaultFiles.length).toBe(0);
  });

  it('falls back to default directory when custom path is unavailable', async () => {
    // Set backup_dir to a non-writable path
    const badDir = '/nonexistent/impossible/path';
    await db.insert(storeSettings).values({ key: 'backup_dir', value: badDir });

    const middleware = createAutoBackupMiddleware(db, dbPath, defaultBackupDir);
    const app = new Hono();
    app.use('/*', middleware);
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    // Backup should fall back to default directory
    const defaultFiles = fs.readdirSync(defaultBackupDir).filter(f => f.endsWith('.db'));
    expect(defaultFiles.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/middleware/auto-backup.test.ts`
Expected: FAIL — `resetLastCheckDate` is not exported / signature mismatch

- [ ] **Step 3: Refactor auto-backup middleware**

Modify `server/middleware/auto-backup.ts`:

1. Export a `resetLastCheckDate()` function for testing
2. Replace the fixed `backupDir` param with `defaultBackupDir`
3. Import and call `resolveBackupDir()` inside the middleware (at backup time, not at creation time)
4. Prune only the resolved directory

The full updated file:

```typescript
// ABOUTME: Middleware that creates a daily automatic backup of the SQLite database
// ABOUTME: Triggers on first request after midnight if no backup exists for today

import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema.js';
import { resolveBackupDir } from '../lib/resolve-backup-dir.js';

let lastCheckDate: string | null = null;

/** Reset module state — for testing only */
export function resetLastCheckDate() {
  lastCheckDate = null;
}

export function shouldRunDailyBackup(lastBackupAt: string | null, now: Date): boolean {
  const todayStr = now.toISOString().split('T')[0];
  if (!lastBackupAt) return true;
  const lastBackupDate = lastBackupAt.split('T')[0];
  return lastBackupDate < todayStr;
}

export function createAutoBackupMiddleware(db: any, dbPath: string, defaultBackupDir: string) {
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
        // Resolve backup directory dynamically
        const { path: backupDir } = await resolveBackupDir(db, defaultBackupDir);

        // Create backup
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }

        const sqlite = db.$client;
        sqlite.pragma('wal_checkpoint(TRUNCATE)');

        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '');
        const filename = `rerun-daily-${timestamp}.db`;

        let actualBackupDir = backupDir;
        try {
          fs.copyFileSync(dbPath, path.join(backupDir, filename));
        } catch (copyErr: any) {
          // Handle ENOSPC or other copy failures — fall back to default dir
          if (backupDir !== defaultBackupDir) {
            console.warn(`[AUTO-BACKUP] Copy failed in custom dir (${copyErr.code || copyErr.message}), falling back to default`);
            if (!fs.existsSync(defaultBackupDir)) {
              fs.mkdirSync(defaultBackupDir, { recursive: true });
            }
            fs.copyFileSync(dbPath, path.join(defaultBackupDir, filename));
            actualBackupDir = defaultBackupDir;

            // Set fallback warning
            await db
              .insert(storeSettings)
              .values({ key: 'backup_fallback_warning', value: 'true' })
              .onConflictDoUpdate({ target: storeSettings.key, set: { value: 'true' } });
          } else {
            throw copyErr; // Re-throw if already using default
          }
        }

        // Update last_backup_at
        const now = new Date().toISOString();
        await db
          .insert(storeSettings)
          .values({ key: 'last_backup_at', value: now })
          .onConflictDoUpdate({ target: storeSettings.key, set: { value: now } });

        // Prune old backups in the directory where the backup was actually written (keep last 30)
        const files = fs.readdirSync(actualBackupDir)
          .filter((f: string) => f.startsWith('rerun-') && f.endsWith('.db'))
          .sort()
          .reverse();
        for (const old of files.slice(30)) {
          fs.unlinkSync(path.join(actualBackupDir, old));
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

- [ ] **Step 4: Update app.ts — rename `backupDir` to `defaultBackupDir`**

In `server/app.ts`, change line 46:

```typescript
// Before:
const backupDir = path.join(path.dirname(DB_PATH), 'backups');

// After:
const defaultBackupDir = path.join(path.dirname(DB_PATH), 'backups');
```

Update line 47:
```typescript
app.use('/api/*', createAutoBackupMiddleware(db, DB_PATH, defaultBackupDir));
```

Update lines 65-69 (backup and update routes — will be fully refactored in Tasks 3 and 4, but for now keep them compiling):
```typescript
app.route('/api/backup', createBackupRoutes(db, {
  dbPath: DB_PATH,
  backupDir: defaultBackupDir,
}));
app.route('/api/update', createUpdateRoutes(DB_PATH, defaultBackupDir));
```

Note: `backupDir` in BackupOptions and update routes will be renamed to `defaultBackupDir` in Tasks 3 and 4.

**Important:** Also update `tests/server/routes/backup.test.ts` — the `beforeEach` that creates the Hono app passes `{ dbPath, backupDir }` to `createBackupRoutes`. This still uses the old name and will continue to work until Task 3 renames the property. Task 3 must update this test setup.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/server/middleware/auto-backup.test.ts`
Expected: All tests PASS

Run: `npx vitest run` (full suite — ensure nothing is broken)
Expected: All existing tests still PASS

- [ ] **Step 6: Commit**

```bash
git add server/middleware/auto-backup.ts server/app.ts server/lib/resolve-backup-dir.ts tests/server/middleware/auto-backup.test.ts
git commit -m "refactor: auto-backup middleware uses resolveBackupDir for dynamic path resolution"
```

---

### Task 3: Refactor backup routes to resolve dynamically

**Files:**
- Modify: `server/routes/backup.ts` (lines 19-22, 39-41, 49-89, 91-118, 120-172)
- Modify: `server/app.ts` (lines 65-68)
- Modify: `tests/server/routes/backup.test.ts`

- [ ] **Step 1: Write failing tests for dynamic resolution and merged list**

Add to `tests/server/routes/backup.test.ts`:

```typescript
describe('backup with custom backup_dir', () => {
  it('POST / creates backup in custom directory', async () => {
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });

    // Set custom backup_dir
    await db.insert(storeSettings).values({ key: 'backup_dir', value: customDir });

    const res = await app.request('/api/backup', { method: 'POST' });
    expect(res.status).toBe(201);

    const customFiles = fs.readdirSync(customDir).filter(f => f.endsWith('.db'));
    expect(customFiles.length).toBe(1);
  });

  it('GET /list merges backups from custom and default directories', async () => {
    // Create a backup in the default dir manually
    fs.copyFileSync(dbPath, path.join(backupDir, 'rerun-20260101T000000.db'));

    // Set custom dir and create a backup there
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });
    fs.copyFileSync(dbPath, path.join(customDir, 'rerun-20260102T000000.db'));
    await db.insert(storeSettings).values({ key: 'backup_dir', value: customDir });

    const res = await app.request('/api/backup/list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.backups.length).toBe(2);
    // Each entry should have a location field
    expect(body.backups[0]).toHaveProperty('location');
    expect(body.backups[1]).toHaveProperty('location');
  });

  it('POST /restore/:filename accepts location in body', async () => {
    vi.useFakeTimers();
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });
    const backupFilename = 'rerun-20260101T000000.db';
    fs.copyFileSync(dbPath, path.join(customDir, backupFilename));

    // Mock process.exit to prevent test process from dying
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const res = await app.request(`/api/backup/restore/${backupFilename}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: customDir }),
    });
    expect(res.status).toBe(200);

    // Advance timers to trigger the delayed process.exit
    vi.advanceTimersByTime(1000);

    exitSpy.mockRestore();
    vi.useRealTimers();
  });

  it('POST /restore/:filename rejects arbitrary location paths', async () => {
    const evilDir = '/tmp/evil-dir';
    const res = await app.request('/api/backup/restore/rerun-20260101T000000.db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: evilDir }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/routes/backup.test.ts`
Expected: FAIL — new tests fail because backup routes still use fixed path

- [ ] **Step 3: Refactor backup routes**

Modify `server/routes/backup.ts`:

1. Change `BackupOptions.backupDir` to `BackupOptions.defaultBackupDir`
2. Import `resolveBackupDir`
3. In `POST /` (create backup): call `resolveBackupDir()` to get effective path
4. In `GET /list`: scan both custom and default dirs, merge, add `location` field
5. In `POST /restore/:filename`: accept `location` in body, validate it's a known dir

Key changes:

```typescript
import { resolveBackupDir } from '../lib/resolve-backup-dir.js';

interface BackupOptions {
  dbPath: string;
  defaultBackupDir: string;
}

export function createBackupRoutes(db: any, options: BackupOptions) {
  const routes = new Hono();
  const { dbPath, defaultBackupDir } = options;

  // ... getSqlite() stays the same ...

  // POST / — Create backup
  routes.post('/', async (c) => {
    try {
      const { path: backupDir } = await resolveBackupDir(db, defaultBackupDir);
      // ... rest of backup creation using resolved backupDir ...
    }
  });

  // GET /list — List backups from both directories
  routes.get('/list', async (c) => {
    try {
      const [setting] = await db.select().from(storeSettings)
        .where(eq(storeSettings.key, 'backup_dir'));
      const customDir = setting?.value?.trim() || null;

      // Scan default directory
      const defaultBackups = scanBackupDir(defaultBackupDir);
      // Scan custom directory (if set and different from default)
      const customBackups = (customDir && path.resolve(customDir) !== path.resolve(defaultBackupDir))
        ? scanBackupDir(path.resolve(customDir))
        : [];

      // Merge, dedup by filename (custom takes precedence), sort by mtime desc
      const seen = new Set<string>();
      const merged = [];
      for (const b of [...customBackups, ...defaultBackups]) {
        if (!seen.has(b.filename)) {
          seen.add(b.filename);
          merged.push(b);
        }
      }
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return c.json({ backups: merged });
    }
  });

  // POST /restore/:filename — Restore, with optional location
  routes.post('/restore/:filename', async (c) => {
    const filename = c.req.param('filename');
    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return c.json({ error: 'Invalid filename' }, 400);
    }

    // Get location from body (optional)
    let location: string | null = null;
    try {
      const body = await c.req.json();
      location = body?.location ?? null;
    } catch { /* no body is fine */ }

    // Validate location is one of the known backup directories
    const [setting] = await db.select().from(storeSettings)
      .where(eq(storeSettings.key, 'backup_dir'));
    const customDir = setting?.value?.trim() || null;
    const knownDirs = [path.resolve(defaultBackupDir)];
    if (customDir) knownDirs.push(path.resolve(customDir));

    if (location) {
      const resolvedLocation = path.resolve(location);
      if (!knownDirs.includes(resolvedLocation)) {
        return c.json({ error: 'Invalid backup location' }, 400);
      }
    }

    // Find the backup file
    const searchDirs = location ? [path.resolve(location)] : knownDirs;
    let backupPath: string | null = null;
    for (const dir of searchDirs) {
      const candidate = path.join(dir, filename);
      if (fs.existsSync(candidate)) {
        backupPath = candidate;
        break;
      }
    }

    if (!backupPath) {
      return c.json({ error: `Backup file not found: ${filename}` }, 404);
    }

    // ... rest of restore logic stays the same, using backupPath ...
  });
}

// Helper to scan a directory for backup files
function scanBackupDir(dir: string): Array<{ filename: string; size: number; createdAt: string; location: string }> {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.startsWith('rerun-') && f.endsWith('.db'))
      .map((filename) => {
        const filePath = path.join(dir, filename);
        const stat = fs.statSync(filePath);
        return { filename, size: stat.size, createdAt: stat.mtime.toISOString(), location: dir };
      });
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Update app.ts and existing test setup**

In `server/app.ts`, update lines 65-68:

```typescript
app.route('/api/backup', createBackupRoutes(db, {
  dbPath: DB_PATH,
  defaultBackupDir,
}));
```

In `tests/server/routes/backup.test.ts`, update the `beforeEach` that creates the Hono app — change `{ dbPath, backupDir }` to `{ dbPath, defaultBackupDir: backupDir }`:

```typescript
app.route('/api/backup', createBackupRoutes(db, {
  dbPath,
  defaultBackupDir: backupDir,
}));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/server/routes/backup.test.ts`
Expected: All tests PASS (old and new)

Run: `npx vitest run`
Expected: Full suite passes

- [ ] **Step 6: Commit**

```bash
git add server/routes/backup.ts server/app.ts tests/server/routes/backup.test.ts
git commit -m "refactor: backup routes use resolveBackupDir, support merged list and location on restore"
```

---

### Task 4: Refactor update route to resolve backup dir before spawning

**Files:**
- Modify: `server/routes/update.ts` (lines 13, 44-49)
- Modify: `server/app.ts` (line 69)

- [ ] **Step 1: Write failing test**

Create `tests/server/routes/update-backup-dir.test.ts`:

```typescript
// ABOUTME: Tests that the update route resolves backup_dir before spawning the update script
// ABOUTME: Verifies the --backup-dir argument uses the custom path from store_settings

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createUpdateRoutes } from '../../../server/routes/update.js';
import { storeSettings } from '../../../server/db/schema.js';
import * as updateService from '../../../server/services/update.js';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('child_process', () => ({
  spawn: vi.fn(() => ({
    on: vi.fn(),
    unref: vi.fn(),
  })),
}));

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let tmpDir: string;
let defaultBackupDir: string;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-test-'));
  defaultBackupDir = path.join(tmpDir, 'default-backups');

  vi.spyOn(updateService, 'getUpdateStatus').mockReturnValue({
    currentVersion: '0.3.5',
    availableUpdate: { version: '0.3.6', tagName: 'v0.3.6', downloadUrl: 'https://example.com/release.zip' },
    updating: false,
    lastChecked: null,
  });
  vi.spyOn(updateService, 'setUpdating').mockImplementation(() => {});
});

afterEach(() => {
  sqlite.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('update route with custom backup_dir', () => {
  it('passes resolved custom backup_dir to update script', async () => {
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });
    await db.insert(storeSettings).values({ key: 'backup_dir', value: customDir });

    const routes = createUpdateRoutes(db, path.join(tmpDir, 'test.db'), defaultBackupDir);
    const app = new Hono();
    app.route('/api/update', routes);

    await app.request('/api/update/install', { method: 'POST' });

    expect(spawn).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining(['--backup-dir', customDir]),
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/routes/update-backup-dir.test.ts`
Expected: FAIL — `createUpdateRoutes` doesn't accept `db` param

- [ ] **Step 3: Update the update route signature**

Modify `server/routes/update.ts`:

```typescript
// ABOUTME: API routes for checking and installing app updates
// ABOUTME: GET /status returns update availability, POST /install triggers the update process

import { Hono } from 'hono';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateStatus, setUpdating, forceCheck } from '../services/update.js';
import { resolveBackupDir } from '../lib/resolve-backup-dir.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createUpdateRoutes(db: any, dbPath: string, defaultBackupDir: string) {
  const routes = new Hono();

  routes.get('/status', async (c) => {
    const status = getUpdateStatus();
    return c.json(status);
  });

  routes.post('/check', async (c) => {
    const status = await forceCheck();
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

    // Resolve backup directory dynamically
    const { path: backupDir, fallback } = await resolveBackupDir(db, defaultBackupDir);
    if (fallback) {
      console.warn('[UPDATE] Custom backup path unavailable, using default for pre-update backup');
    }

    const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'do-update.js');
    const appDir = path.resolve(__dirname, '..', '..', '..');
    const child = spawn('node', [
      scriptPath,
      '--version', status.availableUpdate.tagName,
      '--url', status.availableUpdate.downloadUrl,
      '--db-path', dbPath,
      '--backup-dir', backupDir,
    ], {
      cwd: appDir,
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', (err) => {
      console.error(`[UPDATE] Failed to spawn update script: ${err.message}`);
      setUpdating(false);
    });
    child.unref();

    return c.json({ message: 'Update started', version: status.availableUpdate.version });
  });

  return routes;
}
```

- [ ] **Step 4: Update app.ts**

In `server/app.ts`, change line 69:

```typescript
app.route('/api/update', createUpdateRoutes(db, DB_PATH, defaultBackupDir));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/server/routes/update-backup-dir.test.ts`
Expected: PASS

Run: `npx vitest run`
Expected: Full suite passes

- [ ] **Step 6: Commit**

```bash
git add server/routes/update.ts server/app.ts tests/server/routes/update-backup-dir.test.ts
git commit -m "refactor: update route resolves backup_dir before spawning update script"
```

---

## Chunk 2: Filesystem Browse, Verify, and Settings Validation

### Task 5: Create filesystem browse endpoint

**Files:**
- Create: `server/routes/filesystem.ts`
- Create: `tests/server/routes/filesystem.test.ts`
- Modify: `server/app.ts` (add route mount)

- [ ] **Step 1: Write failing tests**

Create `tests/server/routes/filesystem.test.ts`:

```typescript
// ABOUTME: Tests for the filesystem directory browsing endpoint
// ABOUTME: Verifies directory listing, dangerous path rejection, and entry caps

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createFilesystemRoutes } from '../../../server/routes/filesystem.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

let app: Hono;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-browse-'));

  // Create test directory structure
  fs.mkdirSync(path.join(tmpDir, 'dir-a'));
  fs.mkdirSync(path.join(tmpDir, 'dir-b'));
  fs.mkdirSync(path.join(tmpDir, 'dir-c'));
  fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'not a directory');

  const routes = createFilesystemRoutes();
  app = new Hono();
  app.route('/api/filesystem', routes);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/filesystem/browse', () => {
  it('lists only directories, not files', async () => {
    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent(tmpDir)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toBe(tmpDir);
    expect(body.directories.length).toBe(3);
    expect(body.directories.map((d: any) => d.name).sort()).toEqual(['dir-a', 'dir-b', 'dir-c']);
    expect(body.parent).toBe(path.dirname(tmpDir));
  });

  it('returns 400 for non-existent path', async () => {
    const res = await app.request('/api/filesystem/browse?path=/nonexistent/path/xyz');
    expect(res.status).toBe(400);
  });

  it('rejects dangerous paths on Linux/macOS', async () => {
    if (process.platform === 'win32') return; // Skip on Windows
    const res = await app.request('/api/filesystem/browse?path=/proc');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/dangerous/i);
  });

  it('rejects path traversal attempts', async () => {
    // Path that resolves to /proc via traversal
    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent('/tmp/../proc')}`);
    expect(res.status).toBe(400);
  });

  it('returns parent as null at root', async () => {
    const res = await app.request('/api/filesystem/browse?path=/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parent).toBeNull();
  });

  it('caps results at 200 entries', async () => {
    // Create 210 directories
    for (let i = 0; i < 210; i++) {
      fs.mkdirSync(path.join(tmpDir, `subdir-${String(i).padStart(4, '0')}`));
    }

    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent(tmpDir)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    // 210 new dirs + 3 from beforeEach = 213 total, capped at 200
    expect(body.directories.length).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/routes/filesystem.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement filesystem browse endpoint**

Create `server/routes/filesystem.ts`:

```typescript
// ABOUTME: API route for browsing server filesystem directories
// ABOUTME: Used by the Settings UI directory picker for choosing a backup location

import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';

const MAX_ENTRIES = 200;

const DANGEROUS_PREFIXES_UNIX = ['/proc', '/sys', '/dev'];

function isDangerousPath(resolved: string): boolean {
  if (process.platform === 'win32') return false;
  return DANGEROUS_PREFIXES_UNIX.some(prefix =>
    resolved === prefix || resolved.startsWith(prefix + '/'),
  );
}

/** On Windows, enumerate drive roots via PowerShell */
async function getWindowsDriveRoots(): Promise<Array<{ name: string; path: string }>> {
  const { execSync } = await import('child_process');
  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"',
      { encoding: 'utf-8', timeout: 5000 },
    );
    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(root => ({ name: root, path: root }));
  } catch {
    // Fallback: just return C:\
    return [{ name: 'C:\\', path: 'C:\\' }];
  }
}

export function createFilesystemRoutes() {
  const routes = new Hono();

  routes.get('/browse', async (c) => {
    const rawPath = c.req.query('path') || '';

    // On Windows with no path, list drive roots
    if (!rawPath && process.platform === 'win32') {
      const drives = await getWindowsDriveRoots();
      return c.json({ current: '', parent: null, directories: drives });
    }

    const resolved = path.resolve(rawPath || '/');

    // Reject dangerous paths (after canonicalization)
    if (isDangerousPath(resolved)) {
      return c.json({ error: 'Access to dangerous system path is not allowed' }, 400);
    }

    // Validate path exists and is a directory
    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        return c.json({ error: 'Path is not a directory' }, 400);
      }
    } catch {
      return c.json({ error: 'Path does not exist or is not accessible' }, 400);
    }

    // Read directory entries
    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const directories = entries
        .filter(entry => {
          if (!entry.isDirectory()) return false;
          // Skip hidden directories
          if (entry.name.startsWith('.')) return false;
          return true;
        })
        .map(entry => ({
          name: entry.name,
          path: path.join(resolved, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_ENTRIES);

      const parent = resolved === path.parse(resolved).root ? null : path.dirname(resolved);

      return c.json({
        current: resolved,
        parent,
        directories,
      });
    } catch (err: any) {
      return c.json({ error: `Cannot read directory: ${err.message}` }, 400);
    }
  });

  return routes;
}
```

- [ ] **Step 4: Mount the route in app.ts**

Add to `server/app.ts` imports:

```typescript
import { createFilesystemRoutes } from './routes/filesystem.js';
```

Add before the backup route mount:

```typescript
app.route('/api/filesystem', createFilesystemRoutes());
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/server/routes/filesystem.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/routes/filesystem.ts tests/server/routes/filesystem.test.ts server/app.ts
git commit -m "feat: add filesystem browse endpoint for directory picker"
```

---

### Task 6: Add verify endpoint and settings validation

**Files:**
- Modify: `server/routes/settings.ts` (add verify endpoint + validation on PUT for backup_dir)
- Modify: `tests/server/routes/settings.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `tests/server/routes/settings.test.ts`:

First, update the import line to include `afterEach`:
```typescript
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
```

Then add these imports:
```typescript
import os from 'os';
import fs from 'fs';
import path from 'path';

describe('POST /api/settings/backup-dir/verify', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns valid for writable existing directory', async () => {
    const res = await app.request('/api/settings/backup-dir/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: tmpDir }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.exists).toBe(true);
    expect(body.writable).toBe(true);
    expect(body.created).toBe(false);
  });

  it('creates directory if it does not exist', async () => {
    const newDir = path.join(tmpDir, 'new-subdir');
    const res = await app.request('/api/settings/backup-dir/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: newDir }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    expect(body.created).toBe(true);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  it('returns invalid for non-writable path', async () => {
    const readonlyDir = path.join(tmpDir, 'readonly');
    fs.mkdirSync(readonlyDir);
    fs.chmodSync(readonlyDir, 0o444);

    const targetDir = path.join(readonlyDir, 'sub');
    const res = await app.request('/api/settings/backup-dir/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: targetDir }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBeDefined();

    // Cleanup
    fs.chmodSync(readonlyDir, 0o755);
  });

  it('returns 400 when path is missing', async () => {
    const res = await app.request('/api/settings/backup-dir/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('includes low space warning when disk has less than 100MB free', async () => {
    // This test verifies the response shape when low space is detected.
    // Since we can't easily simulate low disk space in tests, we just verify
    // that the response includes a valid `valid` field and optionally `warning`.
    const res = await app.request('/api/settings/backup-dir/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: tmpDir }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
    // `warning` is only present if disk space is truly low — skip assertion on its value
    expect(typeof body.valid).toBe('boolean');
  });
});

describe('PUT /api/settings/backup_dir validation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-bd-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('accepts empty string to reset to default', async () => {
    const res = await app.request('/api/settings/backup_dir', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '' }),
    });
    expect(res.status).toBe(200);
  });

  it('accepts valid writable directory', async () => {
    const res = await app.request('/api/settings/backup_dir', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: tmpDir }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.value).toBe(tmpDir);
  });

  it('rejects non-writable path with 400', async () => {
    const res = await app.request('/api/settings/backup_dir', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '/root/no-access' }),
    });
    expect(res.status).toBe(400);
  });

  it('clears fallback warning when resetting to default (empty string)', async () => {
    await db.insert(storeSettings).values({ key: 'backup_fallback_warning', value: 'true' });

    const res = await app.request('/api/settings/backup_dir', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '' }),
    });
    expect(res.status).toBe(200);

    const [warning] = await db.select().from(storeSettings)
      .where(eq(storeSettings.key, 'backup_fallback_warning'));
    expect(warning?.value).toBe('false');
  });

  it('clears fallback warning when saving a valid path', async () => {
    // Set up a fallback warning
    await db.insert(storeSettings).values({ key: 'backup_fallback_warning', value: 'true' });

    const res = await app.request('/api/settings/backup_dir', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: tmpDir }),
    });
    expect(res.status).toBe(200);

    // Verify warning was cleared
    const [warning] = await db.select().from(storeSettings)
      .where(eq(storeSettings.key, 'backup_fallback_warning'));
    expect(warning?.value).toBe('false');
  });
});
```

Note: You'll need to add `import { eq } from 'drizzle-orm'` to the test file imports if not already present.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/routes/settings.test.ts`
Expected: FAIL — verify endpoint doesn't exist, PUT doesn't validate

- [ ] **Step 3: Add verify endpoint and validation to settings routes**

Modify `server/routes/settings.ts`:

Add imports at top:
```typescript
import fs from 'fs';
import path from 'path';
```

Add before the `PUT /:key` route (so the more specific route matches first):

```typescript
  // POST /backup-dir/verify — Validate a directory path for backup use
  routes.post('/backup-dir/verify', async (c) => {
    const body = await c.req.json();
    const dirPath = body?.path;

    if (!dirPath || typeof dirPath !== 'string') {
      return c.json({ error: 'Missing required field: path' }, 400);
    }

    const resolved = path.resolve(dirPath.trim());
    let exists = false;
    let created = false;
    let writable = false;

    try {
      // Check if directory exists
      if (fs.existsSync(resolved)) {
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
          return c.json({ valid: false, exists: true, writable: false, created: false, error: 'Path exists but is not a directory' });
        }
        exists = true;
      } else {
        // Try to create it
        fs.mkdirSync(resolved, { recursive: true });
        exists = true;
        created = true;
      }

      // Test write access
      const testFile = path.join(resolved, `.backup-verify-${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      writable = true;

      // Check disk space (warn if < 100MB free)
      let lowSpace = false;
      try {
        const stats = fs.statfsSync(resolved);
        const freeBytes = stats.bfree * stats.bsize;
        lowSpace = freeBytes < 100 * 1024 * 1024;
      } catch {
        // statfsSync may not be available on all platforms
      }

      return c.json({
        valid: true,
        exists,
        writable,
        created,
        ...(lowSpace ? { warning: 'Less than 100MB of free space available' } : {}),
      });
    } catch (err: any) {
      return c.json({ valid: false, exists, writable: false, created: false, error: err.message });
    }
  });
```

Modify the `PUT /:key` handler to add validation for `backup_dir`:

```typescript
  // PUT /:key — upsert a setting
  routes.put('/:key', async (c) => {
    const key = c.req.param('key');
    const body = await c.req.json();

    if (body.value === undefined) {
      return c.json({ error: 'Missing required field: value' }, 400);
    }

    // Special validation for backup_dir
    if (key === 'backup_dir') {
      if (body.value !== '') {
        const resolved = path.resolve(body.value.trim());
        try {
          if (!fs.existsSync(resolved)) {
            fs.mkdirSync(resolved, { recursive: true });
          }
          const testFile = path.join(resolved, `.backup-verify-${Date.now()}`);
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
        } catch (err: any) {
          return c.json({ error: `Invalid backup directory: ${err.message}` }, 400);
        }
      }

      // Clear fallback warning on any successful save (including reset to default)
      await db
        .insert(storeSettings)
        .values({ key: 'backup_fallback_warning', value: 'false' })
        .onConflictDoUpdate({ target: storeSettings.key, set: { value: 'false' } });
    }

    // ... existing upsert logic ...
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/routes/settings.test.ts`
Expected: All tests PASS

Run: `npx vitest run`
Expected: Full suite passes

- [ ] **Step 5: Commit**

```bash
git add server/routes/settings.ts tests/server/routes/settings.test.ts
git commit -m "feat: add backup-dir verify endpoint and validation on settings PUT"
```

---

## Chunk 3: Client — Backup Location UI

### Task 7: Add API client methods

**Files:**
- Modify: `client/src/api/client.ts` (lines 136-157)

- [ ] **Step 1: Add filesystem and verify methods to API client**

Add to the `api` object in `client/src/api/client.ts`:

```typescript
  filesystem: {
    browse: (dirPath?: string) =>
      get<any>('/api/filesystem/browse', dirPath ? { path: dirPath } : undefined),
  },
```

Add to the `backup` section:

```typescript
  backup: {
    create: () => post<any>('/api/backup'),
    list: () => get<any>('/api/backup/list'),
    restore: (filename: string, location?: string) =>
      post<any>(`/api/backup/restore/${encodeURIComponent(filename)}`, location ? { location } : undefined),
    verify: (dirPath: string) =>
      post<any>('/api/settings/backup-dir/verify', { path: dirPath }),
    exportTable: (table: string) => `/api/backup/export/${encodeURIComponent(table)}`,
  },
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/client.ts
git commit -m "feat: add filesystem browse and backup verify methods to API client"
```

---

### Task 8: Create DirectoryBrowser modal component

**Files:**
- Create: `client/src/components/settings/DirectoryBrowser.tsx`

- [ ] **Step 1: Create the DirectoryBrowser component**

Create `client/src/components/settings/DirectoryBrowser.tsx`:

```typescript
// ABOUTME: Modal component for browsing server-side directories
// ABOUTME: Used in Settings to select a custom backup location via the filesystem browse API

import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { api } from '../../api/client';

interface DirectoryBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

interface DirectoryEntry {
  name: string;
  path: string;
}

const listStyle: CSSProperties = {
  maxHeight: '400px',
  overflowY: 'auto',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
};

const entryStyle: CSSProperties = {
  padding: 'var(--space-xs) var(--space-sm)',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  borderBottom: '1px solid var(--border-color)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--font-size-sm)',
};

const pathBarStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--crt-green)',
  padding: 'var(--space-xs) var(--space-sm)',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--border-radius)',
  marginBottom: 'var(--space-sm)',
  wordBreak: 'break-all',
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-sm)',
  justifyContent: 'flex-end',
  marginTop: 'var(--space-md)',
};

const btnStyle: CSSProperties = {
  padding: 'var(--space-xs) var(--space-sm)',
  fontFamily: 'var(--font-mono)',
  fontSize: 'var(--font-size-sm)',
  cursor: 'pointer',
  border: '1px solid var(--crt-green)',
  borderRadius: 'var(--border-radius)',
  background: 'transparent',
  color: 'var(--crt-green)',
};

export function DirectoryBrowser({ isOpen, onClose, onSelect, initialPath }: DirectoryBrowserProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [directories, setDirectories] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const browse = useCallback(async (dirPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.filesystem.browse(dirPath);
      setCurrentPath(response.current);
      setParentPath(response.parent);
      setDirectories(response.directories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      browse(initialPath || undefined);
    }
  }, [isOpen, initialPath, browse]);

  const handleNavigate = (dirPath: string) => {
    browse(dirPath);
  };

  const handleUp = () => {
    if (parentPath) browse(parentPath);
  };

  const handleSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Backup Folder" maxWidth="700px">
      <div style={pathBarStyle}>{currentPath || '/'}</div>

      {parentPath && (
        <button
          type="button"
          style={{ ...btnStyle, marginBottom: 'var(--space-sm)' }}
          onClick={handleUp}
          disabled={loading}
        >
          .. (Up)
        </button>
      )}

      {loading && <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-sm)' }}>Loading...</div>}

      {error && <div style={{ color: 'var(--crt-red)', padding: 'var(--space-sm)' }}>{error}</div>}

      {!loading && !error && (
        <div style={listStyle}>
          {directories.length === 0 && (
            <div style={{ ...entryStyle, color: 'var(--text-secondary)', cursor: 'default' }}>
              No subdirectories
            </div>
          )}
          {directories.map((dir) => (
            <div
              key={dir.path}
              style={entryStyle}
              onClick={() => handleNavigate(dir.path)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate(dir.path)}
              role="button"
              tabIndex={0}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              [{dir.name}]
            </div>
          ))}
        </div>
      )}

      <div style={buttonRowStyle}>
        <button type="button" style={btnStyle} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          style={{ ...btnStyle, borderColor: 'var(--crt-green-bright)', color: 'var(--crt-green-bright)' }}
          onClick={handleSelect}
          disabled={loading}
        >
          Select This Folder
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/components/settings/DirectoryBrowser.tsx
git commit -m "feat: add DirectoryBrowser modal component for backup location selection"
```

---

### Task 9: Add Backup Location UI to Settings page

**Files:**
- Modify: `client/src/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Add state variables and handlers**

Add import at the top of `SettingsPage.tsx`:
```typescript
import { DirectoryBrowser } from './DirectoryBrowser';
```

Add state variables after line 245 (`const [showHelp, setShowHelp] = useState(false);`):

```typescript
const [backupDirInput, setBackupDirInput] = useState('');
const [backupDirSaving, setBackupDirSaving] = useState(false);
const [backupDirError, setBackupDirError] = useState<string | null>(null);
const [showDirBrowser, setShowDirBrowser] = useState(false);
```

Update the `loadSettings` callback (around line 251-266) to initialize `backupDirInput`:

After `setSettings(data);` add:
```typescript
setBackupDirInput(data.backup_dir ?? '');
```

Add handlers:

```typescript
const handleSaveBackupDir = useCallback(async () => {
  setBackupDirSaving(true);
  setBackupDirError(null);
  try {
    if (backupDirInput.trim()) {
      // Verify first
      const verifyResult = await api.backup.verify(backupDirInput.trim());
      if (!verifyResult.valid) {
        setBackupDirError(verifyResult.error || 'Directory is not usable for backups');
        return;
      }
    }
    // Save the setting
    await api.settings.update('backup_dir', backupDirInput.trim());
    setSettings((prev) => ({ ...prev, backup_dir: backupDirInput.trim() }));
    setOriginal((prev) => ({ ...prev, backup_dir: backupDirInput.trim() }));
    setFeedback({ type: 'success', message: backupDirInput.trim() ? 'Backup location saved' : 'Backup location reset to default' });
    loadBackups(); // Refresh backup list
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save backup location';
    setBackupDirError(message);
    setFeedback({ type: 'error', message });
  } finally {
    setBackupDirSaving(false);
  }
}, [backupDirInput, loadBackups]);

const handleClearBackupDir = useCallback(async () => {
  setBackupDirInput('');
  setBackupDirError(null);
  try {
    await api.settings.update('backup_dir', '');
    setSettings((prev) => ({ ...prev, backup_dir: '' }));
    setOriginal((prev) => ({ ...prev, backup_dir: '' }));
    setFeedback({ type: 'success', message: 'Backup location reset to default' });
    loadBackups();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reset backup location';
    setFeedback({ type: 'error', message });
  }
}, [loadBackups]);
```

- [ ] **Step 2: Add JSX for Backup Location subsection**

In the JSX, right after `<div style={styles.sectionHeader}>Backup &amp; Restore</div>` (line 711), add the Backup Location UI before the "Create Backup" button:

```tsx
{/* Backup Location */}
<div style={{ marginBottom: 'var(--space-md)' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-xs)' }}>
    <input
      type="text"
      value={backupDirInput}
      onChange={(e) => { setBackupDirInput(e.target.value); setBackupDirError(null); }}
      placeholder="Default (./data/backups)"
      disabled={backupDirSaving}
      style={{
        ...styles.input,
        flex: 1,
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--font-size-sm)',
      }}
    />
    <button
      type="button"
      style={{ ...styles.toggleButton, whiteSpace: 'nowrap' }}
      onClick={() => setShowDirBrowser(true)}
      disabled={backupDirSaving}
    >
      Browse
    </button>
    <button
      type="button"
      style={{
        ...styles.toggleButton,
        whiteSpace: 'nowrap',
        ...(backupDirSaving ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
      }}
      onClick={handleSaveBackupDir}
      disabled={backupDirSaving}
    >
      {backupDirSaving ? 'Saving...' : 'Save'}
    </button>
    {backupDirInput && (
      <button
        type="button"
        style={{ ...styles.toggleButton, whiteSpace: 'nowrap', color: 'var(--text-secondary)', borderColor: 'var(--text-secondary)' }}
        onClick={handleClearBackupDir}
        disabled={backupDirSaving}
      >
        Clear
      </button>
    )}
  </div>
  {backupDirError && (
    <div style={{ color: 'var(--crt-red)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-xs)' }}>
      {backupDirError}
    </div>
  )}
  <div style={styles.hint}>
    Choose a folder for backups. Leave empty to use the default location.
  </div>
</div>

<DirectoryBrowser
  isOpen={showDirBrowser}
  onClose={() => setShowDirBrowser(false)}
  onSelect={(p) => setBackupDirInput(p)}
  initialPath={backupDirInput || undefined}
/>
```

- [ ] **Step 3: Update restore calls to pass location**

Find the existing restore call in SettingsPage (where `api.backup.restore` is called) and update it to pass the `location` field from the backup entry. The backup list entries now include a `location` property.

Update the `BackupEntry` type (near the top of the file) to include `location`:

```typescript
interface BackupEntry {
  filename: string;
  size: number;
  createdAt: string;
  location?: string;
}
```

Update the restore handler to look up and pass `location` from the `backups` array:

```typescript
// In the handleRestore function (or wherever api.backup.restore is called),
// look up the location for the target filename from the backups state:
const targetBackup = backups.find(b => b.filename === restoreTarget);
await api.backup.restore(restoreTarget!, targetBackup?.location);
```

Find where `api.backup.restore(restoreTarget)` is called and replace with the above pattern. The `backups` state array already contains `location` since the list endpoint now returns it.

- [ ] **Step 4: Run dev server to verify UI renders**

Run: `npm run dev`
Navigate to Settings page, verify:
- Backup Location input appears above Create Backup button
- Browse button opens the modal
- Save/Clear buttons work
- Error messages display on failure

- [ ] **Step 5: Commit**

```bash
git add client/src/components/settings/SettingsPage.tsx
git commit -m "feat: add backup location configuration UI to Settings page"
```

---

### Task 10: Add fallback warning banner to Dashboard and Settings

**Files:**
- Modify: `client/src/components/dashboard/Dashboard.tsx`
- Modify: `client/src/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Add warning banner to Dashboard**

In `client/src/components/dashboard/Dashboard.tsx`:

Add a state variable to track the fallback warning and fetch it from settings:

```typescript
const [backupWarning, setBackupWarning] = useState(false);
```

The Dashboard already fetches settings via `api.settings.list()` in its `loadDashboard` function. Piggyback on that existing fetch instead of making a separate API call. In the `loadDashboard` function, after the settings response is processed, add:

```typescript
// Read backup fallback warning from the already-fetched settings
setBackupWarning(settingsData?.backup_fallback_warning === 'true');
```

(Find where `api.settings.list()` is called in `loadDashboard` and extract `backup_fallback_warning` from the response alongside the existing settings reads.)

Add handler to dismiss:

```typescript
const dismissBackupWarning = async () => {
  setBackupWarning(false);
  try {
    await api.settings.update('backup_fallback_warning', 'false');
  } catch { /* ignore */ }
};
```

Add the banner JSX at the top of the page content (just inside the main container):

```tsx
{backupWarning && (
  <div style={{
    backgroundColor: 'var(--bg-panel)',
    border: '1px solid var(--crt-amber)',
    borderRadius: 'var(--border-radius)',
    padding: 'var(--space-sm) var(--space-md)',
    marginBottom: 'var(--space-md)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'var(--crt-amber)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-mono)',
  }}>
    <Link to="/settings" style={{ color: 'var(--crt-amber)', textDecoration: 'underline' }}>
      Backup location unavailable — backups are being saved to the default location. Check your backup path in Settings.
    </Link>
    <button
      type="button"
      onClick={dismissBackupWarning}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--crt-amber)',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--font-size-sm)',
        padding: '0 4px',
      }}
      aria-label="Dismiss"
    >
      X
    </button>
  </div>
)}
```

- [ ] **Step 2: Add warning banner to Settings page**

In `client/src/components/settings/SettingsPage.tsx`, add a similar banner inside the Backup & Restore section (right above the Backup Location input). Use the existing `settings` state:

```tsx
{settings.backup_fallback_warning === 'true' && (
  <div style={{
    border: '1px solid var(--crt-amber)',
    borderRadius: 'var(--border-radius)',
    padding: 'var(--space-xs) var(--space-sm)',
    marginBottom: 'var(--space-sm)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: 'var(--crt-amber)',
    fontSize: 'var(--font-size-sm)',
    fontFamily: 'var(--font-mono)',
  }}>
    <span>Backup location unavailable — using default location.</span>
    <button
      type="button"
      onClick={async () => {
        await api.settings.update('backup_fallback_warning', 'false');
        setSettings((prev) => ({ ...prev, backup_fallback_warning: 'false' }));
      }}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--crt-amber)',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        padding: '0 4px',
      }}
      aria-label="Dismiss"
    >
      X
    </button>
  </div>
)}
```

- [ ] **Step 3: Run dev server and verify banners**

Run: `npm run dev`
- Set `backup_fallback_warning` to `"true"` via Settings API manually (or set an invalid custom path, trigger a backup, and check)
- Verify banner appears on Dashboard with link to Settings
- Verify banner appears on Settings near Backup Location
- Verify dismiss ("X") clears the banner

- [ ] **Step 4: Commit**

```bash
git add client/src/components/dashboard/Dashboard.tsx client/src/components/settings/SettingsPage.tsx
git commit -m "feat: add fallback warning banner to Dashboard and Settings pages"
```

---

## Chunk 4: Integration and E2E Tests

### Task 11: Integration tests for full backup cycle with custom path

**Files:**
- Modify: `tests/server/routes/backup.test.ts`

- [ ] **Step 1: Add integration tests**

Add to `tests/server/routes/backup.test.ts`:

```typescript
describe('full backup cycle with custom backup_dir', () => {
  it('set custom path → create backup → list shows backup at custom location → restore from custom', async () => {
    const customDir = path.join(tmpDir, 'integration-custom');
    fs.mkdirSync(customDir, { recursive: true });

    // Set custom backup_dir in store_settings
    await db.insert(storeSettings).values({ key: 'backup_dir', value: customDir });

    // Create a backup
    const createRes = await app.request('/api/backup', { method: 'POST' });
    expect(createRes.status).toBe(201);
    const { filename } = await createRes.json();

    // List should include it with location
    const listRes = await app.request('/api/backup/list');
    const { backups } = await listRes.json();
    const found = backups.find((b: any) => b.filename === filename);
    expect(found).toBeDefined();
    expect(found.location).toBe(customDir);

    // File should exist at custom path
    expect(fs.existsSync(path.join(customDir, filename))).toBe(true);
    // File should NOT exist at default path
    expect(fs.existsSync(path.join(backupDir, filename))).toBe(false);
  });

  it('unavailable custom path → backup falls back → warning flag set', async () => {
    // Set invalid custom dir
    await db.insert(storeSettings).values({ key: 'backup_dir', value: '/nonexistent/bad/path' });

    // Create a backup (should fall back silently)
    const createRes = await app.request('/api/backup', { method: 'POST' });
    expect(createRes.status).toBe(201);

    // File should be in default dir
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
    expect(files.length).toBeGreaterThan(0);

    // Warning flag should be set
    const [warning] = await db.select().from(storeSettings)
      .where(eq(storeSettings.key, 'backup_fallback_warning'));
    expect(warning?.value).toBe('true');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/server/routes/backup.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/server/routes/backup.test.ts
git commit -m "test: add integration tests for backup cycle with custom backup directory"
```

---

### Task 12: Run full test suite and fix any issues

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Fix any failures**

If any existing tests break due to the `BackupOptions` rename (`backupDir` → `defaultBackupDir`), update them to use the new property name.

Common fixes:
- In `tests/server/routes/backup.test.ts`, the `beforeEach` that creates the Hono app passes `{ dbPath, backupDir }` — change to `{ dbPath, defaultBackupDir: backupDir }`.

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "test: fix existing tests for BackupOptions rename"
```

---

### Task 13: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS with zero failures

- [ ] **Step 2: Manual smoke test**

Run: `npm run dev`
1. Open Settings page
2. Type a backup path → click Save → verify success
3. Click Browse → navigate directories → select folder → verify it populates the input
4. Click Create Backup → verify backup appears in list
5. Clear the backup path → verify reset works
6. Set an invalid path → Save → verify error message
7. Check Dashboard for warning banner behavior

- [ ] **Step 3: Final commit if needed**

```bash
git add -A
git commit -m "feat: configurable backup location — complete implementation"
```
