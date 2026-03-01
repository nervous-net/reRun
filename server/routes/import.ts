// ABOUTME: Hono route handlers for CSV import workflow (parse, match, commit)
// ABOUTME: Provides CSV preview with column detection, data structuring, and bulk title/copy creation

import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { titles, copies } from '../db/schema.js';
import { parseCsv, detectColumns } from '../services/csv-import.js';
import { generateBarcodes } from '../services/barcode.js';
import { TmdbClient, TmdbSearchResult } from '../services/tmdb.js';
import { scoreTmdbMatch, queryVariations } from '../services/fuzzy-match.js';

export function createImportRoutes(db: any, tmdb?: TmdbClient) {
  const routes = new Hono();

  // POST /parse — Parse CSV content and return preview with detected column mapping
  routes.post('/parse', async (c) => {
    const body = await c.req.json();

    if (!body.csv) {
      return c.json({ error: 'csv is required' }, 400);
    }

    const { headers, rows } = await parseCsv(body.csv);
    const detectedMapping = detectColumns(headers);

    // Convert object rows to arrays for the client ColumnMapper
    const sampleRows = rows.slice(0, 5).map((row) =>
      headers.map((h) => row[h] ?? '')
    );

    return c.json({
      headers,
      sampleRows,
      rowCount: rows.length,
      detectedMapping,
    });
  });

  // POST /match — Validate and structure rows using provided column mapping
  routes.post('/match', async (c) => {
    const body = await c.req.json();
    const { rows, headers, mapping } = body;

    interface StructuredTitle {
      title: string;
      year: string;
      format: string;
      quantity: string;
      genre: string;
      barcode: string;
      director: string;
      cast: string;
      rating: string;
      matched: boolean;
      tmdbId?: string;
      coverUrl?: string;
      synopsis?: string;
      runtimeMinutes?: string;
      mediaType?: string;
      numberOfSeasons?: string;
    }

    const structured: StructuredTitle[] = (rows as string[][]).map((row) => {
      const getValue = (field: string): string => {
        const csvHeader = mapping[field];
        if (!csvHeader) return '';
        const idx = (headers as string[]).indexOf(csvHeader);
        return idx >= 0 ? (row[idx] ?? '') : '';
      };

      return {
        title: getValue('title'),
        year: getValue('year'),
        format: getValue('format') || 'VHS',
        quantity: getValue('quantity') || '1',
        genre: getValue('genre'),
        barcode: getValue('barcode'),
        director: getValue('director'),
        cast: getValue('cast'),
        rating: getValue('rating'),
        matched: false,
      };
    });

    // Enrich with TMDb data using fuzzy matching
    if (tmdb) {
      const BATCH_SIZE = 5;
      for (let i = 0; i < structured.length; i += BATCH_SIZE) {
        const batch = structured.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map(async (item, j) => {
          try {
            const inputYear = parseInt(item.year, 10) || undefined;
            const variations = queryVariations(item.title);

            let bestResult: TmdbSearchResult | null = null;
            let bestScore = 0;

            for (const variation of variations) {
              // Search with year first
              let results = await tmdb.searchMulti(variation, inputYear);

              // Retry without year if no results
              if (results.length === 0 && inputYear) {
                results = await tmdb.searchMulti(variation);
              }

              // Score top 5 results
              for (const result of results.slice(0, 5)) {
                const score = scoreTmdbMatch(
                  item.title, result.title, inputYear, result.year ?? undefined
                );
                if (score > bestScore) {
                  bestScore = score;
                  bestResult = result;
                }
              }

              // High confidence — stop searching variations
              if (bestScore >= 0.85) break;
            }

            // Only use match if score meets minimum threshold
            if (bestResult && bestScore >= 0.5) {
              const details = await tmdb.getDetails(bestResult.tmdbId, bestResult.mediaType);
              structured[i + j] = {
                ...item,
                year: item.year || String(details.year ?? ''),
                genre: item.genre || details.genre,
                cast: item.cast || details.cast,
                rating: item.rating || details.rating || '',
                tmdbId: String(details.tmdbId),
                coverUrl: details.coverUrl || '',
                synopsis: details.synopsis || '',
                runtimeMinutes: String(details.runtimeMinutes || ''),
                mediaType: details.mediaType,
                numberOfSeasons: details.numberOfSeasons ? String(details.numberOfSeasons) : '',
                matched: true,
              };
            }
          } catch {
            // TMDb lookup failed for this title, leave as unmatched
          }
        }));
      }
    }

    return c.json({ titles: structured });
  });

  // POST /commit — Create title and copy records from structured data
  routes.post('/commit', async (c) => {
    const body = await c.req.json();
    const titleData: any[] = body.titles;

    let titlesCreated = 0;
    let copiesCreated = 0;

    const rawDb = (db as any).$client;
    const runImport = rawDb.transaction(() => {
      for (const item of titleData) {
        const format = item.format || 'VHS';
        const name = item.name || item.title;
        const year = typeof item.year === 'string' ? parseInt(item.year, 10) || 0 : (item.year ?? 0);
        const quantity = typeof item.quantity === 'string' ? parseInt(item.quantity, 10) || 1 : (item.quantity ?? 1);

        // Check if a title with the same name and year already exists
        const existing = db.select({ id: titles.id })
          .from(titles)
          .where(and(eq(titles.name, name), eq(titles.year, year)))
          .limit(1)
          .all();

        let titleId: string;
        if (existing.length > 0) {
          titleId = existing[0].id;
        } else {
          titleId = nanoid();
          db.insert(titles).values({
            id: titleId,
            name,
            year,
            tmdbId: item.tmdbId ?? null,
            genre: item.genre ?? null,
            runtimeMinutes: item.runtimeMinutes ?? null,
            synopsis: item.synopsis ?? null,
            rating: item.rating ?? null,
            cast: item.cast ?? null,
            director: item.director ?? null,
            coverUrl: item.coverUrl ?? null,
            mediaType: item.mediaType ?? 'movie',
            numberOfSeasons: item.numberOfSeasons ? parseInt(String(item.numberOfSeasons), 10) : null,
          }).run();
          titlesCreated++;
        }

        // Count existing copies so new barcodes start after them
        const existingCopies = db.select({ id: copies.id })
          .from(copies)
          .where(eq(copies.titleId, titleId))
          .all();
        const startSeq = existingCopies.length + 1;
        const barcodes = generateBarcodes(format, titleId, quantity, startSeq);

        const newCopies = barcodes.map((barcode) => ({
          id: nanoid(),
          titleId,
          barcode,
          format,
          condition: 'good',
          status: 'in',
        }));

        if (newCopies.length > 0) {
          db.insert(copies).values(newCopies).run();
          copiesCreated += newCopies.length;
        }
      }
    });
    runImport();

    return c.json({ titlesCreated, copiesCreated }, 201);
  });

  return routes;
}
