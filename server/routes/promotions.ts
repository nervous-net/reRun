// ABOUTME: Promotions API routes for managing store-wide discounts and deals
// ABOUTME: Supports listing active promotions, creating, and updating promotion rules

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { promotions } from '../db/schema.js';

export function createPromotionsRoutes(db: any) {
  const routes = new Hono();

  // GET / — list all promotions
  routes.get('/', async (c) => {
    const data = await db.select().from(promotions);
    return c.json({ data });
  });

  // POST / — create a promotion
  routes.post('/', async (c) => {
    const body = await c.req.json();

    if (!body.name || !body.type) {
      return c.json({ error: 'Missing required fields: name, type' }, 400);
    }

    const id = nanoid();

    await db.insert(promotions).values({
      id,
      name: body.name,
      type: body.type,
      rules: body.rules ?? null,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      active: body.active ?? 1,
    });

    const [created] = await db
      .select()
      .from(promotions)
      .where(eq(promotions.id, id));

    return c.json(created, 201);
  });

  // PUT /:id — update a promotion
  routes.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const [existing] = await db
      .select()
      .from(promotions)
      .where(eq(promotions.id, id));

    if (!existing) {
      return c.json({ error: 'Promotion not found' }, 404);
    }

    const updateFields: Record<string, any> = {};
    const allowedFields = [
      'name', 'type', 'rules', 'startDate', 'endDate', 'active',
    ] as const;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await db
        .update(promotions)
        .set(updateFields)
        .where(eq(promotions.id, id));
    }

    const [updated] = await db
      .select()
      .from(promotions)
      .where(eq(promotions.id, id));

    return c.json(updated);
  });

  return routes;
}
