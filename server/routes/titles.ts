// ABOUTME: Hono route handlers for title CRUD and copy creation
// ABOUTME: Provides paginated listing with available copy counts, detail view, batch copy creation, and bulk hard-delete

import { Hono } from 'hono';
import { eq, and, sql, count, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { titles, copies, rentals, transactionItems, reservations } from '../db/schema.js';
import { generateBarcode, generateBarcodes } from '../services/barcode.js';

export function createTitlesRoutes(db: any) {
  const routes = new Hono();

  // GET / — List titles (paginated), include availableCopies count
  routes.get('/', async (c) => {
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit')) || 20));
    const offset = (page - 1) * limit;
    const showInactive = c.req.query('showInactive') === '1';

    const activeFilter = showInactive ? sql`1=1` : sql`t.active = 1`;

    // Get total count
    const [{ total }] = await db.all(sql`
      SELECT count(*) AS total FROM titles t WHERE ${activeFilter}
    `) as any;

    // Get titles with available copy counts via raw SQL subquery
    const rows = await db.all(sql`
      SELECT
        t.id, t.tmdb_id AS "tmdbId", t.name, t.year, t.genre,
        t.runtime_minutes AS "runtimeMinutes", t.synopsis, t.rating,
        t.cast_list AS "cast", t.director, t.cover_url AS "coverUrl",
        t.media_type AS "mediaType", t.number_of_seasons AS "numberOfSeasons",
        t.active, t.created_at AS "createdAt", t.updated_at AS "updatedAt",
        (SELECT count(*) FROM copies c WHERE c.title_id = t.id AND c.status = 'in') AS "availableCopies"
      FROM titles t
      WHERE ${activeFilter}
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
      mediaType: body.mediaType ?? 'movie',
      numberOfSeasons: body.numberOfSeasons ?? null,
    };

    const rawDb = (db as any).session.client;
    rawDb.transaction(() => {
      db.insert(titles).values(values).run();

      if (body.format && body.quantity) {
        const existingCopies = db.select({ id: copies.id }).from(copies).where(eq(copies.titleId, id)).all();
        for (let i = 0; i < body.quantity; i++) {
          const barcode = generateBarcode(body.format, id, existingCopies.length + i + 1);
          db.insert(copies).values({
            id: nanoid(),
            titleId: id,
            barcode,
            format: body.format,
            status: 'in',
            condition: 'good',
          }).run();
        }
      }
    })();

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
      'synopsis', 'rating', 'cast', 'coverUrl', 'mediaType', 'numberOfSeasons',
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

    const barcodes = generateBarcodes(body.format, titleId, quantity, existingCount + 1);

    const newCopies = barcodes.map((barcode) => ({
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

  // DELETE /:id — soft-delete title (set active=0)
  routes.delete('/:id', async (c) => {
    const id = c.req.param('id');

    const [title] = await db
      .select()
      .from(titles)
      .where(eq(titles.id, id));

    if (!title) {
      return c.json({ error: 'Title not found' }, 404);
    }

    // Check for active rentals on any copy of this title
    const titleCopies = await db
      .select({ id: copies.id })
      .from(copies)
      .where(eq(copies.titleId, id));

    for (const copy of titleCopies) {
      const [activeRental] = await db
        .select({ count: count() })
        .from(rentals)
        .where(and(eq(rentals.copyId, copy.id), eq(rentals.status, 'out')));

      if (activeRental.count > 0) {
        return c.json({ error: 'Cannot delete title with active rentals' }, 400);
      }
    }

    await db
      .update(titles)
      .set({ active: 0, updatedAt: sql`(datetime('now'))` })
      .where(eq(titles.id, id));

    return c.json({ success: true });
  });

  // POST /bulk-delete — hard-delete multiple titles and all related data
  routes.post('/bulk-delete', async (c) => {
    const body = await c.req.json();
    const ids: string[] = body.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: 'ids array is required and must not be empty' }, 400);
    }
    if (ids.length > 500) {
      return c.json({ error: 'Maximum 500 IDs per request' }, 400);
    }

    // Find which titles actually exist
    const existingTitles = await db
      .select({ id: titles.id, name: titles.name })
      .from(titles)
      .where(inArray(titles.id, ids));

    // Check for active rentals per title
    const deleted: string[] = [];
    const skipped: Array<{ id: string; name: string; reason: string }> = [];

    for (const title of existingTitles) {
      const titleCopies = await db
        .select({ id: copies.id })
        .from(copies)
        .where(eq(copies.titleId, title.id));

      let hasActiveRental = false;
      for (const copy of titleCopies) {
        const [activeRental] = await db
          .select({ count: count() })
          .from(rentals)
          .where(and(eq(rentals.copyId, copy.id), eq(rentals.status, 'out')));
        if (activeRental.count > 0) {
          hasActiveRental = true;
          break;
        }
      }

      if (hasActiveRental) {
        skipped.push({ id: title.id, name: title.name, reason: 'active rental' });
      } else {
        deleted.push(title.id);
      }
    }

    if (deleted.length > 0) {
      // Get all copy IDs for titles being deleted
      const copyRows = await db
        .select({ id: copies.id })
        .from(copies)
        .where(inArray(copies.titleId, deleted));
      const copyIds = copyRows.map((c: { id: string }) => c.id);

      // Get all rental IDs for copies being deleted
      const rentalRows = copyIds.length > 0
        ? await db.select({ id: rentals.id }).from(rentals).where(inArray(rentals.copyId, copyIds))
        : [];
      const rentalIds = rentalRows.map((r: { id: string }) => r.id);

      const rawDb = (db as any).session.client;
      rawDb.transaction(() => {
        // Delete in FK-safe order
        if (rentalIds.length > 0) {
          db.delete(transactionItems).where(inArray(transactionItems.rentalId, rentalIds)).run();
        }
        if (copyIds.length > 0) {
          db.delete(transactionItems).where(inArray(transactionItems.copyId, copyIds)).run();
          db.delete(rentals).where(inArray(rentals.copyId, copyIds)).run();
        }
        db.delete(reservations).where(inArray(reservations.titleId, deleted)).run();
        db.delete(copies).where(inArray(copies.titleId, deleted)).run();
        db.delete(titles).where(inArray(titles.id, deleted)).run();
      })();
    }

    return c.json({ deleted, skipped });
  });

  return routes;
}
