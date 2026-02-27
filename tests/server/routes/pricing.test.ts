// ABOUTME: Tests for the pricing rules API routes (CRUD with soft-delete)
// ABOUTME: Validates all pricing rule endpoints using in-memory SQLite test database

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createPricingRoutes } from '../../../server/routes/pricing.js';
import { pricingRules } from '../../../server/db/schema.js';
import { nanoid } from 'nanoid';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

beforeAll(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const routes = createPricingRoutes(db);
  app = new Hono();
  app.route('/api/pricing', routes);
});

beforeEach(() => {
  sqlite.exec('DELETE FROM pricing_rules');
});

describe('POST /api/pricing', () => {
  it('creates a pricing rule with all fields', async () => {
    const res = await app.request('/api/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '3-Day New Release',
        type: 'new-release',
        rate: 499,
        durationDays: 3,
        lateFeePerDay: 150,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.id.length).toBe(21);
    expect(body.name).toBe('3-Day New Release');
    expect(body.type).toBe('new-release');
    expect(body.rate).toBe(499);
    expect(body.durationDays).toBe(3);
    expect(body.lateFeePerDay).toBe(150);
    expect(body.active).toBe(1);
  });

  it('creates a pricing rule with default lateFeePerDay of 0', async () => {
    const res = await app.request('/api/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '7-Day Catalog',
        type: 'catalog',
        rate: 299,
        durationDays: 7,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.lateFeePerDay).toBe(0);
  });

  it('returns 400 if name is missing', async () => {
    const res = await app.request('/api/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'new-release',
        rate: 499,
        durationDays: 3,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 if type is missing', async () => {
    const res = await app.request('/api/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '3-Day New Release',
        rate: 499,
        durationDays: 3,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 if rate is missing', async () => {
    const res = await app.request('/api/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '3-Day New Release',
        type: 'new-release',
        durationDays: 3,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 if durationDays is missing', async () => {
    const res = await app.request('/api/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '3-Day New Release',
        type: 'new-release',
        rate: 499,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('GET /api/pricing', () => {
  it('lists only active pricing rules', async () => {
    // Insert one active and one inactive rule
    db.insert(pricingRules).values({
      id: nanoid(),
      name: 'Active Rule',
      type: 'catalog',
      rate: 299,
      durationDays: 7,
      active: 1,
    }).run();

    db.insert(pricingRules).values({
      id: nanoid(),
      name: 'Inactive Rule',
      type: 'catalog',
      rate: 199,
      durationDays: 5,
      active: 0,
    }).run();

    const res = await app.request('/api/pricing');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Active Rule');
  });

  it('returns empty array when no active rules exist', async () => {
    db.insert(pricingRules).values({
      id: nanoid(),
      name: 'Inactive Rule',
      type: 'catalog',
      rate: 199,
      durationDays: 5,
      active: 0,
    }).run();

    const res = await app.request('/api/pricing');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });
});

describe('PUT /api/pricing/:id', () => {
  it('updates a pricing rule', async () => {
    const ruleId = nanoid();
    db.insert(pricingRules).values({
      id: ruleId,
      name: 'Old Name',
      type: 'catalog',
      rate: 299,
      durationDays: 7,
      lateFeePerDay: 100,
      active: 1,
    }).run();

    const res = await app.request(`/api/pricing/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated Name',
        rate: 399,
        lateFeePerDay: 200,
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('Updated Name');
    expect(body.rate).toBe(399);
    expect(body.lateFeePerDay).toBe(200);
    // Unchanged fields preserved
    expect(body.type).toBe('catalog');
    expect(body.durationDays).toBe(7);
    expect(body.active).toBe(1);
  });

  it('returns 404 for non-existent rule', async () => {
    const res = await app.request('/api/pricing/nonexistent-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('DELETE /api/pricing/:id', () => {
  it('deactivates a pricing rule (soft delete)', async () => {
    const ruleId = nanoid();
    db.insert(pricingRules).values({
      id: ruleId,
      name: 'To Deactivate',
      type: 'new-release',
      rate: 499,
      durationDays: 3,
      active: 1,
    }).run();

    const res = await app.request(`/api/pricing/${ruleId}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify it no longer appears in list
    const listRes = await app.request('/api/pricing');
    const listBody = await listRes.json();
    expect(listBody.data).toHaveLength(0);
  });

  it('returns 404 for non-existent rule', async () => {
    const res = await app.request('/api/pricing/nonexistent-id', {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
