// ABOUTME: Tests for the dashboard API route (today's activity stats endpoint)
// ABOUTME: Validates HTTP response shape and correct values from seeded data

import { describe, it, expect } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createDashboardRoutes } from '../../../server/routes/dashboard.js';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import {
  customers,
  transactions,
  titles,
  copies,
  rentals,
  pricingRules,
} from '../../../server/db/schema.js';

function buildApp() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  const routes = createDashboardRoutes(db);
  const app = new Hono();
  app.route('/api/dashboard', routes);
  return { app, db, sqlite };
}

async function seedCustomer(db: any) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: 'Test',
    lastName: 'Customer',
    memberBarcode: `MBR-${nanoid(8)}`,
    balance: 0,
  });
  return id;
}

describe('Dashboard API', () => {
  describe('GET /api/dashboard/stats', () => {
    it('returns 200 with stats shape', async () => {
      const { app } = buildApp();
      const res = await app.request('/api/dashboard/stats');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('rentalsToday');
      expect(body).toHaveProperty('returnsToday');
      expect(body).toHaveProperty('revenueCents');
      expect(body).toHaveProperty('lateFeesCollectedCents');
    });

    it('returns zeros when no activity exists', async () => {
      const { app } = buildApp();
      const res = await app.request('/api/dashboard/stats');
      const body = await res.json();

      expect(body.rentalsToday).toBe(0);
      expect(body.returnsToday).toBe(0);
      expect(body.revenueCents).toBe(0);
      expect(body.lateFeesCollectedCents).toBe(0);
    });

    it('returns correct counts with seeded data', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);

      // Create a rental transaction today
      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 32,
        total: 431,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      // Create a return today
      const titleId = nanoid();
      await db.insert(titles).values({ id: titleId, name: 'Test', year: 2024 });
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: `BC-${nanoid(6)}`,
        format: 'VHS',
        status: 'in',
      });
      const prId = nanoid();
      await db.insert(pricingRules).values({
        id: prId,
        name: '7-Day',
        type: 'rental',
        rate: 399,
        durationDays: 7,
        lateFeePerDay: 100,
        active: 1,
      });
      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId,
        pricingRuleId: prId,
        checkedOutAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        lateFee: 100,
        lateFeeStatus: 'paid',
        status: 'returned',
      });

      const res = await app.request('/api/dashboard/stats');
      const body = await res.json();

      expect(body.rentalsToday).toBe(1);
      expect(body.returnsToday).toBe(1);
      expect(body.revenueCents).toBe(431);
      expect(body.lateFeesCollectedCents).toBe(100);
    });
  });
});
