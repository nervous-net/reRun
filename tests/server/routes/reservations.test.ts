// ABOUTME: Tests for the reservations API routes (create, list, fulfill, cancel)
// ABOUTME: Covers default expiry, customer/title name joins, fulfillment, and deletion

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createReservationsRoutes } from '../../../server/routes/reservations.js';
import { reservations, customers, titles } from '../../../server/db/schema.js';
import { eq } from 'drizzle-orm';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

let customerId: string;
let titleId: string;

beforeEach(async () => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const reservationsRoutes = createReservationsRoutes(db);
  app = new Hono();
  app.route('/api/reservations', reservationsRoutes);

  // Seed a customer
  customerId = nanoid();
  await db.insert(customers).values({
    id: customerId,
    firstName: 'Johnny',
    lastName: 'Mnemonic',
    memberBarcode: nanoid(10),
  });

  // Seed a title
  titleId = nanoid();
  await db.insert(titles).values({
    id: titleId,
    name: 'Hackers',
    year: 1995,
  });
});

describe('POST /api/reservations', () => {
  it('creates a reservation with default 7-day expiry', async () => {
    const res = await app.request('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, titleId }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.customerId).toBe(customerId);
    expect(body.titleId).toBe(titleId);
    expect(body.fulfilled).toBe(0);
    expect(body.notified).toBe(0);
    expect(body.reservedAt).toBeDefined();
    expect(body.expiresAt).toBeDefined();

    // Verify expiry is roughly 7 days from now
    const reserved = new Date(body.reservedAt).getTime();
    const expires = new Date(body.expiresAt).getTime();
    const diffDays = (expires - reserved) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it('creates a reservation with custom expiresAt', async () => {
    const customExpiry = '2026-12-31T00:00:00.000Z';
    const res = await app.request('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, titleId, expiresAt: customExpiry }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.expiresAt).toBe(customExpiry);
  });

  it('returns 400 when customerId is missing', async () => {
    const res = await app.request('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titleId }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when titleId is missing', async () => {
    const res = await app.request('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('GET /api/reservations', () => {
  it('lists active reservations with customer and title names', async () => {
    // Create a reservation directly
    const resId = nanoid();
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(reservations).values({
      id: resId,
      customerId,
      titleId,
      reservedAt: now,
      expiresAt: expires,
      fulfilled: 0,
      notified: 0,
    });

    const res = await app.request('/api/reservations');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(resId);
    expect(body.data[0].customerName).toBe('Johnny Mnemonic');
    expect(body.data[0].titleName).toBe('Hackers');
  });

  it('excludes fulfilled reservations', async () => {
    // Create a fulfilled reservation
    await db.insert(reservations).values({
      id: nanoid(),
      customerId,
      titleId,
      reservedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      fulfilled: 1,
      notified: 0,
    });

    const res = await app.request('/api/reservations');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });
});

describe('PUT /api/reservations/:id/fulfill', () => {
  it('marks a reservation as fulfilled', async () => {
    const resId = nanoid();
    await db.insert(reservations).values({
      id: resId,
      customerId,
      titleId,
      reservedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      fulfilled: 0,
      notified: 0,
    });

    const res = await app.request(`/api/reservations/${resId}/fulfill`, {
      method: 'PUT',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.fulfilled).toBe(1);
  });

  it('returns 404 for non-existent reservation', async () => {
    const res = await app.request('/api/reservations/nonexistent-id/fulfill', {
      method: 'PUT',
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('DELETE /api/reservations/:id', () => {
  it('cancels a reservation by deleting it', async () => {
    const resId = nanoid();
    await db.insert(reservations).values({
      id: resId,
      customerId,
      titleId,
      reservedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      fulfilled: 0,
      notified: 0,
    });

    const res = await app.request(`/api/reservations/${resId}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify it's actually deleted
    const [deleted] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, resId));
    expect(deleted).toBeUndefined();
  });

  it('returns 404 for non-existent reservation', async () => {
    const res = await app.request('/api/reservations/nonexistent-id', {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
