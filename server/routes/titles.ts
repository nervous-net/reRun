// ABOUTME: Hono route handlers for title CRUD and copy creation
// ABOUTME: Provides paginated listing with available copy counts, detail view, and batch copy creation

import { Hono } from 'hono';
import { eq, sql, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { titles, copies } from '../db/schema.js';
import { generateBarcodes } from '../services/barcode.js';

export function createTitlesRoutes(db: any) {
  const routes = new Hono();

  // GET / — List titles (paginated), include availableCopies count
  routes.get('/', async (c) => {
    const page = Math.max(1, Number(c.req.query('page') || '1'));
    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || '20')));
    const offset = (page - 1) * limit;

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(titles);

    // Get titles with available copy counts via raw SQL subquery
    const rows = await db.all(sql`
      SELECT
        t.id, t.tmdb_id AS "tmdbId", t.name, t.year, t.genre,
        t.runtime_minutes AS "runtimeMinutes", t.synopsis, t.rating,
        t.cast_list AS "cast", t.cover_url AS "coverUrl",
        t.created_at AS "createdAt", t.updated_at AS "updatedAt",
        (SELECT count(*) FROM copies c WHERE c.title_id = t.id AND c.status = 'in') AS "availableCopies"
      FROM titles t
      LIMIT ${limit} OFFSET ${offset}
    `);

    return c.json({ data: rows, page, limit, total });
  });

  // GET /:id — Get title with all copies
  routes.get('/:id', async (c) => {
    const id = c.req.param('id');

    const [title] = await db
      .select()
      .from(titles)
      .where(eq(titles.id, id));

    if (!title) {
      return c.json({ error: 'Title not found' }, 404);
    }

    const titleCopies = await db
      .select()
      .from(copies)
      .where(eq(copies.titleId, id));

    return c.json({ ...title, copies: titleCopies });
  });

  // POST / — Create title
  routes.post('/', async (c) => {
    const body = await c.req.json();

    if (!body.name) {
      return c.json({ error: 'name is required' }, 400);
    }
    if (body.year === undefined || body.year === null) {
      return c.json({ error: 'year is required' }, 400);
    }

    const id = nanoid();
    const values = {
      id,
      name: body.name,
      year: body.year,
      tmdbId: body.tmdbId ?? null,
      genre: body.genre ?? null,
      runtimeMinutes: body.runtimeMinutes ?? null,
      synopsis: body.synopsis ?? null,
      rating: body.rating ?? null,
      cast: body.cast ?? null,
      coverUrl: body.coverUrl ?? null,
    };

    await db.insert(titles).values(values);

    const [created] = await db
      .select()
      .from(titles)
      .where(eq(titles.id, id));

    return c.json(created, 201);
  });

  // PUT /:id — Update title
  routes.put('/:id', async (c) => {
    const id = c.req.param('id');

    const [existing] = await db
      .select()
      .from(titles)
      .where(eq(titles.id, id));

    if (!existing) {
      return c.json({ error: 'Title not found' }, 404);
    }

    const body = await c.req.json();

    const updateData: Record<string, any> = {};
    const updatableFields = [
      'name', 'year', 'tmdbId', 'genre', 'runtimeMinutes',
      'synopsis', 'rating', 'cast', 'coverUrl',
    ];

    for (const field of updatableFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    updateData.updatedAt = sql`(datetime('now'))`;

    await db
      .update(titles)
      .set(updateData)
      .where(eq(titles.id, id));

    const [updated] = await db
      .select()
      .from(titles)
      .where(eq(titles.id, id));

    return c.json(updated);
  });

  // POST /:id/copies — Add copies to a title
  routes.post('/:id/copies', async (c) => {
    const titleId = c.req.param('id');

    const [title] = await db
      .select()
      .from(titles)
      .where(eq(titles.id, titleId));

    if (!title) {
      return c.json({ error: 'Title not found' }, 404);
    }

    const body = await c.req.json();

    if (!body.format) {
      return c.json({ error: 'format is required' }, 400);
    }

    const quantity = body.quantity ?? 1;
    const condition = body.condition ?? 'good';

    // Get existing copy count to continue barcode sequence
    const [{ existingCount }] = await db
      .select({ existingCount: count() })
      .from(copies)
      .where(eq(copies.titleId, titleId));

    const barcodes = generateBarcodes(body.format, titleId, quantity);

    // Offset barcodes by existing count to avoid collisions
    const offsetBarcodes = Array.from({ length: quantity }, (_, i) => {
      const seq = existingCount + i + 1;
      const prefix = body.format.toUpperCase().substring(0, 3);
      return `${prefix}-${titleId}-${String(seq).padStart(3, '0')}`;
    });

    const newCopies = offsetBarcodes.map((barcode) => ({
      id: nanoid(),
      titleId,
      barcode,
      format: body.format,
      condition,
      status: 'in',
    }));

    await db.insert(copies).values(newCopies);

    // Re-read inserted copies to get full records with defaults
    const insertedIds = newCopies.map((c) => c.id);
    const insertedCopies = [];
    for (const cid of insertedIds) {
      const [copy] = await db.select().from(copies).where(eq(copies.id, cid));
      insertedCopies.push(copy);
    }

    return c.json({ copies: insertedCopies }, 201);
  });

  return routes;
}
