// ABOUTME: Tests for bulk-delete endpoint on the titles router
// ABOUTME: Covers hard-deletion cascades, active rental skipping, and edge cases

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createTitlesRoutes } from '../../../server/routes/titles.js';
import { titles, copies, rentals, reservations, transactionItems, transactions, customers } from '../../../server/db/schema.js';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const titlesRoutes = createTitlesRoutes(db);
  app = new Hono();
  app.route('/api/titles', titlesRoutes);
});

// --- Seed helpers ---
async function seedTitle(name: string, year: number) {
  const id = nanoid();
  await db.insert(titles).values({ id, name, year });
  return id;
}

async function seedCopy(titleId: string, format = 'DVD') {
  const id = nanoid();
  const barcode = `${format}-${id}`;
  await db.insert(copies).values({ id, titleId, barcode, format });
  return id;
}

async function seedCustomer() {
  const id = nanoid();
  await db.insert(customers).values({ id, firstName: 'Test', lastName: 'Customer', phone: '555-0000', memberBarcode: `MBR-${id}` });
  return id;
}

async function seedRental(copyId: string, customerId: string, status = 'out') {
  const id = nanoid();
  await db.insert(rentals).values({
    id, copyId, customerId, status,
    checkedOutAt: new Date().toISOString(),
    dueAt: new Date().toISOString(),
  });
  return id;
}

async function seedTransaction(customerId: string) {
  const id = nanoid();
  await db.insert(transactions).values({
    id, customerId, type: 'rental',
    subtotal: 500, tax: 0, total: 500, paymentMethod: 'cash',
  });
  return id;
}

async function seedTransactionItem(transactionId: string, copyId: string, rentalId: string) {
  const id = nanoid();
  await db.insert(transactionItems).values({
    id, transactionId, type: 'rental', copyId, rentalId, amount: 500,
  });
  return id;
}

async function seedReservation(customerId: string, titleId: string) {
  const id = nanoid();
  await db.insert(reservations).values({
    id, customerId, titleId,
    reservedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  return id;
}

describe('POST /api/titles/bulk-delete', () => {
  it('deletes multiple titles and their copies', async () => {
    const t1 = await seedTitle('Die Hard', 1988);
    const t2 = await seedTitle('Aliens', 1986);
    await seedCopy(t1);
    await seedCopy(t2);

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1, t2] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toContain(t1);
    expect(body.deleted).toContain(t2);
    expect(body.skipped).toHaveLength(0);
  });

  it('deletes associated rentals, reservations, and transaction items', async () => {
    const t1 = await seedTitle('Terminator', 1984);
    const c1 = await seedCopy(t1);
    const cust = await seedCustomer();
    const r1 = await seedRental(c1, cust, 'returned');
    const tx = await seedTransaction(cust);
    await seedTransactionItem(tx, c1, r1);
    await seedReservation(cust, t1);

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toContain(t1);

    const remainingCopies = await db.select().from(copies);
    const remainingRentals = await db.select().from(rentals);
    const remainingReservations = await db.select().from(reservations);
    const remainingTxItems = await db.select().from(transactionItems);
    expect(remainingCopies).toHaveLength(0);
    expect(remainingRentals).toHaveLength(0);
    expect(remainingReservations).toHaveLength(0);
    expect(remainingTxItems).toHaveLength(0);
  });

  it('skips titles with active rentals', async () => {
    const t1 = await seedTitle('Die Hard', 1988);
    const t2 = await seedTitle('Aliens', 1986);
    const c1 = await seedCopy(t1);
    await seedCopy(t2);
    const cust = await seedCustomer();
    await seedRental(c1, cust, 'out');

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1, t2] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toContain(t2);
    expect(body.deleted).not.toContain(t1);
    expect(body.skipped).toHaveLength(1);
    expect(body.skipped[0].id).toBe(t1);
    expect(body.skipped[0].reason).toBe('active rental');
  });

  it('returns empty deleted array when all titles have active rentals', async () => {
    const t1 = await seedTitle('Die Hard', 1988);
    const t2 = await seedTitle('Aliens', 1986);
    const c1 = await seedCopy(t1);
    const c2 = await seedCopy(t2);
    const cust = await seedCustomer();
    await seedRental(c1, cust, 'out');
    await seedRental(c2, cust, 'out');

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1, t2] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toHaveLength(0);
    expect(body.skipped).toHaveLength(2);
  });

  it('returns 400 for empty ids array', async () => {
    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for ids array exceeding 500', async () => {
    const ids = Array.from({ length: 501 }, () => nanoid());
    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    expect(res.status).toBe(400);
  });

  it('handles non-existent IDs gracefully', async () => {
    const t1 = await seedTitle('Real Movie', 2000);
    await seedCopy(t1);

    const res = await app.request('/api/titles/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [t1, 'nonexistent-id'] }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toContain(t1);
  });
});
