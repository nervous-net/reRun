// ABOUTME: Tests for the alerts API routes (dashboard alerts, alert configs)
// ABOUTME: Validates GET /alerts aggregation and alert config CRUD operations

import { describe, it, expect } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createAlertsRoutes } from '../../../server/routes/alerts.js';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import {
  customers,
  titles,
  copies,
  rentals,
  pricingRules,
  products,
  alertConfigs,
} from '../../../server/db/schema.js';
import { eq } from 'drizzle-orm';

function buildApp() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  const routes = createAlertsRoutes(db);
  const app = new Hono();
  app.route('/api/alerts', routes);
  return { app, db, sqlite };
}

async function seedOverdueRental(db: any) {
  const customerId = nanoid();
  await db.insert(customers).values({
    id: customerId,
    firstName: 'Overdue',
    lastName: 'Customer',
    memberBarcode: `MBR-${nanoid(8)}`,
    balance: 0,
  });

  const titleId = nanoid();
  await db.insert(titles).values({
    id: titleId,
    name: 'Overdue Movie',
    year: 1999,
  });

  const copyId = nanoid();
  await db.insert(copies).values({
    id: copyId,
    titleId,
    barcode: `BC-${nanoid(6)}`,
    format: 'DVD',
    status: 'out',
  });

  const pricingRuleId = nanoid();
  await db.insert(pricingRules).values({
    id: pricingRuleId,
    name: '7-Day',
    type: 'rental',
    rate: 399,
    durationDays: 7,
    lateFeePerDay: 100,
    active: 1,
  });

  const rentalId = nanoid();
  await db.insert(rentals).values({
    id: rentalId,
    customerId,
    copyId,
    pricingRuleId,
    checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'out',
  });

  return { customerId, titleId, copyId, rentalId };
}

async function seedBirthdayCustomer(db: any) {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  const customerId = nanoid();
  await db.insert(customers).values({
    id: customerId,
    firstName: 'Birthday',
    lastName: 'Pal',
    memberBarcode: `MBR-${nanoid(8)}`,
    birthday: `1988-${month}-${day}`,
    balance: 0,
  });
  return customerId;
}

async function seedLowStockProduct(db: any) {
  const id = nanoid();
  await db.insert(products).values({
    id,
    name: 'Low Stock Item',
    sku: `SKU-${nanoid(6)}`,
    price: 199,
    cost: 99,
    stockQty: 1,
    reorderLevel: 10,
    active: 1,
  });
  return id;
}

describe('Alerts API', () => {
  describe('GET /api/alerts', () => {
    it('returns overdue, birthdays, and lowStock arrays', async () => {
      const { app, db } = buildApp();

      await seedOverdueRental(db);
      await seedBirthdayCustomer(db);
      await seedLowStockProduct(db);

      const res = await app.request('/api/alerts');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body.overdue)).toBe(true);
      expect(Array.isArray(body.birthdays)).toBe(true);
      expect(Array.isArray(body.lowStock)).toBe(true);
      expect(body.overdue.length).toBe(1);
      expect(body.birthdays.length).toBe(1);
      expect(body.lowStock.length).toBe(1);
    });

    it('returns empty arrays when no alerts exist', async () => {
      const { app } = buildApp();

      const res = await app.request('/api/alerts');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.overdue).toEqual([]);
      expect(body.birthdays).toEqual([]);
      expect(body.lowStock).toEqual([]);
    });
  });

  describe('GET /api/alerts/configs', () => {
    it('returns all alert configurations', async () => {
      const { app, db } = buildApp();

      const id = nanoid();
      await db.insert(alertConfigs).values({
        id,
        type: 'overdue',
        template: 'Your rental of {{title}} is overdue!',
        enabled: 1,
      });

      const res = await app.request('/api/alerts/configs');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].type).toBe('overdue');
      expect(body.data[0].template).toContain('overdue');
    });
  });

  describe('PUT /api/alerts/configs/:id', () => {
    it('updates an alert config', async () => {
      const { app, db } = buildApp();

      const id = nanoid();
      await db.insert(alertConfigs).values({
        id,
        type: 'overdue',
        template: 'Old template',
        enabled: 1,
      });

      const res = await app.request(`/api/alerts/configs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'Updated template', enabled: 0 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.template).toBe('Updated template');
      expect(body.enabled).toBe(0);
    });

    it('returns 404 for nonexistent config', async () => {
      const { app } = buildApp();

      const res = await app.request('/api/alerts/configs/nonexistent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: 'test' }),
      });

      expect(res.status).toBe(404);
    });
  });
});
