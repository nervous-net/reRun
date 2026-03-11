// ABOUTME: Tests for auto-backup middleware with dynamic backup directory resolution
// ABOUTME: Verifies backups land in custom directory and fall back when unavailable

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../../server/db/schema.js';
import { storeSettings } from '../../../server/db/schema.js';
import { createAutoBackupMiddleware, resetLastCheckDate } from '../../../server/middleware/auto-backup.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

  resetLastCheckDate();
});

afterEach(() => {
  sqliteDb.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('shouldRunDailyBackup', () => {
  it('returns true when no backup exists for today', async () => {
    const { shouldRunDailyBackup } = await import('../../../server/middleware/auto-backup.js');
    const lastBackup = '2026-03-04T10:00:00.000Z';
    const now = new Date('2026-03-05T08:00:00.000Z');
    expect(shouldRunDailyBackup(lastBackup, now)).toBe(true);
  });

  it('returns false when backup already exists for today', async () => {
    const { shouldRunDailyBackup } = await import('../../../server/middleware/auto-backup.js');
    const lastBackup = '2026-03-05T06:00:00.000Z';
    const now = new Date('2026-03-05T08:00:00.000Z');
    expect(shouldRunDailyBackup(lastBackup, now)).toBe(false);
  });

  it('returns true when no backup has ever been made', async () => {
    const { shouldRunDailyBackup } = await import('../../../server/middleware/auto-backup.js');
    expect(shouldRunDailyBackup(null, new Date())).toBe(true);
  });
});

describe('auto-backup with custom backup_dir', () => {
  it('creates backup in custom directory when backup_dir is set', async () => {
    const customDir = path.join(tmpDir, 'custom-backups');
    fs.mkdirSync(customDir, { recursive: true });
    await db.insert(storeSettings).values({ key: 'backup_dir', value: customDir });

    const middleware = createAutoBackupMiddleware(db, dbPath, defaultBackupDir);
    const app = new Hono();
    app.use('/*', middleware);
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    const customFiles = fs.readdirSync(customDir).filter(f => f.endsWith('.db'));
    expect(customFiles.length).toBe(1);
    expect(customFiles[0]).toMatch(/^rerun-daily-/);

    const defaultFiles = fs.readdirSync(defaultBackupDir).filter(f => f.endsWith('.db'));
    expect(defaultFiles.length).toBe(0);
  });

  it('falls back to default directory when custom path is unavailable', async () => {
    const badDir = '/nonexistent/impossible/path';
    await db.insert(storeSettings).values({ key: 'backup_dir', value: badDir });

    const middleware = createAutoBackupMiddleware(db, dbPath, defaultBackupDir);
    const app = new Hono();
    app.use('/*', middleware);
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    const defaultFiles = fs.readdirSync(defaultBackupDir).filter(f => f.endsWith('.db'));
    expect(defaultFiles.length).toBe(1);
  });
});
