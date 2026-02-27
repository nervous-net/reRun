// ABOUTME: End-to-end test for the CSV import pipeline
// ABOUTME: Covers parsing, column detection, committing via Hono route, and verifying DB state with TMDb metadata

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTestDb, migrateTestDb } from '../setup.js';
import { createImportRoutes } from '../../server/routes/import.js';
import { parseCsv, detectColumns } from '../../server/services/csv-import.js';
import { titles, copies } from '../../server/db/schema.js';
import { eq } from 'drizzle-orm';

let db: any;
let sqlite: any;
let app: Hono;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  app = new Hono();
  app.route('/api/import', createImportRoutes(db));
});

const INVENTORY_CSV = `Title,Year,Format,Quantity,Genre,Rating
Blade Runner,1982,VHS,2,Sci-Fi,R
The Matrix,1999,DVD,3,Action,R
Ghostbusters,1984,VHS,1,Comedy,PG`;

describe('Import Flow E2E', () => {
  describe('full CSV import pipeline', () => {
    it('parses CSV, detects columns, commits titles, and verifies DB state', async () => {
      // Step 1: Parse the CSV content
      const parsed = await parseCsv(INVENTORY_CSV);
      expect(parsed.headers).toEqual(['Title', 'Year', 'Format', 'Quantity', 'Genre', 'Rating']);
      expect(parsed.rows).toHaveLength(3);
      expect(parsed.rows[0]['Title']).toBe('Blade Runner');
      expect(parsed.rows[1]['Title']).toBe('The Matrix');
      expect(parsed.rows[2]['Title']).toBe('Ghostbusters');

      // Step 2: Detect column mapping from headers
      const mapping = detectColumns(parsed.headers);
      expect(mapping.title).toBe('Title');
      expect(mapping.year).toBe('Year');
      expect(mapping.format).toBe('Format');
      expect(mapping.quantity).toBe('Quantity');
      expect(mapping.genre).toBe('Genre');
      expect(mapping.rating).toBe('Rating');

      // Step 3: Prepare structured data from parsed rows using mapping
      const structuredTitles = parsed.rows.map((row) => ({
        name: row[mapping.title!],
        year: parseInt(row[mapping.year!], 10),
        format: row[mapping.format!],
        quantity: parseInt(row[mapping.quantity!], 10),
        genre: row[mapping.genre!],
        rating: row[mapping.rating!],
      }));

      expect(structuredTitles).toHaveLength(3);
      expect(structuredTitles[0]).toMatchObject({
        name: 'Blade Runner',
        year: 1982,
        format: 'VHS',
        quantity: 2,
        genre: 'Sci-Fi',
        rating: 'R',
      });

      // Step 4: Commit via Hono route
      const res = await app.request('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles: structuredTitles }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.titlesCreated).toBe(3);
      // 2 copies for Blade Runner + 3 for Matrix + 1 for Ghostbusters = 6
      expect(body.copiesCreated).toBe(6);

      // Step 5: Verify titles exist in the database with correct data
      const allTitles = await db.select().from(titles);
      expect(allTitles).toHaveLength(3);

      const bladeRunner = allTitles.find((t: any) => t.name === 'Blade Runner');
      expect(bladeRunner).toBeDefined();
      expect(bladeRunner.year).toBe(1982);
      expect(bladeRunner.genre).toBe('Sci-Fi');
      expect(bladeRunner.rating).toBe('R');

      const matrix = allTitles.find((t: any) => t.name === 'The Matrix');
      expect(matrix).toBeDefined();
      expect(matrix.year).toBe(1999);
      expect(matrix.genre).toBe('Action');

      const ghostbusters = allTitles.find((t: any) => t.name === 'Ghostbusters');
      expect(ghostbusters).toBeDefined();
      expect(ghostbusters.year).toBe(1984);
      expect(ghostbusters.genre).toBe('Comedy');
      expect(ghostbusters.rating).toBe('PG');

      // Step 6: Verify copies were created with proper barcodes
      const allCopies = await db.select().from(copies);
      expect(allCopies).toHaveLength(6);

      // Blade Runner should have 2 VHS copies
      const brCopies = allCopies.filter((c: any) => c.titleId === bladeRunner.id);
      expect(brCopies).toHaveLength(2);
      for (const copy of brCopies) {
        expect(copy.format).toBe('VHS');
        expect(copy.barcode).toMatch(/^VHS-.+-\d{3}$/);
        expect(copy.status).toBe('in');
        expect(copy.condition).toBe('good');
      }
      // Barcodes should be unique
      expect(brCopies[0].barcode).not.toBe(brCopies[1].barcode);

      // Matrix should have 3 DVD copies
      const matrixCopies = allCopies.filter((c: any) => c.titleId === matrix.id);
      expect(matrixCopies).toHaveLength(3);
      for (const copy of matrixCopies) {
        expect(copy.format).toBe('DVD');
        expect(copy.barcode).toMatch(/^DVD-.+-\d{3}$/);
      }

      // Ghostbusters should have 1 VHS copy
      const gbCopies = allCopies.filter((c: any) => c.titleId === ghostbusters.id);
      expect(gbCopies).toHaveLength(1);
      expect(gbCopies[0].format).toBe('VHS');
    });

    it('handles full pipeline via Hono routes (parse -> match -> commit)', async () => {
      // Step 1: Parse via route
      const parseRes = await app.request('/api/import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: INVENTORY_CSV }),
      });
      expect(parseRes.status).toBe(200);
      const parseBody = await parseRes.json();
      expect(parseBody.totalRows).toBe(3);
      expect(parseBody.detectedMapping.title).toBe('Title');

      // Step 2: Match/structure via route using all rows from parsed CSV
      const allRows = (await parseCsv(INVENTORY_CSV)).rows;
      const matchRes = await app.request('/api/import/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: allRows,
          mapping: parseBody.detectedMapping,
        }),
      });
      expect(matchRes.status).toBe(200);
      const matchBody = await matchRes.json();
      expect(matchBody.titles).toHaveLength(3);
      expect(matchBody.titles[0].name).toBe('Blade Runner');

      // Step 3: Commit via route
      const commitRes = await app.request('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles: matchBody.titles }),
      });
      expect(commitRes.status).toBe(201);
      const commitBody = await commitRes.json();
      expect(commitBody.titlesCreated).toBe(3);
      expect(commitBody.copiesCreated).toBe(6);

      // Step 4: Verify final DB state
      const allTitles = await db.select().from(titles);
      expect(allTitles).toHaveLength(3);
      const allCopies = await db.select().from(copies);
      expect(allCopies).toHaveLength(6);
    });

    it('commits titles with TMDb metadata fields', async () => {
      const titlesWithTmdb = [
        {
          name: 'The Matrix',
          year: 1999,
          format: 'DVD',
          quantity: 2,
          genre: 'Action',
          rating: 'R',
          tmdbId: 603,
          synopsis: 'A computer hacker learns about the true nature of reality.',
          coverUrl: 'https://image.tmdb.org/t/p/w500/matrix.jpg',
        },
        {
          name: 'Alien',
          year: 1979,
          format: 'VHS',
          quantity: 1,
          genre: 'Horror',
          rating: 'R',
          tmdbId: 348,
          synopsis: 'The crew of a commercial spacecraft encounters a deadly lifeform.',
          coverUrl: 'https://image.tmdb.org/t/p/w500/alien.jpg',
          cast: 'Sigourney Weaver, Tom Skerritt',
        },
      ];

      const res = await app.request('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles: titlesWithTmdb }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.titlesCreated).toBe(2);
      expect(body.copiesCreated).toBe(3); // 2 + 1

      // Verify TMDb metadata was stored correctly
      const allTitles = await db.select().from(titles);
      expect(allTitles).toHaveLength(2);

      const matrix = allTitles.find((t: any) => t.name === 'The Matrix');
      expect(matrix).toBeDefined();
      expect(matrix.tmdbId).toBe(603);
      expect(matrix.synopsis).toBe('A computer hacker learns about the true nature of reality.');
      expect(matrix.coverUrl).toBe('https://image.tmdb.org/t/p/w500/matrix.jpg');

      const alien = allTitles.find((t: any) => t.name === 'Alien');
      expect(alien).toBeDefined();
      expect(alien.tmdbId).toBe(348);
      expect(alien.synopsis).toBe('The crew of a commercial spacecraft encounters a deadly lifeform.');
      expect(alien.coverUrl).toBe('https://image.tmdb.org/t/p/w500/alien.jpg');
      expect(alien.cast).toBe('Sigourney Weaver, Tom Skerritt');

      // Verify copies also created correctly
      const matrixCopies = await db.select().from(copies).where(eq(copies.titleId, matrix.id));
      expect(matrixCopies).toHaveLength(2);
      for (const copy of matrixCopies) {
        expect(copy.format).toBe('DVD');
        expect(copy.status).toBe('in');
      }

      const alienCopies = await db.select().from(copies).where(eq(copies.titleId, alien.id));
      expect(alienCopies).toHaveLength(1);
      expect(alienCopies[0].format).toBe('VHS');
    });

    it('detects non-standard column names in a messy CSV', async () => {
      const messyCsv = `Movie Name,Release Year,Media Type,Qty
Hackers,1995,VHS,2
WarGames,1983,DVD,1`;

      const parsed = await parseCsv(messyCsv);
      expect(parsed.rows).toHaveLength(2);

      const mapping = detectColumns(parsed.headers);
      // 'Movie Name' should map to title alias 'movie name'
      expect(mapping.title).toBe('Movie Name');
      // 'Release Year' should map to year alias 'release year'
      expect(mapping.year).toBe('Release Year');
      // 'Media Type' should map to format alias 'media type'
      expect(mapping.format).toBe('Media Type');
      // 'Qty' should map to quantity alias 'qty'
      expect(mapping.quantity).toBe('Qty');

      // Structure and commit using detected mapping
      const structuredTitles = parsed.rows.map((row) => ({
        name: row[mapping.title!],
        year: parseInt(row[mapping.year!], 10),
        format: row[mapping.format!],
        quantity: parseInt(row[mapping.quantity!], 10),
      }));

      const res = await app.request('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titles: structuredTitles }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.titlesCreated).toBe(2);
      expect(body.copiesCreated).toBe(3); // 2 + 1

      // Verify data integrity
      const allTitles = await db.select().from(titles);
      const hackers = allTitles.find((t: any) => t.name === 'Hackers');
      expect(hackers).toBeDefined();
      expect(hackers.year).toBe(1995);

      const wargames = allTitles.find((t: any) => t.name === 'WarGames');
      expect(wargames).toBeDefined();
      expect(wargames.year).toBe(1983);
    });
  });
});
