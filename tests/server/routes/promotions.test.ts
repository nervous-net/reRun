// ABOUTME: Tests for the promotions API routes (list, create, update)
// ABOUTME: Validates CRUD operations and allowedFields filtering using in-memory SQLite

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createPromotionsRoutes } from '../../../server/routes/promotions.js';
import { promotions } from '../../../server/db/schema.js';
import { nanoid } from 'nanoid';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

beforeAll(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const routes = createPromotionsRoutes(db);
  app = new Hono();
  app.route('/api/promotions', routes);
});

beforeEach(() => {
  sqlite.exec('DELETE FROM promotions');
});

async function createPromotion(overrides: Record<string, any> = {}) {
  const res = await app.request('/api/promotions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: overrides.name ?? 'Twofer Tuesday',
      type: overrides.type ?? 'bogo',
      rules: overrides.rules ?? '{"buy":1,"get":1}',
      startDate: overrides.startDate ?? '2026-01-01',
      endDate: overrides.endDate ?? '2026-12-31',
      ...overrides,
    }),
  });
  return res;
}

describe('GET /api/promotions', () => {
  it('returns empty array when no promotions exist', async () => {
    const res = await app.request('/api/promotions');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
  });

  it('returns all promotions', async () => {
    await createPromotion({ name: 'Weekend Deal' });
    await createPromotion({ name: 'Holiday Special' });

    const res = await app.request('/api/promotions');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });
});

describe('POST /api/promotions', () => {
  it('creates a promotion with all fields', async () => {
    const res = await createPromotion();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Twofer Tuesday');
    expect(body.type).toBe('bogo');
    expect(body.rules).toBe('{"buy":1,"get":1}');
    expect(body.active).toBe(1);
  });

  it('returns 400 when name is missing', async () => {
    const res = await app.request('/api/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'bogo' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it('returns 400 when type is missing', async () => {
    const res = await app.request('/api/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Deal' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/type/i);
  });

  it('defaults active to 1 when not provided', async () => {
    const res = await createPromotion();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.active).toBe(1);
  });
});

describe('PUT /api/promotions/:id', () => {
  it('updates allowed fields', async () => {
    const createRes = await createPromotion();
    const created = await createRes.json();

    const res = await app.request(`/api/promotions/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Deal', active: 0 }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated Deal');
    expect(body.active).toBe(0);
  });

  it('returns 404 for nonexistent promotion', async () => {
    const res = await app.request('/api/promotions/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ghost' }),
    });

    expect(res.status).toBe(404);
  });

  it('ignores fields not in allowedFields', async () => {
    const createRes = await createPromotion();
    const created = await createRes.json();

    const res = await app.request(`/api/promotions/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Still Good', id: 'hacked-id' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(created.id);
    expect(body.name).toBe('Still Good');
  });

  it('handles empty update body gracefully', async () => {
    const createRes = await createPromotion();
    const created = await createRes.json();

    const res = await app.request(`/api/promotions/${created.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Twofer Tuesday');
  });
});
