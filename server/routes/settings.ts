// ABOUTME: Store settings API routes for global configuration key-value pairs
// ABOUTME: Supports retrieving all settings as an object and updating individual keys

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema.js';
import { getNow } from '../lib/date.js';

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

  // GET /dev-time — get effective date for dev mode
  routes.get('/dev-time', async (c) => {
    const effectiveDate = getNow(db).toISOString();
    const realDate = new Date().toISOString();
    return c.json({ effectiveDate, realDate });
  });

  // GET /:key — get a single setting
  routes.get('/:key', async (c) => {
    const key = c.req.param('key');
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, key));
    if (!row) {
      return c.json({ key, value: null });
    }
    return c.json(row);
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
