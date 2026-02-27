// ABOUTME: Hono route handlers for CSV import workflow (parse, match, commit)
// ABOUTME: Provides CSV preview with column detection, data structuring, and bulk title/copy creation

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { titles, copies } from '../db/schema.js';
import { parseCsv, detectColumns } from '../services/csv-import.js';
import { generateBarcodes } from '../services/barcode.js';

export function createImportRoutes(db: any) {
  const routes = new Hono();

  // POST /parse — Parse CSV content and return preview with detected column mapping
  routes.post('/parse', async (c) => {
    const body = await c.req.json();

    if (!body.csv) {
      return c.json({ error: 'csv is required' }, 400);
    }

    const { headers, rows } = await parseCsv(body.csv);
    const detectedMapping = detectColumns(headers);

    return c.json({
      headers,
      rows: rows.slice(0, 5),
      totalRows: rows.length,
      detectedMapping,
    });
  });

  // POST /match — Validate and structure rows using provided column mapping
  routes.post('/match', async (c) => {
    const body = await c.req.json();
    const { rows, mapping } = body;

    const structured = rows.map((row: Record<string, string>) => {
      const name = mapping.title ? row[mapping.title] ?? '' : '';
      const yearRaw = mapping.year ? row[mapping.year] : null;
      const year = yearRaw ? parseInt(yearRaw, 10) || 0 : 0;
      const format = mapping.format ? row[mapping.format] ?? 'VHS' : 'VHS';
      const quantityRaw = mapping.quantity ? row[mapping.quantity] : null;
      const quantity = quantityRaw ? parseInt(quantityRaw, 10) || 1 : 1;
      const genre = mapping.genre ? row[mapping.genre] ?? null : null;
      const rating = mapping.rating ? row[mapping.rating] ?? null : null;
      const director = mapping.director ? row[mapping.director] ?? null : null;
      const cast = mapping.cast ? row[mapping.cast] ?? null : null;

      return { name, year, format, quantity, genre, rating, director, cast };
    });

    return c.json({ titles: structured });
  });

  // POST /commit — Create title and copy records from structured data
  routes.post('/commit', async (c) => {
    const body = await c.req.json();
    const titleData: any[] = body.titles;

    let titlesCreated = 0;
    let copiesCreated = 0;

    for (const item of titleData) {
      const titleId = nanoid();
      const format = item.format || 'VHS';
      const year = item.year ?? 0;
      const quantity = item.quantity ?? 1;

      await db.insert(titles).values({
        id: titleId,
        name: item.name,
        year,
        tmdbId: item.tmdbId ?? null,
        genre: item.genre ?? null,
        runtimeMinutes: item.runtimeMinutes ?? null,
        synopsis: item.synopsis ?? null,
        rating: item.rating ?? null,
        cast: item.cast ?? null,
        coverUrl: item.coverUrl ?? null,
      });
      titlesCreated++;

      const barcodes = generateBarcodes(format, titleId, quantity);

      const newCopies = barcodes.map((barcode) => ({
        id: nanoid(),
        titleId,
        barcode,
        format,
        condition: 'good',
        status: 'in',
      }));

      if (newCopies.length > 0) {
        await db.insert(copies).values(newCopies);
        copiesCreated += newCopies.length;
      }
    }

    return c.json({ titlesCreated, copiesCreated }, 201);
  });

  return routes;
}
