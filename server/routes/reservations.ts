// ABOUTME: Hono route handlers for reservation CRUD (create, list active, fulfill, cancel)
// ABOUTME: Joins customer and title names for listing, defaults to 7-day expiry

import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { reservations, customers, titles } from '../db/schema.js';
import { getNow } from '../lib/date.js';

export function createReservationsRoutes(db: any) {
  const routes = new Hono();

  // POST / — Create a reservation
  routes.post('/', async (c) => {
    const body = await c.req.json();

    if (!body.customerId) {
      return c.json({ error: 'customerId is required' }, 400);
    }
    if (!body.titleId) {
      return c.json({ error: 'titleId is required' }, 400);
    }

    const id = nanoid();
    const now = getNow(db);
    const reservedAt = now.toISOString();
    const expiresAt = body.expiresAt
      ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.insert(reservations).values({
      id,
      customerId: body.customerId,
      titleId: body.titleId,
      reservedAt,
      expiresAt,
      fulfilled: 0,
      notified: 0,
    });

    const [created] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, id));

    return c.json(created, 201);
  });

  // GET / — List active (unfulfilled) reservations with customer and title names
  routes.get('/', async (c) => {
    const rows = await db.all(sql`
      SELECT
        r.id,
        r.customer_id AS "customerId",
        r.title_id AS "titleId",
        r.reserved_at AS "reservedAt",
        r.expires_at AS "expiresAt",
        r.fulfilled,
        r.notified,
        (c.first_name || ' ' || c.last_name) AS "customerName",
        t.name AS "titleName"
      FROM reservations r
      JOIN customers c ON c.id = r.customer_id
      JOIN titles t ON t.id = r.title_id
      WHERE r.fulfilled = 0
    `);

    return c.json({ data: rows });
  });

  // PUT /:id/fulfill — Mark reservation as fulfilled
  routes.put('/:id/fulfill', async (c) => {
    const id = c.req.param('id');

    const [existing] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, id));

    if (!existing) {
      return c.json({ error: 'Reservation not found' }, 404);
    }

    await db
      .update(reservations)
      .set({ fulfilled: 1 })
      .where(eq(reservations.id, id));

    const [updated] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, id));

    return c.json(updated);
  });

  // DELETE /:id — Cancel/delete reservation
  routes.delete('/:id', async (c) => {
    const id = c.req.param('id');

    const [existing] = await db
      .select()
      .from(reservations)
      .where(eq(reservations.id, id));

    if (!existing) {
      return c.json({ error: 'Reservation not found' }, 404);
    }

    await db
      .delete(reservations)
      .where(eq(reservations.id, id));

    return c.json({ success: true });
  });

  return routes;
}
