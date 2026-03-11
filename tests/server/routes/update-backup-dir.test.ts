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
