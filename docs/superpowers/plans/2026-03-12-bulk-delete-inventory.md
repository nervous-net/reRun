# Bulk Delete & Nuke Inventory Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk hard-delete of selected titles and a full inventory nuke with backup safety net.

**Architecture:** Two new POST endpoints on the titles router (`/bulk-delete` and `/nuke`). Backup creation extracted from the backup route into a shared utility. New `DangerZone` component in Settings. Select mode added to `InventoryBrowser` with sticky action bar.

**Tech Stack:** Hono (server), React 19 (client), better-sqlite3 + Drizzle ORM, Vitest

**Spec:** `docs/superpowers/specs/2026-03-12-bulk-delete-inventory-design.md`

---

## File Structure

### New Files
- `server/lib/create-backup.ts` — Extracted backup creation logic (called by backup route and nuke endpoint)
- `client/src/components/settings/DangerZone.tsx` — Danger Zone UI for Settings page
- `tests/server/routes/bulk-delete.test.ts` — Tests for both bulk-delete and nuke endpoints

### Modified Files
- `server/routes/titles.ts` — Add `POST /bulk-delete` and `POST /nuke` routes
- `server/routes/backup.ts` — Refactor to use shared `create-backup.ts` utility
- `client/src/api/client.ts` — Add `bulkDelete()` and `nuke()` API methods
- `client/src/components/inventory/InventoryBrowser.tsx` — Add select mode, checkboxes, sticky action bar
- `client/src/components/settings/SettingsPage.tsx` — Import and render DangerZone

---

## Chunk 1: Backend — Extract Backup Utility & Add Endpoints

### Task 1: Extract backup creation into shared utility

**Files:**
- Create: `server/lib/create-backup.ts`
- Modify: `server/routes/backup.ts:69-113`

- [ ] **Step 1: Create `server/lib/create-backup.ts`**

This extracts the core backup logic from `server/routes/backup.ts` lines 69-113 into a reusable function.

```typescript
// ABOUTME: Shared backup creation utility used by backup route and nuke endpoint
// ABOUTME: Copies SQLite database file to timestamped backup after flushing WAL

import fs from 'fs';
import path from 'path';
import { storeSettings } from '../db/schema.js';
import { resolveBackupDir } from './resolve-backup-dir.js';

interface CreateBackupResult {
  filename: string;
  createdAt: string;
}

interface CreateBackupOptions {
  db: any;
  dbPath: string;
  defaultBackupDir: string;
}

export async function createBackup(options: CreateBackupOptions): Promise<CreateBackupResult> {
  const { db, dbPath, defaultBackupDir } = options;
  const sqlite = db.$client;

  // Resolve effective backup directory (respects custom backup_dir setting)
  const { path: effectiveBackupDir } = await resolveBackupDir(db, defaultBackupDir);

  // Ensure backups directory exists
  if (!fs.existsSync(effectiveBackupDir)) {
    fs.mkdirSync(effectiveBackupDir, { recursive: true });
  }

  // Flush WAL to ensure the DB file is self-contained
  sqlite.pragma('wal_checkpoint(TRUNCATE)');

  // Generate timestamped filename
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:]/g, (m: string) => m === '-' ? '-' : '')
    .replace(/:/g, '')
    .replace(/\.\d+Z$/, '')
    .split('T')
    .join('T');
  const filename = `rerun-${timestamp}.db`;
  const backupPath = path.join(effectiveBackupDir, filename);

  // Copy the database file
  fs.copyFileSync(dbPath, backupPath);

  // Store last_backup_at in store_settings
  const backupTime = now.toISOString();
  await db
    .insert(storeSettings)
    .values({ key: 'last_backup_at', value: backupTime })
    .onConflictDoUpdate({
      target: storeSettings.key,
      set: { value: backupTime },
    });

  return { filename, createdAt: backupTime };
}
```

- [ ] **Step 2: Refactor `server/routes/backup.ts` to use shared utility**

Replace lines 69-113 in `server/routes/backup.ts` (the `POST /` handler body) to use the new utility:

