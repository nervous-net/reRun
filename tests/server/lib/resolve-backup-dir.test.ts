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
