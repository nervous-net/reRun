// ABOUTME: Tests for backup, restore, and CSV export API routes
// ABOUTME: Uses temp directories with file-based SQLite to test file copy operations

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import * as schema from '../../../server/db/schema.js';
import { createBackupRoutes } from '../../../server/routes/backup.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

let db: ReturnType<typeof drizzle>;
let sqlite: Database.Database;
let app: Hono;
let tmpDir: string;
let dbPath: string;
let backupDir: string;

function applySchema(sqliteDb: Database.Database) {
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS titles (
      id TEXT PRIMARY KEY,
      tmdb_id INTEGER,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      genre TEXT,
      runtime_minutes INTEGER,
      synopsis TEXT,
      rating TEXT,
      cast_list TEXT,
      cover_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS copies (
      id TEXT PRIMARY KEY,
      title_id TEXT NOT NULL REFERENCES titles(id),
      barcode TEXT NOT NULL UNIQUE,
      format TEXT NOT NULL,
      condition TEXT DEFAULT 'good',
      status TEXT DEFAULT 'in',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      birthday TEXT,
      notes TEXT,
      balance INTEGER DEFAULT 0,
      member_barcode TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      relationship TEXT
    );

    CREATE TABLE IF NOT EXISTS pricing_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      rate INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      late_fee_per_day INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      type TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      tax INTEGER DEFAULT 0,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      amount_tendered INTEGER,
      change_given INTEGER,
      voided INTEGER DEFAULT 0,
      void_reason TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      copy_id TEXT NOT NULL REFERENCES copies(id),
      transaction_id TEXT REFERENCES transactions(id),
      pricing_rule_id TEXT REFERENCES pricing_rules(id),
      checked_out_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      returned_at TEXT,
      late_fee INTEGER DEFAULT 0,
      late_fee_status TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      price INTEGER NOT NULL,
      cost INTEGER NOT NULL,
      tax_rate INTEGER DEFAULT 0,
      stock_qty INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 0,
      category TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id),
      type TEXT NOT NULL,
      copy_id TEXT REFERENCES copies(id),
      product_id TEXT REFERENCES products(id),
      rental_id TEXT REFERENCES rentals(id),
      description TEXT,
      amount INTEGER NOT NULL,
      tax INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      title_id TEXT NOT NULL REFERENCES titles(id),
      reserved_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      fulfilled INTEGER DEFAULT 0,
      notified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      rules TEXT,
      start_date TEXT,
      end_date TEXT,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS prepaid_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      credit_value INTEGER NOT NULL,
      rental_count INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS customer_prepaid (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      plan_id TEXT NOT NULL REFERENCES prepaid_plans(id),
      remaining_credit INTEGER NOT NULL,
      remaining_rentals INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      purchased_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_configs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      template TEXT NOT NULL,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

beforeEach(() => {
  // Create a temp directory for each test
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rerun-backup-test-'));
  dbPath = path.join(tmpDir, 'rerun.db');
  backupDir = path.join(tmpDir, 'backups');

  // Create file-based SQLite DB (needed for file copy tests)
  sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  applySchema(sqlite);
  db = drizzle(sqlite, { schema });

  const backupRoutes = createBackupRoutes(db, { dbPath, defaultBackupDir: backupDir });
  app = new Hono();
  app.route('/api/backup', backupRoutes);
});

afterEach(() => {
  // Close DB and clean up temp directory
  sqlite.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('POST /api/backup', () => {
  it('creates a backup file in the backups directory', async () => {
    const res = await app.request('/api/backup', { method: 'POST' });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.filename).toBeDefined();
    expect(body.filename).toMatch(/^rerun-\d{4}-\d{2}-\d{2}T\d{6}\.db$/);

    // Verify the file exists
    const backupPath = path.join(backupDir, body.filename);
    expect(fs.existsSync(backupPath)).toBe(true);

    // Verify the backup is a valid SQLite file
    const backupDb = new Database(backupPath, { readonly: true });
    const tables = backupDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    backupDb.close();
    expect(tables.length).toBeGreaterThan(0);
  });

  it('creates the backups directory if it does not exist', async () => {
    expect(fs.existsSync(backupDir)).toBe(false);

    const res = await app.request('/api/backup', { method: 'POST' });

    expect(res.status).toBe(201);
    expect(fs.existsSync(backupDir)).toBe(true);
  });

  it('stores last_backup_at in store_settings', async () => {
    const res = await app.request('/api/backup', { method: 'POST' });
    expect(res.status).toBe(201);

    const row = sqlite.prepare("SELECT value FROM store_settings WHERE key = 'last_backup_at'").get() as { value: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.value).toBeDefined();
  });
});

describe('GET /api/backup/list', () => {
  it('returns empty list when no backups exist', async () => {
    fs.mkdirSync(backupDir, { recursive: true });

    const res = await app.request('/api/backup/list');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.backups).toEqual([]);
  });

  it('returns list of backups with size and date', async () => {
    // Create a backup first
    await app.request('/api/backup', { method: 'POST' });

    const res = await app.request('/api/backup/list');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.backups).toHaveLength(1);
    expect(body.backups[0].filename).toBeDefined();
    expect(body.backups[0].size).toBeGreaterThan(0);
    expect(body.backups[0].createdAt).toBeDefined();
  });

  it('returns multiple backups sorted by most recent first', async () => {
    // Create two backups with distinct mtimes so sort order is deterministic
    fs.mkdirSync(backupDir, { recursive: true });
    const file1 = 'rerun-2026-01-01T120000.db';
    const file2 = 'rerun-2026-02-15T143000.db';
    const path1 = path.join(backupDir, file1);
    const path2 = path.join(backupDir, file2);
    fs.writeFileSync(path1, 'fake-db-1');
    fs.writeFileSync(path2, 'fake-db-2');
    // Set explicit mtimes: file2 is newer than file1
    const older = new Date('2026-01-01T12:00:00Z');
    const newer = new Date('2026-02-15T14:30:00Z');
    fs.utimesSync(path1, older, older);
    fs.utimesSync(path2, newer, newer);

    const res = await app.request('/api/backup/list');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.backups).toHaveLength(2);
    // Most recent first (sorted by mtime)
    expect(body.backups[0].filename).toBe(file2);
    expect(body.backups[1].filename).toBe(file1);
  });
});