```typescript
// Add import at top of file:
import { createBackup } from '../lib/create-backup.js';

// Replace POST / handler body (lines 70-113):
routes.post('/', async (c) => {
  try {
    const result = await createBackup({ db, dbPath, defaultBackupDir });
    return c.json(result, 201);
  } catch (err: any) {
    return c.json({ error: `Backup failed: ${err.message}` }, 500);
  }
});
```

Remove the now-unused `getSqlite()` function (lines 64-67) only if no other handler in the file uses it. Check first — the restore handler may use it.

- [ ] **Step 3: Run existing backup tests to verify refactor didn't break anything**

Run: `npx vitest run tests/server/routes/backup.test.ts`
Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/lib/create-backup.ts server/routes/backup.ts
git commit -m "refactor: extract backup creation into shared utility"
```

---

### Task 2: Add bulk-delete endpoint with tests

**Files:**
- Modify: `server/routes/titles.ts:1-254`
- Create: `tests/server/routes/bulk-delete.test.ts`

- [ ] **Step 1: Write failing tests for bulk-delete**

Create `tests/server/routes/bulk-delete.test.ts`:

```typescript
// ABOUTME: Tests for bulk-delete and nuke inventory endpoints
// ABOUTME: Covers hard-deletion cascades, active rental skipping, and nuke with backup

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createTitlesRoutes } from '../../../server/routes/titles.js';
import { titles, copies, rentals, reservations, transactionItems, transactions, customers } from '../../../server/db/schema.js';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const titlesRoutes = createTitlesRoutes(db);
  app = new Hono();
  app.route('/api/titles', titlesRoutes);
});

// --- Helper to seed a title with copies ---
async function seedTitle(name: string, year: number) {
  const id = nanoid();
  await db.insert(titles).values({ id, name, year });
  return id;
}

async function seedCopy(titleId: string, format = 'DVD') {
  const id = nanoid();
  const barcode = `${format}-${id}`;
  await db.insert(copies).values({ id, titleId, barcode, format });
  return id;
}

async function seedCustomer() {
  const id = nanoid();
  await db.insert(customers).values({ id, firstName: 'Test', lastName: 'Customer', phone: '555-0000', memberBarcode: `MBR-${id}` });
  return id;
}

async function seedRental(copyId: string, customerId: string, status = 'out') {
  const id = nanoid();
  await db.insert(rentals).values({
    id,
    copyId,
    customerId,
    status,
    checkedOutAt: new Date().toISOString(),
    dueAt: new Date().toISOString(),
  });
  return id;
}

async function seedTransaction(customerId: string) {
  const id = nanoid();
  await db.insert(transactions).values({
    id,
    customerId,
    type: 'rental',
    subtotal: 500,
    tax: 0,
    total: 500,
    paymentMethod: 'cash',
  });
  return id;
}

async function seedTransactionItem(transactionId: string, copyId: string, rentalId: string) {
  const id = nanoid();
  await db.insert(transactionItems).values({
    id,
    transactionId,
    type: 'rental',
    copyId,
    rentalId,
    amount: 500,
  });
  return id;
}

