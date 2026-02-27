// ABOUTME: Tests for the Products API routes (CRUD + low-stock query)
// ABOUTME: Covers create, list with pagination/filtering, update, and low-stock endpoint

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createProductsRoutes } from '../../../server/routes/products.js';
import { Hono } from 'hono';
import { products } from '../../../server/db/schema.js';

function buildApp() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  const routes = createProductsRoutes(db);
  const app = new Hono();
  app.route('/api/products', routes);
  return { app, db, sqlite };
}

describe('Products API', () => {
  describe('POST /api/products', () => {
    it('creates a product and returns it with a generated id', async () => {
      const { app } = buildApp();
      const res = await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Microwave Popcorn',
          sku: 'POP-001',
          price: 399,
          cost: 150,
          taxRate: 800,
          stockQty: 50,
          reorderLevel: 10,
          category: 'snacks',
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(typeof body.id).toBe('string');
      expect(body.id.length).toBeGreaterThan(0);
      expect(body.name).toBe('Microwave Popcorn');
      expect(body.sku).toBe('POP-001');
      expect(body.price).toBe(399);
      expect(body.cost).toBe(150);
      expect(body.taxRate).toBe(800);
      expect(body.stockQty).toBe(50);
      expect(body.reorderLevel).toBe(10);
      expect(body.category).toBe('snacks');
      expect(body.active).toBe(1);
    });

    it('returns 400 when required fields are missing', async () => {
      const { app } = buildApp();
      const res = await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Incomplete' }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('returns 409 when SKU already exists', async () => {
      const { app } = buildApp();
      const productData = {
        name: 'Candy Bar',
        sku: 'CANDY-001',
        price: 199,
        cost: 80,
      };

      await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      const res = await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain('SKU');
    });
  });

  describe('GET /api/products', () => {
    it('lists products with default pagination', async () => {
      const { app } = buildApp();

      // Create a couple of products
      await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Product A', sku: 'SKU-A', price: 100, cost: 50 }),
      });
      await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Product B', sku: 'SKU-B', price: 200, cost: 100 }),
      });

      const res = await app.request('/api/products');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
      expect(body.total).toBe(2);
    });

    it('respects pagination parameters', async () => {
      const { app } = buildApp();

      // Create 3 products
      for (let i = 1; i <= 3; i++) {
        await app.request('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `Product ${i}`, sku: `SKU-${i}`, price: 100, cost: 50 }),
        });
      }

      const res = await app.request('/api/products?page=2&limit=2');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.page).toBe(2);
      expect(body.limit).toBe(2);
      expect(body.total).toBe(3);
    });

    it('filters by active status', async () => {
      const { app } = buildApp();

      // Create an active product
      await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Active Item', sku: 'ACT-1', price: 100, cost: 50 }),
      });

      // Create a product then deactivate it
      const createRes = await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Inactive Item', sku: 'INACT-1', price: 100, cost: 50 }),
      });
      const created = await createRes.json();

      await app.request(`/api/products/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: 0 }),
      });

      // Only active
      const activeRes = await app.request('/api/products?active=1');
      const activeBody = await activeRes.json();
      expect(activeBody.data).toHaveLength(1);
      expect(activeBody.data[0].name).toBe('Active Item');

      // Only inactive
      const inactiveRes = await app.request('/api/products?active=0');
      const inactiveBody = await inactiveRes.json();
      expect(inactiveBody.data).toHaveLength(1);
      expect(inactiveBody.data[0].name).toBe('Inactive Item');
    });
  });

  describe('PUT /api/products/:id', () => {
    it('updates only the supplied fields', async () => {
      const { app } = buildApp();

      const createRes = await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Original Name',
          sku: 'ORIG-1',
          price: 500,
          cost: 250,
          category: 'candy',
        }),
      });
      const created = await createRes.json();

      const updateRes = await app.request(`/api/products/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name', price: 600 }),
      });

      expect(updateRes.status).toBe(200);
      const updated = await updateRes.json();
      expect(updated.name).toBe('Updated Name');
      expect(updated.price).toBe(600);
      // Untouched fields remain
      expect(updated.sku).toBe('ORIG-1');
      expect(updated.cost).toBe(250);
      expect(updated.category).toBe('candy');
    });

    it('returns 404 for a non-existent product', async () => {
      const { app } = buildApp();

      const res = await app.request('/api/products/nonexistent-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ghost Product' }),
      });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });
  });

  describe('GET /api/products/low-stock', () => {
    it('returns products where stockQty <= reorderLevel', async () => {
      const { app } = buildApp();

      // Well-stocked product (should NOT appear)
      await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Well Stocked',
          sku: 'STOCK-OK',
          price: 100,
          cost: 50,
          stockQty: 20,
          reorderLevel: 5,
        }),
      });

      // At reorder level (should appear)
      await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'At Reorder Level',
          sku: 'STOCK-AT',
          price: 100,
          cost: 50,
          stockQty: 5,
          reorderLevel: 5,
        }),
      });

      // Below reorder level (should appear)
      await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Below Reorder Level',
          sku: 'STOCK-LOW',
          price: 100,
          cost: 50,
          stockQty: 2,
          reorderLevel: 10,
        }),
      });

      const res = await app.request('/api/products/low-stock');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(2);

      const names = body.data.map((p: any) => p.name);
      expect(names).toContain('At Reorder Level');
      expect(names).toContain('Below Reorder Level');
      expect(names).not.toContain('Well Stocked');
    });

    it('does NOT return inactive products even if low stock', async () => {
      const { app } = buildApp();

      // Create a low-stock product then deactivate it
      const createRes = await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Inactive Low Stock',
          sku: 'INACT-LOW',
          price: 100,
          cost: 50,
          stockQty: 1,
          reorderLevel: 10,
        }),
      });
      const created = await createRes.json();

      await app.request(`/api/products/${created.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: 0 }),
      });

      // Create an active low-stock product for comparison
      await app.request('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Active Low Stock',
          sku: 'ACT-LOW',
          price: 100,
          cost: 50,
          stockQty: 1,
          reorderLevel: 10,
        }),
      });

      const res = await app.request('/api/products/low-stock');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Active Low Stock');
    });
  });
});
