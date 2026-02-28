// ABOUTME: Tests for the store settings API routes (get all, get by key, upsert)
// ABOUTME: Validates all settings endpoints using in-memory SQLite test database

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
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