async function seedReservation(customerId: string, titleId: string) {
  const id = nanoid();
  await db.insert(reservations).values({
    id,
    customerId,
    titleId,
    reservedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return id;
}

describe('POST /api/titles/bulk-delete', () => {
  it('deletes multiple titles and their copies', async () => {
    const t1 = await seedTitle('Die Hard', 1988);
    const t2 = await seedTitle('Aliens', 1986);
    await seedCopy(t1);
    await seedCopy(t2);

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1, t2] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toContain(t1);
    expect(body.deleted).toContain(t2);
    expect(body.skipped).toHaveLength(0);
  });

  it('deletes associated rentals, reservations, and transaction items', async () => {
    const t1 = await seedTitle('Terminator', 1984);
    const c1 = await seedCopy(t1);
    const cust = await seedCustomer();
    const r1 = await seedRental(c1, cust, 'returned');
    const tx = await seedTransaction(cust);
    await seedTransactionItem(tx, c1, r1);
    await seedReservation(cust, t1);

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toContain(t1);

    // Verify cascade: all related rows gone
    const remainingCopies = await db.select().from(copies);
    const remainingRentals = await db.select().from(rentals);
    const remainingReservations = await db.select().from(reservations);
    const remainingTxItems = await db.select().from(transactionItems);
    expect(remainingCopies).toHaveLength(0);
    expect(remainingRentals).toHaveLength(0);
    expect(remainingReservations).toHaveLength(0);
    expect(remainingTxItems).toHaveLength(0);
  });

  it('skips titles with active rentals', async () => {
    const t1 = await seedTitle('Die Hard', 1988);
    const t2 = await seedTitle('Aliens', 1986);
    const c1 = await seedCopy(t1);
    await seedCopy(t2);
    const cust = await seedCustomer();
    await seedRental(c1, cust, 'out');

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1, t2] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toContain(t2);
    expect(body.deleted).not.toContain(t1);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0].id).toBe(t1);
    expect(body.skipped[0].reason).toBe('active rental');
  });

  it('returns 400 for empty ids array', async () => {
    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 400 for ids array exceeding 500', async () => {
    const ids = Array.from({ length: 501 }, () => nanoid());
    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });

    expect(res.status).toBe(400);
  });

  it('returns empty deleted array when all titles have active rentals', async () => {
    const t1 = await seedTitle('Die Hard', 1988);
    const t2 = await seedTitle('Aliens', 1986);
    const c1 = await seedCopy(t1);
    const c2 = await seedCopy(t2);
    const cust = await seedCustomer();
    await seedRental(c1, cust, 'out');
    await seedRental(c2, cust, 'out');

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1, t2] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toHaveLength(0);
    expect(body.skipped).toHaveLength(2);
  });

  it('handles non-existent IDs gracefully', async () => {
    const t1 = await seedTitle('Real Movie', 2000);
    await seedCopy(t1);

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1, 'nonexistent-id'] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toContain(t1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/routes/bulk-delete.test.ts`
Expected: All tests FAIL (routes don't exist yet)

- [ ] **Step 3: Implement bulk-delete endpoint**

Add to `server/routes/titles.ts` before the `return routes;` line (before line 252):

```typescript
// Add these imports at top of file:
import { transactionItems, reservations } from '../db/schema.js';
import { inArray } from 'drizzle-orm';

// POST /bulk-delete — hard-delete multiple titles and all related data
routes.post('/bulk-delete', async (c) => {
  const body = await c.req.json();
  const ids: string[] = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ error: 'ids array is required and must not be empty' }, 400);
  }
  if (ids.length > 500) {
    return c.json({ error: 'Maximum 500 IDs per request' }, 400);
  }

  // Find which titles actually exist
  const existingTitles = await db
    .select({ id: titles.id, name: titles.name })
    .from(titles)
    .where(inArray(titles.id, ids));

  const existingIds = existingTitles.map((t) => t.id);

  // Check for active rentals per title
  const deleted: string[] = [];
  const skipped: Array<{ id: string; name: string; reason: string }> = [];

  for (const title of existingTitles) {
    const titleCopies = await db
      .select({ id: copies.id })
      .from(copies)
      .where(eq(copies.titleId, title.id));

    let hasActiveRental = false;
    for (const copy of titleCopies) {
      const [activeRental] = await db
        .select({ count: count() })
        .from(rentals)
        .where(and(eq(rentals.copyId, copy.id), eq(rentals.status, 'out')));
      if (activeRental.count > 0) {
        hasActiveRental = true;
        break;
      }
    }

    if (hasActiveRental) {
      skipped.push({ id: title.id, name: title.name, reason: 'active rental' });
    } else {
      deleted.push(title.id);
    }
  }

  if (deleted.length > 0) {
    // Get all copy IDs for titles being deleted
    const copyRows = await db
      .select({ id: copies.id })
      .from(copies)
      .where(inArray(copies.titleId, deleted));
    const copyIds = copyRows.map((c) => c.id);

    // Get all rental IDs for copies being deleted
    const rentalRows = copyIds.length > 0
      ? await db.select({ id: rentals.id }).from(rentals).where(inArray(rentals.copyId, copyIds))
      : [];
    const rentalIds = rentalRows.map((r) => r.id);

    const rawDb = (db as any).session.client;
    rawDb.transaction(() => {
      // Delete in FK-safe order
      if (rentalIds.length > 0) {
        db.delete(transactionItems).where(inArray(transactionItems.rentalId, rentalIds)).run();
      }
      if (copyIds.length > 0) {
        db.delete(transactionItems).where(inArray(transactionItems.copyId, copyIds)).run();
        db.delete(rentals).where(inArray(rentals.copyId, copyIds)).run();
      }
      db.delete(reservations).where(inArray(reservations.titleId, deleted)).run();
      db.delete(copies).where(inArray(copies.titleId, deleted)).run();
      db.delete(titles).where(inArray(titles.id, deleted)).run();
    })();
  }

  return c.json({ deleted, skipped });
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/routes/bulk-delete.test.ts`
Expected: All bulk-delete tests PASS

- [ ] **Step 5: Run full test suite to check for regressions**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add server/routes/titles.ts tests/server/routes/bulk-delete.test.ts
git commit -m "feat: add bulk-delete endpoint for hard-deleting multiple titles"
```

---

### Task 3: Add nuke endpoint with tests

**Files:**
- Modify: `server/routes/titles.ts`
- Modify: `tests/server/routes/bulk-delete.test.ts`

Note: The nuke endpoint calls `createBackup()` which requires real filesystem access. In tests, we'll need to mock or skip the backup step. Since the project doesn't use mocks, we'll pass the backup options through the route factory and use a temp directory in tests.

- [ ] **Step 1: Update `createTitlesRoutes` to accept backup options**

The route factory at `server/routes/titles.ts` line 10 currently takes `(db: any)`. Update it to also accept backup options:

```typescript
// Update function signature:
import { createBackup } from '../lib/create-backup.js';

interface TitlesRouteOptions {
  db: any;
  dbPath?: string;
  defaultBackupDir?: string;
}

export function createTitlesRoutes(options: TitlesRouteOptions | any) {
  // Support both old signature (just db) and new options object
  const db = options.db ?? options;
  const dbPath = options.dbPath;
  const defaultBackupDir = options.defaultBackupDir;
```

This preserves backward compatibility — existing call sites passing just `db` still work.

- [ ] **Step 2: Write failing tests for nuke**

Add to `tests/server/routes/bulk-delete.test.ts`:

```typescript
import fs from 'fs';
import os from 'os';
import path from 'path';

// Update the beforeEach to pass backup options:
let tempBackupDir: string;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  // Create a temp dir for backup tests
  tempBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rerun-test-'));

  // Write a minimal DB file so createBackup has something to copy
  const tempDbPath = path.join(tempBackupDir, 'test.db');
  fs.writeFileSync(tempDbPath, '');

  const titlesRoutes = createTitlesRoutes({
    db,
    dbPath: tempDbPath,
    defaultBackupDir: tempBackupDir,
  });
  app = new Hono();
  app.route('/api/titles', titlesRoutes);
});

describe('POST /api/titles/nuke', () => {
  it('rejects without confirm string', async () => {
    const res = await app.request('/api/titles/nuke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('rejects wrong confirm string', async () => {
    const res = await app.request('/api/titles/nuke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'delete all' }),
    });

    expect(res.status).toBe(400);
  });

  it('deletes all inventory data and returns counts', async () => {
    const cust = await seedCustomer();
    const t1 = await seedTitle('Die Hard', 1988);
    const t2 = await seedTitle('Aliens', 1986);
    const c1 = await seedCopy(t1);
    const c2 = await seedCopy(t2);
    const r1 = await seedRental(c1, cust, 'returned');
    const tx = await seedTransaction(cust);
    await seedTransactionItem(tx, c1, r1);
    await seedReservation(cust, t1);

    const res = await app.request('/api/titles/nuke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE ALL' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.titlesDeleted).toBe(2);
    expect(body.copiesDeleted).toBe(2);
    expect(body.rentalsDeleted).toBe(1);
    expect(body.reservationsDeleted).toBe(1);
    expect(body.transactionItemsDeleted).toBe(1);
    expect(body.backupFile).toMatch(/^rerun-.*\.db$/);

    // Verify everything is gone
    const remainingTitles = await db.select().from(titles);
    const remainingCopies = await db.select().from(copies);
    expect(remainingTitles).toHaveLength(0);
    expect(remainingCopies).toHaveLength(0);
  });

  it('preserves transactions table', async () => {
    const cust = await seedCustomer();
    const t1 = await seedTitle('Die Hard', 1988);
    const c1 = await seedCopy(t1);
    const r1 = await seedRental(c1, cust, 'returned');
    const tx = await seedTransaction(cust);
    await seedTransactionItem(tx, c1, r1);

    await app.request('/api/titles/nuke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE ALL' }),
    });

    // Transactions are kept as financial records
    const remainingTx = await db.select().from(transactions);
    expect(remainingTx).toHaveLength(1);
  });

  it('works on empty database', async () => {
    const res = await app.request('/api/titles/nuke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE ALL' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.titlesDeleted).toBe(0);
    expect(body.copiesDeleted).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/server/routes/bulk-delete.test.ts`
Expected: Nuke tests FAIL

- [ ] **Step 4: Implement nuke endpoint**

Add to `server/routes/titles.ts` after the bulk-delete route:

```typescript
// POST /nuke — hard-delete ALL inventory data after creating a backup
routes.post('/nuke', async (c) => {
  const body = await c.req.json();

  if (body.confirm !== 'DELETE ALL') {
    return c.json({ error: 'Must send { confirm: "DELETE ALL" } to proceed' }, 400);
  }

  // Create backup first (if backup options provided)
  let backupFile = '';
  if (dbPath && defaultBackupDir) {
    try {
      const result = await createBackup({ db, dbPath, defaultBackupDir });
      backupFile = result.filename;
    } catch (err: any) {
      return c.json({ error: `Backup failed, aborting nuke: ${err.message}` }, 500);
    }
  }

  // Count before deleting
  const [tiCount] = await db.select({ count: count() }).from(transactionItems);
  const [rCount] = await db.select({ count: count() }).from(rentals);
  const [resCount] = await db.select({ count: count() }).from(reservations);
  const [cCount] = await db.select({ count: count() }).from(copies);
  const [tCount] = await db.select({ count: count() }).from(titles);

  const rawDb = (db as any).session.client;
  rawDb.transaction(() => {
    db.delete(transactionItems).run();
    db.delete(rentals).run();
    db.delete(reservations).run();
    db.delete(copies).run();
    db.delete(titles).run();
  })();

  return c.json({
    titlesDeleted: tCount.count,
    copiesDeleted: cCount.count,
    rentalsDeleted: rCount.count,
    reservationsDeleted: resCount.count,
    transactionItemsDeleted: tiCount.count,
    backupFile,
  });
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/server/routes/bulk-delete.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add server/routes/titles.ts tests/server/routes/bulk-delete.test.ts
git commit -m "feat: add nuke endpoint for wiping all inventory with backup"
```

---

### Task 4: Update where `createTitlesRoutes` is called in production

**Files:**
- Modify: `server/app.ts:51`

- [ ] **Step 1: Update the production call site in `server/app.ts`**

At line 51, `server/app.ts` already imports `DB_PATH` (line 27) and computes `defaultBackupDir` (line 47). Update the `createTitlesRoutes` call:

```typescript
// Before (line 51):
app.route('/api/titles', createTitlesRoutes(db));

// After:
app.route('/api/titles', createTitlesRoutes({ db, dbPath: DB_PATH, defaultBackupDir }));
```

The `defaultBackupDir` variable is already defined at line 47: `const defaultBackupDir = path.join(path.dirname(DB_PATH), 'backups');`

- [ ] **Step 2: Verify existing tests still pass**

Run: `npx vitest run`
Expected: All tests pass (backward-compatible signature)

- [ ] **Step 3: Commit**

```bash
git add server/app.ts
git commit -m "feat: pass backup options to titles routes for nuke endpoint"
```

---

## Chunk 2: Frontend — API Client & Select Mode

### Task 5: Add API client methods

**Files:**
- Modify: `client/src/api/client.ts:51-58`

- [ ] **Step 1: Add bulkDelete and nuke methods to the titles API**

Add these two methods to the `titles` object in `client/src/api/client.ts` (after the existing `delete` method around line 57):

```typescript
titles: {
  // ... existing methods ...
  delete: (id: string) => del<any>(`/api/titles/${id}`),
  bulkDelete: (ids: string[]) => post<any>('/api/titles/bulk-delete', { ids }),
  nuke: (confirm: string) => post<any>('/api/titles/nuke', { confirm }),
},
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/client.ts
git commit -m "feat: add bulkDelete and nuke API client methods"
```

---

### Task 6: Add select mode to InventoryBrowser

**Files:**
- Modify: `client/src/components/inventory/InventoryBrowser.tsx`

This is the largest UI change. Add:
1. `selectMode` state and `selectedIds` set
2. "Select" / "Cancel" toggle button in the top bar
3. Checkboxes on title cards (grid) and rows (list)
4. Sticky action bar at bottom with select-all, count, and delete button
5. Confirm dialog and result message

- [ ] **Step 1: Add select mode state variables**

Add after the existing state declarations (around line 224):

```typescript
// Select mode
const [selectMode, setSelectMode] = useState(false);
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [bulkDeleting, setBulkDeleting] = useState(false);
const [bulkResult, setBulkResult] = useState<{ deleted: string[]; skipped: any[] } | null>(null);
```

- [ ] **Step 2: Add select mode helper functions**

Add after the state declarations:

```typescript
function toggleSelect(id: string) {
  setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}

function toggleSelectAll() {
  if (selectedIds.size === titles.length) {
    setSelectedIds(new Set());
  } else {
    setSelectedIds(new Set(titles.map((t) => t.id)));
  }
}

function exitSelectMode() {
  setSelectMode(false);
  setSelectedIds(new Set());
  setBulkResult(null);
}

async function handleBulkDelete() {
  if (selectedIds.size === 0) return;
  const count = selectedIds.size;
  if (!window.confirm(`Permanently delete ${count} title${count !== 1 ? 's' : ''} and all their copies? This cannot be undone.`)) return;

  setBulkDeleting(true);
  try {
    const result = await api.titles.bulkDelete(Array.from(selectedIds));
    setBulkResult(result);
    setSelectedIds(new Set());
    // Refresh the list
    fetchTitles(1);
  } catch (err: any) {
    setError(err.message || 'Bulk delete failed');
  } finally {
    setBulkDeleting(false);
  }
}
```

- [ ] **Step 3: Add "Select" button to top bar**

In the top bar JSX (around line 375, after the "+ Add Title" button), add:

```tsx
{!selectMode ? (
  <Button variant="secondary" onClick={() => setSelectMode(true)}>
    Select
  </Button>
) : (
  <Button variant="secondary" onClick={exitSelectMode}>
    Cancel
  </Button>
)}
```

Hide the "+ Add Title" button when in select mode to avoid confusion.

- [ ] **Step 4: Add checkboxes to grid view**

Wrap each `TitleCard` in the grid view (around line 465) with a selectable container:

```tsx
{titles.length > 0 && viewMode === 'grid' && (
  <div style={gridStyle}>
    {titles.map((title) => (
      <div key={title.id} style={{ position: 'relative' }}>
        {selectMode && (
          <input
            type="checkbox"
            checked={selectedIds.has(title.id)}
            onChange={() => toggleSelect(title.id)}
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              zIndex: 2,
              accentColor: 'var(--crt-green)',
              width: '18px',
              height: '18px',
              cursor: 'pointer',
            }}
          />
        )}
        <TitleCard
          title={title}
          onClick={selectMode ? () => toggleSelect(title.id) : handleTitleClick}
        />
      </div>
    ))}
  </div>
)}
```

- [ ] **Step 5: Add checkboxes to list view**

For the Table/list view (around line 471), add a checkbox column when in select mode. This depends on how the `Table` component works — you may need to prepend a checkbox column to `listColumns` and `listData` when `selectMode` is true.

- [ ] **Step 6: Add sticky action bar**

Add after the main content area, before the closing `</div>` of `mainAreaStyle`:

```tsx
{selectMode && (
  <div style={{
    position: 'sticky',
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-md)',
    padding: 'var(--space-sm) var(--space-md)',
    borderTop: '1px solid var(--border-color)',
    backgroundColor: 'var(--bg-secondary)',
  }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--text-primary)', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={titles.length > 0 && selectedIds.size === titles.length}
        onChange={toggleSelectAll}
        style={{ accentColor: 'var(--crt-green)' }}
      />
      Select All on Page
    </label>
    <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
      {selectedIds.size} selected
    </span>
    <div style={{ flex: 1 }} />
    <Button
      variant="danger"
      onClick={handleBulkDelete}
      disabled={selectedIds.size === 0 || bulkDeleting}
    >
      {bulkDeleting ? 'Deleting...' : 'Delete Selected'}
    </Button>
  </div>
)}
```

- [ ] **Step 7: Add bulk result message**

Add after the action bar:

```tsx
{bulkResult && (
  <div style={{
    padding: 'var(--space-sm) var(--space-md)',
    backgroundColor: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border-color)',
    color: 'var(--crt-green)',
    fontSize: 'var(--font-size-sm)',
  }}>
    Deleted {bulkResult.deleted.length} title{bulkResult.deleted.length !== 1 ? 's' : ''}.
    {bulkResult.skipped.length > 0 && (
      <> Skipped {bulkResult.skipped.length} with active rentals: {bulkResult.skipped.map((s) => s.name).join(', ')}.</>
    )}
    <Button variant="secondary" onClick={() => setBulkResult(null)} style={{ marginLeft: 'var(--space-sm)' }}>
      Dismiss
    </Button>
  </div>
)}
```

- [ ] **Step 8: Test manually in browser**

Run: `npm run dev`
Verify:
- "Select" button appears in toolbar
- Clicking toggles select mode with checkboxes
- Selecting titles shows count in action bar
- "Select All on Page" works
- "Delete Selected" shows confirm, then deletes
- Skipped titles show in result message
- "Cancel" exits select mode

- [ ] **Step 9: Commit**

```bash
git add client/src/components/inventory/InventoryBrowser.tsx
git commit -m "feat: add select mode with bulk delete to InventoryBrowser"
```

---

## Chunk 3: Frontend — Danger Zone in Settings

### Task 7: Create DangerZone component

**Files:**
- Create: `client/src/components/settings/DangerZone.tsx`

- [ ] **Step 1: Create the DangerZone component**

```typescript
// ABOUTME: Danger Zone section for Settings page with destructive inventory operations
// ABOUTME: Provides "Clear All Inventory" with backup, type-to-confirm, and count display

import { type CSSProperties, useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

const dangerZoneStyle: CSSProperties = {
  border: '1px solid var(--crt-red, #ff4444)',
  borderRadius: 'var(--radius-md, 4px)',
  padding: 'var(--space-md)',
  marginTop: 'var(--space-lg)',
};

const dangerHeaderStyle: CSSProperties = {
  color: 'var(--crt-red, #ff4444)',
  fontSize: 'var(--font-size-lg)',
  fontFamily: 'inherit',
  marginBottom: 'var(--space-md)',
  textTransform: 'uppercase',
  letterSpacing: '2px',
};

const dangerDescStyle: CSSProperties = {
  color: 'var(--text-secondary)',
  fontSize: 'var(--font-size-sm)',
  marginBottom: 'var(--space-md)',
};

const confirmInputStyle: CSSProperties = {
  backgroundColor: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
  padding: 'var(--space-xs) var(--space-sm)',
  fontFamily: 'inherit',
  fontSize: 'var(--font-size-sm)',
  width: '100%',
  marginTop: 'var(--space-sm)',
  marginBottom: 'var(--space-sm)',
};

interface InventoryCounts {
  titles: number;
  copies: number;
}

export function DangerZone() {
  const [showNukeModal, setShowNukeModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [counts, setCounts] = useState<InventoryCounts | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [nuking, setNuking] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    try {
      const data = await api.titles.list({ limit: '1' });
      setCounts({
        titles: data.total ?? 0,
        copies: 0, // We'll get this from the nuke response
      });
    } catch {
      // Non-critical, continue without counts
    }
  }, []);

  function openNukeModal() {
    setConfirmText('');
    setBackupStatus(null);
    setResult(null);
    setError(null);
    fetchCounts();
    setShowNukeModal(true);
  }

  async function handleNuke() {
    setNuking(true);
    setError(null);
    try {
      const data = await api.titles.nuke('DELETE ALL');
      setResult(data);
      setBackupStatus(data.backupFile);
    } catch (err: any) {
      setError(err.message || 'Nuke failed');
    } finally {
      setNuking(false);
    }
  }

  return (
    <div style={dangerZoneStyle}>
      <div style={dangerHeaderStyle}>Danger Zone</div>
      <div style={dangerDescStyle}>
        Irreversible actions. A backup is created automatically before any destructive operation.
      </div>
      <Button variant="danger" onClick={openNukeModal}>
        Clear All Inventory
      </Button>

      <Modal
        isOpen={showNukeModal}
        onClose={() => setShowNukeModal(false)}
        title="Clear All Inventory"
      >
        {!result ? (
          <>
            <p style={{ color: 'var(--text-primary)', margin: '0 0 var(--space-md) 0' }}>
              This will permanently delete
              {counts ? ` ${counts.titles} titles and` : ''} all copies, rentals,
              reservations, and transaction line items. Financial transaction records are preserved.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-md) 0' }}>
              A backup will be created automatically before deletion.
            </p>
            <label style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)' }}>
              Type <strong>DELETE ALL</strong> to confirm:
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                style={confirmInputStyle}
                autoFocus
                placeholder="DELETE ALL"
              />
            </label>
            {error && (
              <p style={{ color: 'var(--crt-red, #ff4444)', fontSize: 'var(--font-size-sm)', margin: 'var(--space-sm) 0' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
              <Button variant="secondary" onClick={() => setShowNukeModal(false)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={handleNuke}
                disabled={confirmText !== 'DELETE ALL' || nuking}
              >
                {nuking ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--crt-green)', margin: '0 0 var(--space-md) 0' }}>
              Inventory cleared.
            </p>
            <ul style={{ color: 'var(--text-primary)', fontSize: 'var(--font-size-sm)', margin: '0 0 var(--space-md) 0', paddingLeft: 'var(--space-md)' }}>
              <li>{result.titlesDeleted} titles deleted</li>
              <li>{result.copiesDeleted} copies deleted</li>
              <li>{result.rentalsDeleted} rentals deleted</li>
              <li>{result.reservationsDeleted} reservations deleted</li>
              <li>{result.transactionItemsDeleted} transaction items deleted</li>
            </ul>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
              Backup saved as: {result.backupFile}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
              <Button variant="secondary" onClick={() => setShowNukeModal(false)}>Close</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Import and render DangerZone in SettingsPage**

In `client/src/components/settings/SettingsPage.tsx`:

Add import at top:
```typescript
import { DangerZone } from './DangerZone';
```

Add the component just before the `{/* Save Button */}` comment (before line 1027):

```tsx
<DangerZone />
```

- [ ] **Step 3: Test manually in browser**

Run: `npm run dev`
Navigate to Settings, scroll to bottom. Verify:
- Red-bordered "Danger Zone" section visible
- "Clear All Inventory" button opens modal
- Modal shows inventory count
- Type-to-confirm: "Confirm Delete" button disabled until typing "DELETE ALL"
- Case-sensitive (lowercase "delete all" doesn't work)
- Successful nuke shows result with counts and backup filename
- Modal can be closed after completion

- [ ] **Step 4: Commit**

```bash
git add client/src/components/settings/DangerZone.tsx client/src/components/settings/SettingsPage.tsx
git commit -m "feat: add Danger Zone with nuke inventory to Settings"
```

---

## Chunk 4: Final Integration & Verification

### Task 8: End-to-end verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: No TypeScript errors

- [ ] **Step 3: Manual end-to-end test**

Run: `npm run dev`

Test bulk delete flow:
1. Add 3-4 test titles via "+ Add Title"
2. Click "Select" → checkboxes appear
3. Select 2 titles → count shows "2 selected"
4. Click "Select All on Page" → all selected
5. Click "Delete Selected" → confirm dialog
6. Confirm → titles removed, result message shown
7. Click "Cancel" → exits select mode

Test nuke flow:
1. Add a few test titles
2. Go to Settings → scroll to Danger Zone
3. Click "Clear All Inventory"
4. Try typing "delete all" (lowercase) → button stays disabled
5. Type "DELETE ALL" → button enables
6. Click "Confirm Delete" → shows result with backup filename
7. Close modal → go to Inventory → should be empty

- [ ] **Step 4: Commit any fixes**

If any issues found, fix and commit with descriptive message.
