// ABOUTME: Alerts API routes for the dashboard alert panel (overdue, birthdays, low stock)
// ABOUTME: Also manages alert configuration templates for notification formatting

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { alertConfigs } from '../db/schema.js';
import {
  getOverdueRentals,
  getBirthdayAlerts,
  getLowStockAlerts,
} from '../services/alert.js';

export function createAlertsRoutes(db: any) {
  const routes = new Hono();

  // GET / — get all current alerts aggregated
  routes.get('/', async (c) => {
    const [overdue, birthdays, lowStock] = await Promise.all([
      getOverdueRentals(db),
      getBirthdayAlerts(db),
      getLowStockAlerts(db),
    ]);

    return c.json({ overdue, birthdays, lowStock });
  });

  // GET /configs — get all alert configurations
  routes.get('/configs', async (c) => {
    const data = await db.select().from(alertConfigs);
    return c.json({ data });
  });

  // POST /configs — create an alert config
  routes.post('/configs', async (c) => {
    const body = await c.req.json();

    if (!body.type || !body.template) {
      return c.json({ error: 'type and template are required' }, 400);
    }

    const id = nanoid();
    const values = {
      id,
      type: body.type,
      template: body.template,
      enabled: body.enabled ?? 1,
    };
    await db.insert(alertConfigs).values(values).run();
    return c.json({ data: values }, 201);
  });

  // PUT /configs/:id — update an alert config
  routes.put('/configs/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const [existing] = await db
      .select()
      .from(alertConfigs)
      .where(eq(alertConfigs.id, id));

    if (!existing) {
      return c.json({ error: 'Alert config not found' }, 404);
    }

    const updateFields: Record<string, any> = {};
    const allowedFields = ['type', 'template', 'enabled'] as const;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field];
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await db
        .update(alertConfigs)
        .set(updateFields)
        .where(eq(alertConfigs.id, id));
    }

    const [updated] = await db
      .select()
      .from(alertConfigs)
      .where(eq(alertConfigs.id, id));

    return c.json(updated);
  });

  return routes;
}
