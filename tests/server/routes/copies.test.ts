// ABOUTME: Tests for the copies API routes (update copy and barcode lookup)
// ABOUTME: Covers updating copy status/condition and looking up copies by barcode

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createCopiesRoutes } from '../../../server/routes/copies.js';
import { titles, copies } from '../../../server/db/schema.js';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const copiesRoutes = createCopiesRoutes(db);
  app = new Hono();
  app.route('/api/copies', copiesRoutes);
});

describe('PUT /api/copies/:id', () => {
  it('updates copy status', async () => {
    const titleId = nanoid();
    const copyId = nanoid();
    await db.insert(titles).values({ id: titleId, name: 'Jaws', year: 1975 });
    await db.insert(copies).values({
      id: copyId,
      titleId,
      barcode: 'DVD-JAW-001',
      format: 'DVD',
      status: 'in',
      condition: 'good',
    });

    const res = await app.request(`/api/copies/${copyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'out' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('out');
    expect(body.condition).toBe('good'); // unchanged
  });

  it('updates copy condition', async () => {
    const titleId = nanoid();
    const copyId = nanoid();
    await db.insert(titles).values({ id: titleId, name: 'E.T.', year: 1982 });
    await db.insert(copies).values({
      id: copyId,
      titleId,
      barcode: 'VHS-ET-001',
      format: 'VHS',
      status: 'in',
      condition: 'good',
    });

    const res = await app.request(`/api/copies/${copyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ condition: 'damaged' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.condition).toBe('damaged');
    expect(body.status).toBe('in'); // unchanged
  });

  it('updates both status and condition at once', async () => {
    const titleId = nanoid();
    const copyId = nanoid();
    await db.insert(titles).values({ id: titleId, name: 'Top Gun', year: 1986 });
    await db.insert(copies).values({
      id: copyId,
      titleId,
      barcode: 'BLU-TG-001',
      format: 'Blu-ray',
      status: 'in',
      condition: 'good',
    });

    const res = await app.request(`/api/copies/${copyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'lost', condition: 'poor' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('lost');
    expect(body.condition).toBe('poor');
  });

  it('returns 404 for non-existent copy', async () => {
    const res = await app.request('/api/copies/nonexistent-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'out' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('GET /api/copies/barcode/:barcode', () => {
  it('returns copy with title info by barcode', async () => {
    const titleId = nanoid();
    const copyId = nanoid();
    await db.insert(titles).values({
      id: titleId,
      name: 'Back to the Future',
      year: 1985,
      genre: 'Sci-Fi',
    });
    await db.insert(copies).values({
      id: copyId,
      titleId,
      barcode: 'DVD-BTF-001',
      format: 'DVD',
      status: 'in',
      condition: 'good',
    });

    const res = await app.request('/api/copies/barcode/DVD-BTF-001');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(copyId);
    expect(body.barcode).toBe('DVD-BTF-001');
    expect(body.format).toBe('DVD');
    expect(body.status).toBe('in');
    expect(body.title).toBeDefined();
    expect(body.title.id).toBe(titleId);
    expect(body.title.name).toBe('Back to the Future');
    expect(body.title.year).toBe(1985);
  });

  it('returns 404 for non-existent barcode', async () => {
    const res = await app.request('/api/copies/barcode/FAKE-BARCODE');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
