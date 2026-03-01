// ABOUTME: Pricing rules API routes for rental rate configuration
// ABOUTME: Supports CRUD with soft-delete (deactivation) for pricing rules

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { pricingRules } from '../db/schema.js';

export function createPricingRoutes(db: any) {
  const routes = new Hono();

  // GET / — list pricing rules (all by default, or filter by ?active=1/0)
  routes.get('/', async (c) => {
    const activeParam = c.req.query('active');
    let data;
    if (activeParam !== undefined && activeParam !== '') {
      data = await db
        .select()
        .from(pricingRules)
        .where(eq(pricingRules.active, Number(activeParam)))
        .all();
    } else {
      data = await db.select().from(pricingRules).all();
    }

    return c.json({ data });
  });

  // POST / — create a pricing rule
  routes.post('/', async (c) => {
    const body = await c.req.json();

    if (!body.name) {
      return c.json({ error: 'name is required' }, 400);
    }
    if (!body.type) {
      return c.json({ error: 'type is required' }, 400);
    }
    if (body.rate === undefined || body.rate === null) {
      return c.json({ error: 'rate is required' }, 400);
    }
    if (body.durationDays === undefined || body.durationDays === null) {
      return c.json({ error: 'durationDays is required' }, 400);
    }

    const id = nanoid();

    await db.insert(pricingRules).values({
      id,
      name: body.name,
      type: body.type,
      rate: body.rate,
      durationDays: body.durationDays,
      lateFeePerDay: body.lateFeePerDay ?? 0,
      active: 1,
    }).run();

    const [created] = await db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.id, id))
      .all();

    return c.json(created, 201);
  });

  // PUT /:id — update a pricing rule
  routes.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const [existing] = await db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.id, id))
      .all();

    if (!existing) {
      return c.json({ error: 'Pricing rule not found' }, 404);
    }

    const updateFields: Record<string, any> = {};
    const allowedFields = [
      'name', 'type', 'rate', 'durationDays', 'lateFeePerDay', 'active',
    ] as const;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await db
        .update(pricingRules)
        .set(updateFields)
        .where(eq(pricingRules.id, id))
        .run();
    }

    const [updated] = await db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.id, id))
      .all();

    return c.json(updated);
  });

  // DELETE /:id — deactivate a pricing rule (soft delete)
  routes.delete('/:id', async (c) => {
    const id = c.req.param('id');

    const [existing] = await db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.id, id))
      .all();

    if (!existing) {
      return c.json({ error: 'Pricing rule not found' }, 404);
    }

    await db
      .update(pricingRules)
      .set({ active: 0 })
      .where(eq(pricingRules.id, id))
      .run();

    return c.json({ success: true });
  });

  return routes;
}
