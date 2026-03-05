// ABOUTME: Tests for the dashboard recent transactions API endpoint
// ABOUTME: Validates response shape, reference code inclusion, and ordering

import { describe, it, expect } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createDashboardRoutes } from '../../../server/routes/dashboard.js';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { customers, transactions } from '../../../server/db/schema.js';

function buildApp() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  const routes = createDashboardRoutes(db);
  const app = new Hono();
  app.route('/api/dashboard', routes);
  return { app, db, sqlite };
}

async function seedCustomer(db: any, first = 'Test', last = 'Customer') {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: first,
    lastName: last,
    memberBarcode: `MBR-${nanoid(8)}`,
    balance: 0,
  });
  return id;
}

describe('Dashboard Recent Transactions API', () => {
  describe('GET /api/dashboard/recent', () => {
    it('returns 200 with data array', async () => {
      const { app } = buildApp();
      const res = await app.request('/api/dashboard/recent');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('data');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('returns empty array when no transactions exist', async () => {
      const { app } = buildApp();
      const res = await app.request('/api/dashboard/recent');
      const body = await res.json();
      expect(body.data).toHaveLength(0);
    });

    it('returns transactions with reference codes and customer names', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db, 'Alice', 'Rewind');

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 499,
        tax: 40,
        total: 539,
        paymentMethod: 'cash',
        voided: 0,
        referenceCode: 'RN-TEST',
        createdAt: new Date().toISOString(),
      });

      const res = await app.request('/api/dashboard/recent');
      const body = await res.json();

      expect(body.data).toHaveLength(1);
      const txn = body.data[0];
      expect(txn.referenceCode).toBe('RN-TEST');
      expect(txn.customerName).toBe('Alice Rewind');
      expect(txn.type).toBe('rental');
      expect(txn.total).toBe(539);
    });

    it('returns transactions ordered by most recent first', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);

      const olderDate = new Date(Date.now() - 60_000).toISOString();
      const newerDate = new Date().toISOString();

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 300,
        tax: 0,
        total: 300,
        paymentMethod: 'cash',
        voided: 0,
        referenceCode: 'RN-OLD1',
        createdAt: olderDate,
      });

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'sale',
        subtotal: 500,
        tax: 0,
        total: 500,
        paymentMethod: 'cash',
        voided: 0,
        referenceCode: 'RN-NEW1',
        createdAt: newerDate,
      });

      const res = await app.request('/api/dashboard/recent');
      const body = await res.json();

      expect(body.data).toHaveLength(2);
      expect(body.data[0].referenceCode).toBe('RN-NEW1');
      expect(body.data[1].referenceCode).toBe('RN-OLD1');
    });

    it('respects limit query parameter', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);

      for (let i = 0; i < 5; i++) {
        await db.insert(transactions).values({
          id: nanoid(),
          customerId,
          type: 'rental',
          subtotal: 100,
          tax: 0,
          total: 100,
          paymentMethod: 'cash',
          voided: 0,
          referenceCode: `RN-L${i}`,
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        });
      }

      const res = await app.request('/api/dashboard/recent?limit=2');
      const body = await res.json();
      expect(body.data).toHaveLength(2);
    });

    it('includes voided status in response', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 499,
        tax: 0,
        total: 499,
        paymentMethod: 'cash',
        voided: 1,
        voidReason: 'Customer changed mind',
        referenceCode: 'RN-VOID',
        createdAt: new Date().toISOString(),
      });

      const res = await app.request('/api/dashboard/recent');
      const body = await res.json();

      expect(body.data[0].voided).toBe(1);
      expect(body.data[0].referenceCode).toBe('RN-VOID');
    });
  });
});
