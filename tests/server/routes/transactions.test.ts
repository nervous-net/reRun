// ABOUTME: Tests for the transaction API routes (create, get, void, hold/recall)
// ABOUTME: Validates HTTP responses, status codes, and round-trip data integrity

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createTransactionsRoutes } from '../../../server/routes/transactions.js';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import {
  customers,
  products,
  storeSettings,
} from '../../../server/db/schema.js';

function buildApp() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  const routes = createTransactionsRoutes(db);
  const app = new Hono();
  app.route('/api/transactions', routes);
  return { app, db, sqlite };
}

async function seedCustomer(db: any) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: 'Cameron',
    lastName: 'Frye',
    memberBarcode: nanoid(10),
  });
  return id;
}

async function seedProduct(db: any, overrides: Record<string, any> = {}) {
  const id = nanoid();
  await db.insert(products).values({
    id,
    name: overrides.name ?? 'Candy Bar',
    sku: overrides.sku ?? `SKU-${nanoid(6)}`,
    price: overrides.price ?? 199,
    cost: overrides.cost ?? 80,
    stockQty: overrides.stockQty ?? 20,
  });
  return id;
}

async function seedTaxRate(db: any, rate: number = 800) {
  await db.insert(storeSettings).values({ key: 'tax_rate', value: String(rate) });
}

describe('Transactions API', () => {
  describe('POST /api/transactions', () => {
    it('creates a transaction and returns 201', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db, { stockQty: 15 });
      await seedTaxRate(db, 800);

      const res = await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          type: 'sale',
          paymentMethod: 'cash',
          amountTendered: 300,
          items: [
            { type: 'sale', productId, description: 'Candy', amount: 199 },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.customerId).toBe(customerId);
      expect(body.subtotal).toBe(199);
      // Tax: Math.round(199 * 800 / 10000) = Math.round(15.92) = 16
      expect(body.tax).toBe(16);
      expect(body.total).toBe(215);
      expect(body.items).toHaveLength(1);
      expect(body.referenceCode).toMatch(/^RN-[0-9A-HJ-NP-Z]{4}$/);
    });

    it('returns 400 when required fields are missing', async () => {
      const { app } = buildApp();

      const res = await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'sale' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe('GET /api/transactions/:id', () => {
    it('returns a transaction with its items', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db);
      await seedTaxRate(db, 0);

      // Create via API
      const createRes = await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          type: 'sale',
          paymentMethod: 'card',
          items: [
            { type: 'sale', productId, description: 'Candy', amount: 199 },
          ],
        }),
      });

      const created = await createRes.json();

      const res = await app.request(`/api/transactions/${created.id}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe(created.id);
      expect(body.referenceCode).toBe(created.referenceCode);
      expect(body.referenceCode).toMatch(/^RN-[0-9A-HJ-NP-Z]{4}$/);
      expect(body.items).toHaveLength(1);
      expect(body.items[0].amount).toBe(199);
    });

    it('returns 404 for non-existent transaction', async () => {
      const { app } = buildApp();

      const res = await app.request('/api/transactions/nonexistent-id');
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe('POST /api/transactions/:id/void', () => {
    it('voids a transaction and returns it', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db, { stockQty: 10 });
      await seedTaxRate(db, 0);

      const createRes = await app.request('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          type: 'sale',
          paymentMethod: 'card',
          items: [
            { type: 'sale', productId, description: 'Candy', amount: 199 },
          ],
        }),
      });

      const created = await createRes.json();

      const voidRes = await app.request(`/api/transactions/${created.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Wrong item' }),
      });

      expect(voidRes.status).toBe(200);
      const voided = await voidRes.json();
      expect(voided.voided).toBe(1);
      expect(voided.voidReason).toBe('Wrong item');
    });

    it('returns 404 when voiding non-existent transaction', async () => {
      const { app } = buildApp();

      const res = await app.request('/api/transactions/fake-id/void', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'test' }),
      });

      expect(res.status).toBe(404);
    });
  });

  describe('hold/recall via HTTP', () => {
    it('holds and recalls a transaction', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);

      // Hold a transaction
      const holdRes = await app.request('/api/transactions/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          items: [{ type: 'sale', description: 'On hold item', amount: 599 }],
        }),
      });

      expect(holdRes.status).toBe(201);
      const holdBody = await holdRes.json();
      expect(holdBody.holdId).toBeDefined();

      // List held
      const listRes = await app.request('/api/transactions/held');
      expect(listRes.status).toBe(200);
      const listBody = await listRes.json();
      expect(listBody.data.length).toBeGreaterThanOrEqual(1);

      // Recall
      const recallRes = await app.request(
        `/api/transactions/recall/${holdBody.holdId}`,
        { method: 'POST' }
      );
      expect(recallRes.status).toBe(200);
      const recallBody = await recallRes.json();
      expect(recallBody.customerId).toBe(customerId);

      // Verify removed from held
      const listRes2 = await app.request('/api/transactions/held');
      const listBody2 = await listRes2.json();
      const stillHeld = listBody2.data.filter(
        (h: any) => h.id === holdBody.holdId
      );
      expect(stillHeld).toHaveLength(0);
    });

    it('returns 404 when recalling nonexistent hold', async () => {
      const { app } = buildApp();

      const res = await app.request('/api/transactions/recall/ghost-hold', {
        method: 'POST',
      });

      expect(res.status).toBe(404);
    });
  });
});
