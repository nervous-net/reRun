// ABOUTME: Hono route handlers for copy updates and barcode lookups
// ABOUTME: Provides copy status/condition updates and barcode-based copy+title retrieval

import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { copies, titles } from '../db/schema.js';

export function createCopiesRoutes(db: any) {
  const routes = new Hono();

  // PUT /:id — Update copy (status, condition)
  routes.put('/:id', async (c) => {
    const id = c.req.param('id');

    const [existing] = await db
      .select()
      .from(copies)
      .where(eq(copies.id, id));

    if (!existing) {
      return c.json({ error: 'Copy not found' }, 404);
    }

    const body = await c.req.json();

    const updateData: Record<string, any> = {};
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.condition !== undefined) {
      updateData.condition = body.condition;
    }

    await db
      .update(copies)
      .set(updateData)
      .where(eq(copies.id, id));

    const [updated] = await db
      .select()
      .from(copies)
      .where(eq(copies.id, id));

    return c.json(updated);
  });

  // GET /barcode/:barcode — Lookup copy by barcode with title info
  routes.get('/barcode/:barcode', async (c) => {
    const barcode = c.req.param('barcode');

    const [copy] = await db
      .select()
      .from(copies)
      .where(eq(copies.barcode, barcode));

    if (!copy) {
      return c.json({ error: 'Copy not found' }, 404);
    }

    const [title] = await db
      .select()
      .from(titles)
      .where(eq(titles.id, copy.titleId));

    return c.json({ ...copy, title });
  });

  return routes;
}