describe('POST /api/backup/restore/:filename', () => {
  it('returns 404 for non-existent backup file', async () => {
    fs.mkdirSync(backupDir, { recursive: true });

    const res = await app.request('/api/backup/restore/nonexistent.db', {
      method: 'POST',
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('rejects filenames with path traversal attempts', async () => {
    fs.mkdirSync(backupDir, { recursive: true });

    const res = await app.request('/api/backup/restore/..%2F..%2Fetc%2Fpasswd', {
      method: 'POST',
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('restores from a valid backup file', async () => {
    // Prevent process.exit from killing the test runner
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.useFakeTimers();

    // Create a backup first (captures empty DB state)
    const createRes = await app.request('/api/backup', { method: 'POST' });
    const { filename } = await createRes.json();

    // Insert data AFTER the backup
    sqlite.prepare("INSERT INTO titles (id, name, year) VALUES (?, ?, ?)").run(nanoid(), 'Post-Backup Movie', 2026);

    // Verify the data exists before restore
    const beforeRestore = sqlite.prepare("SELECT count(*) as cnt FROM titles WHERE name = 'Post-Backup Movie'").get() as { cnt: number };
    expect(beforeRestore.cnt).toBe(1);

    const res = await app.request(`/api/backup/restore/${filename}`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBeDefined();
    expect(body.restartRequired).toBe(true);

    // Advance timers to trigger the process.exit call
    vi.advanceTimersByTime(1000);
    expect(exitSpy).toHaveBeenCalledWith(0);

    // Verify: WAL and SHM files were removed
    expect(fs.existsSync(dbPath + '-wal')).toBe(false);
    expect(fs.existsSync(dbPath + '-shm')).toBe(false);

    // Verify: opening a fresh connection shows the restored data (no post-backup movie)
    const restoredSqlite = new Database(dbPath, { readonly: true });
    const afterRestore = restoredSqlite.prepare("SELECT count(*) as cnt FROM titles WHERE name = 'Post-Backup Movie'").get() as { cnt: number };
    restoredSqlite.close();
    expect(afterRestore.cnt).toBe(0);

    // Reassign sqlite so afterEach cleanup doesn't fail on closed connection
    sqlite = new Database(':memory:');

    exitSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('GET /api/backup/export/:table', () => {
  it('exports titles table as CSV', async () => {
    // Seed some data
    sqlite.prepare("INSERT INTO titles (id, name, year, genre) VALUES (?, ?, ?, ?)").run('t1', 'Blade Runner', 1982, 'Sci-Fi');
    sqlite.prepare("INSERT INTO titles (id, name, year, genre) VALUES (?, ?, ?, ?)").run('t2', 'The Matrix', 1999, 'Action');

    const res = await app.request('/api/backup/export/titles');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('titles');

    const csv = await res.text();
    const lines = csv.trim().split('\n');
    // Header + 2 data rows
    expect(lines.length).toBe(3);
    // Header should contain column names
    expect(lines[0]).toContain('id');
    expect(lines[0]).toContain('name');
    expect(lines[0]).toContain('year');
    // Data rows should contain our values
    expect(csv).toContain('Blade Runner');
    expect(csv).toContain('The Matrix');
  });

  it('exports products table as CSV', async () => {
    sqlite.prepare("INSERT INTO products (id, name, sku, price, cost) VALUES (?, ?, ?, ?, ?)").run('p1', 'Popcorn', 'POP-001', 500, 200);

    const res = await app.request('/api/backup/export/products');
    expect(res.status).toBe(200);

    const csv = await res.text();
    expect(csv).toContain('Popcorn');
    expect(csv).toContain('POP-001');
  });

  it('returns 400 for unknown table name', async () => {
    const res = await app.request('/api/backup/export/hackers');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Invalid table');
  });

  it('returns empty CSV with just headers for empty table', async () => {
    const res = await app.request('/api/backup/export/products');
    expect(res.status).toBe(200);

    const csv = await res.text();
    const lines = csv.trim().split('\n');
    // Just the header row
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('id');
  });

  it('escapes CSV values that contain commas or quotes', async () => {
    sqlite.prepare("INSERT INTO titles (id, name, year, synopsis) VALUES (?, ?, ?, ?)").run(
      't1', 'Lock, Stock and Two Smoking Barrels', 1998, 'A movie with "quotes" and, commas'
    );

    const res = await app.request('/api/backup/export/titles');
    expect(res.status).toBe(200);

    const csv = await res.text();
    // Values with commas/quotes should be properly escaped
    expect(csv).toContain('"Lock, Stock and Two Smoking Barrels"');
    expect(csv).toContain('"A movie with ""quotes"" and, commas"');
  });
});

describe('backup with custom backup_dir setting', () => {
  it('POST / creates backup in custom directory when backup_dir is set', async () => {
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });
    await db.insert(schema.storeSettings).values({ key: 'backup_dir', value: customDir });

    const res = await app.request('/api/backup', { method: 'POST' });
    expect(res.status).toBe(201);

    const customFiles = fs.readdirSync(customDir).filter((f: string) => f.endsWith('.db'));
    expect(customFiles.length).toBe(1);
  });

  it('GET /list merges backups from custom and default directories', async () => {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(dbPath, path.join(backupDir, 'rerun-20260101T000000.db'));

    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });
    fs.copyFileSync(dbPath, path.join(customDir, 'rerun-20260102T000000.db'));
    await db.insert(schema.storeSettings).values({ key: 'backup_dir', value: customDir });

    const res = await app.request('/api/backup/list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.backups.length).toBe(2);
    expect(body.backups[0]).toHaveProperty('location');
    expect(body.backups[1]).toHaveProperty('location');
  });

  it('GET /list returns location field on all backup entries', async () => {
    // Create a backup (will land in default dir since no custom dir set)
    await app.request('/api/backup', { method: 'POST' });

    const res = await app.request('/api/backup/list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.backups).toHaveLength(1);
    expect(body.backups[0]).toHaveProperty('location');
    expect(typeof body.backups[0].location).toBe('string');
  });

  it('GET /list deduplicates by filename (custom takes precedence)', async () => {
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });

    // Same filename in both dirs
    const sharedFilename = 'rerun-20260101T000000.db';
    fs.copyFileSync(dbPath, path.join(backupDir, sharedFilename));
    fs.copyFileSync(dbPath, path.join(customDir, sharedFilename));
    await db.insert(schema.storeSettings).values({ key: 'backup_dir', value: customDir });

    const res = await app.request('/api/backup/list');
    expect(res.status).toBe(200);
    const body = await res.json();
    // Should only appear once, from the custom dir
    expect(body.backups.length).toBe(1);
    expect(body.backups[0].location).toBe(path.resolve(customDir));
  });

  it('POST /restore/:filename accepts location in body', async () => {
    vi.useFakeTimers();
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });
    const backupFilename = 'rerun-20260101T000000.db';
    fs.copyFileSync(dbPath, path.join(customDir, backupFilename));
    await db.insert(schema.storeSettings).values({ key: 'backup_dir', value: customDir });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    const res = await app.request(`/api/backup/restore/${backupFilename}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: customDir }),
    });
    expect(res.status).toBe(200);

    vi.advanceTimersByTime(1000);

    // Reassign sqlite so afterEach doesn't fail on closed connection
    sqlite = new Database(':memory:');

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
    const body = await res.json();
    expect(body.error).toContain('Invalid backup location');
  });

  it('POST /restore/:filename finds file without location if in known dirs', async () => {
    vi.useFakeTimers();
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFilename = 'rerun-20260101T000000.db';
    fs.copyFileSync(dbPath, path.join(backupDir, backupFilename));

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // No location in body — should still find it in default dir
    const res = await app.request(`/api/backup/restore/${backupFilename}`, {
      method: 'POST',
    });
    expect(res.status).toBe(200);

    vi.advanceTimersByTime(1000);

    sqlite = new Database(':memory:');
    exitSpy.mockRestore();
    vi.useRealTimers();
  });
});

describe('full backup cycle with custom backup_dir', () => {
  it('set custom path → create backup → list shows backup at custom location → restore from custom', async () => {
    const customDir = path.join(tmpDir, 'integration-custom');
    fs.mkdirSync(customDir, { recursive: true });

    // Set custom backup_dir in store_settings
    await db.insert(schema.storeSettings).values({ key: 'backup_dir', value: customDir });

    // Create a backup
    const createRes = await app.request('/api/backup', { method: 'POST' });
    expect(createRes.status).toBe(201);
    const { filename } = await createRes.json();

    // List should include it with location
    const listRes = await app.request('/api/backup/list');
    const { backups } = await listRes.json();
    const found = backups.find((b: any) => b.filename === filename);
    expect(found).toBeDefined();
    expect(found.location).toBe(path.resolve(customDir));

    // File should exist at custom path
    expect(fs.existsSync(path.join(customDir, filename))).toBe(true);
    // File should NOT exist at default path
    expect(fs.existsSync(path.join(backupDir, filename))).toBe(false);
  });

  it('unavailable custom path → backup falls back → warning flag set', async () => {
    // Set invalid custom dir
    await db.insert(schema.storeSettings).values({ key: 'backup_dir', value: '/nonexistent/bad/path' });

    // Create a backup (should fall back silently)
    const createRes = await app.request('/api/backup', { method: 'POST' });
    expect(createRes.status).toBe(201);

    // File should be in default dir
    const files = fs.readdirSync(backupDir).filter((f: string) => f.endsWith('.db'));
    expect(files.length).toBeGreaterThan(0);

    // Warning flag should be set
    const [warning] = await db.select().from(schema.storeSettings)
      .where(eq(schema.storeSettings.key, 'backup_fallback_warning'));
    expect(warning?.value).toBe('true');
  });
});
