// ABOUTME: Store settings API routes for global configuration key-value pairs
// ABOUTME: Supports retrieving all settings as an object and updating individual keys

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema.js';

export function createSettingsRoutes(db: any) {
  const routes = new Hono();

  // GET / — get all settings as a key-value object
  routes.get('/', async (c) => {
    const rows = await db.select().from(storeSettings);

    const settings: Record<string, string | null> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return c.json({ data: settings });
  });

  // PUT /:key — upsert a setting
  routes.put('/:key', async (c) => {
    const key = c.req.param('key');
    const body = await c.req.json();

    if (body.value === undefined) {
      return c.json({ error: 'Missing required field: value' }, 400);
    }

    const [existing] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, key));

    if (existing) {
      await db
        .update(storeSettings)
        .set({ value: body.value })
        .where(eq(storeSettings.key, key));
    } else {
      await db.insert(storeSettings).values({
        key,
        value: body.value,
      });
    }

    const [updated] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, key));

    return c.json(updated);
  });

  return routes;
}
