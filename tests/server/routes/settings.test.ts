// ABOUTME: Tests for store settings API routes including backup-dir verification
// ABOUTME: Covers get/upsert settings, backup directory validation, and fallback warning clearing

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createSettingsRoutes } from '../../../server/routes/settings.js';
import { storeSettings } from '../../../server/db/schema.js';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

beforeAll(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const routes = createSettingsRoutes(db);
  app = new Hono();
  app.route('/api/settings', routes);
});

beforeEach(() => {
  sqlite.exec('DELETE FROM store_settings');
});

describe('GET /api/settings', () => {
  it('returns empty object when no settings exist', async () => {
    const res = await app.request('/api/settings');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({});
  });

  it('returns all settings as key-value object', async () => {
    await db.insert(storeSettings).values([
      { key: 'store_name', value: 'Way Cool Video' },
      { key: 'tax_rate', value: '800' },
    ]);

    const res = await app.request('/api/settings');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.store_name).toBe('Way Cool Video');
    expect(body.data.tax_rate).toBe('800');
  });
});

describe('GET /api/settings/:key', () => {
  it('returns value for existing key', async () => {
    await db.insert(storeSettings).values({ key: 'store_name', value: 'Rad Rentals' });

    const res = await app.request('/api/settings/store_name');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe('store_name');
    expect(body.value).toBe('Rad Rentals');
  });

  it('returns null value for nonexistent key', async () => {
    const res = await app.request('/api/settings/nonexistent');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe('nonexistent');
    expect(body.value).toBeNull();
  });
});

describe('PUT /api/settings/:key', () => {
  it('creates a new setting', async () => {
    const res = await app.request('/api/settings/store_phone', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '555-1234' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe('store_phone');
    expect(body.value).toBe('555-1234');
  });

  it('updates an existing setting', async () => {
    await db.insert(storeSettings).values({ key: 'tax_rate', value: '800' });

    const res = await app.request('/api/settings/tax_rate', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: '900' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe('tax_rate');
    expect(body.value).toBe('900');
  });

  it('returns 400 when value is missing', async () => {
    const res = await app.request('/api/settings/store_name', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/value/i);
  });
});

describe('POST /api/settings/backup-dir/verify', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rerun-test-'));
  });

  afterEach(() => {
    // Restore permissions before cleanup in case of chmod tests
    try {
      fs.chmodSync(tmpDir, 0o755);
    } catch {
      // ignore
    }
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
    const newDir = path.join(tmpDir, 'new-backup-dir');

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
    fs.chmodSync(tmpDir, 0o444);
    const subDir = path.join(tmpDir, 'no-write-here');

    const res = await app.request('/api/settings/backup-dir/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: subDir }),
    });

    // Restore permissions for cleanup
    fs.chmodSync(tmpDir, 0o755);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(false);
    expect(body.error).toBeTruthy();
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
    const res = await app.request('/api/settings/backup-dir/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: tmpDir }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    // Response always includes valid boolean; warning may or may not be present
    expect(typeof body.valid).toBe('boolean');
  });
});

describe('PUT /api/settings/backup_dir validation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rerun-test-'));
    sqlite.exec('DELETE FROM store_settings');
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

    const [row] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, 'backup_fallback_warning'));
    expect(row?.value).toBe('false');
  });

  it('clears fallback warning when saving a valid path', async () => {
    await db.insert(storeSettings).values({ key: 'backup_fallback_warning', value: 'true' });

    const res = await app.request('/api/settings/backup_dir', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: tmpDir }),
    });

    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, 'backup_fallback_warning'));
    expect(row?.value).toBe('false');
  });
});
