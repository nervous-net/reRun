// ABOUTME: Products API routes for merchandise inventory (snacks, accessories, etc.)
// ABOUTME: Supports CRUD operations and low-stock query for reorder alerts

import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { products } from '../db/schema.js';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../db/schema.js';

type DB = BetterSQLite3Database<typeof schema>;

export function createProductsRoutes(db: DB) {
  const routes = new Hono();

  // GET /low-stock — must be defined before /:id to avoid route collision
  routes.get('/low-stock', async (c) => {
    const lowStockProducts = await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.active, 1),
          sql`${products.stockQty} <= ${products.reorderLevel}`
        )
      );

    return c.json({ data: lowStockProducts });
  });

  // GET / — list products with pagination, optional active filter
  routes.get('/', async (c) => {
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 20));
    const activeParam = c.req.query('active');
    const offset = (page - 1) * limit;

    const conditions = [];
    if (activeParam !== undefined && activeParam !== '') {
      conditions.push(eq(products.active, Number(activeParam)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db
        .select()
        .from(products)
        .where(whereClause)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(whereClause),
    ]);

    return c.json({
      data,
      page,
      limit,
      total: countResult[0].count,
    });
  });

  // POST / — create a new product
  routes.post('/', async (c) => {
    const body = await c.req.json();

    // Validate required fields
    if (!body.name || !body.sku || body.price === undefined || body.cost === undefined) {
      return c.json(
        { error: 'Missing required fields: name, sku, price, cost' },
        400
      );
    }

    const id = nanoid();

    try {
      await db.insert(products).values({
        id,
        name: body.name,
        sku: body.sku,
        price: body.price,
        cost: body.cost,
        taxRate: body.taxRate ?? 0,
        stockQty: body.stockQty ?? 0,
        reorderLevel: body.reorderLevel ?? 0,
        category: body.category ?? null,
        active: body.active ?? 1,
      });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint failed')) {
        return c.json({ error: 'SKU already exists' }, 409);
      }
      throw err;
    }

    const [created] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    return c.json(created, 201);
  });

  // PUT /:id — partial update
  routes.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    // Check product exists
    const [existing] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    if (!existing) {
      return c.json({ error: 'Product not found' }, 404);
    }

    // Build update object from supplied fields only
    const updateFields: Record<string, any> = {};
    const allowedFields = [
      'name', 'sku', 'price', 'cost', 'taxRate', 'stockQty',
      'reorderLevel', 'category', 'active',
    ] as const;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await db
        .update(products)
        .set(updateFields)
        .where(eq(products.id, id));
    }

    const [updated] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));

    return c.json(updated);
  });

  return routes;
}
