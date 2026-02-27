// ABOUTME: Tests for the CSV import API routes (parse, match, commit)
// ABOUTME: Covers CSV parsing with preview, data structuring, and title/copy creation

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createImportRoutes } from '../../../server/routes/import.js';
import { titles, copies } from '../../../server/db/schema.js';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const importRoutes = createImportRoutes(db);
  app = new Hono();
  app.route('/api/import', importRoutes);
});

const SAMPLE_CSV = `Title,Year,Format,Quantity,Genre,Rating
Blade Runner,1982,VHS,2,Sci-Fi,R
The Matrix,1999,DVD,3,Sci-Fi,R
Ghostbusters,1984,VHS,1,Comedy,PG
Alien,1979,Blu-ray,2,Horror,R
Die Hard,1988,VHS,1,Action,R
Terminator 2,1991,DVD,2,Action,R
Back to the Future,1985,VHS,3,Sci-Fi,PG`;

describe('POST /api/import/parse', () => {
  it('returns headers, preview rows, total count, and detected mapping', async () => {
    const res = await app.request('/api/import/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: SAMPLE_CSV }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.headers).toEqual(['Title', 'Year', 'Format', 'Quantity', 'Genre', 'Rating']);
    expect(body.rows).toHaveLength(5); // first 5 rows as preview
    expect(body.totalRows).toBe(7);

    // Detected mapping should map known columns
    expect(body.detectedMapping.title).toBe('Title');
    expect(body.detectedMapping.year).toBe('Year');
    expect(body.detectedMapping.format).toBe('Format');
    expect(body.detectedMapping.quantity).toBe('Quantity');
    expect(body.detectedMapping.genre).toBe('Genre');
    expect(body.detectedMapping.rating).toBe('Rating');
  });

  it('returns 400 when csv is missing', async () => {
    const res = await app.request('/api/import/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('handles CSV with non-standard column names', async () => {
    const csv = `Movie Name,Release Year,Media Type
Hackers,1995,VHS`;

    const res = await app.request('/api/import/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.headers).toEqual(['Movie Name', 'Release Year', 'Media Type']);
    expect(body.totalRows).toBe(1);
    // 'Movie Name' matches 'movie name' alias for title
    expect(body.detectedMapping.title).toBe('Movie Name');
  });
});

describe('POST /api/import/match', () => {
  it('validates and structures data with column mapping', async () => {
    const rows = [
      { Title: 'Blade Runner', Year: '1982', Format: 'VHS', Quantity: '2', Genre: 'Sci-Fi', Rating: 'R' },
      { Title: 'The Matrix', Year: '1999', Format: 'DVD', Quantity: '3', Genre: 'Sci-Fi', Rating: 'R' },
    ];

    const mapping = {
      title: 'Title',
      year: 'Year',
      format: 'Format',
      quantity: 'Quantity',
      genre: 'Genre',
      barcode: null,
      director: null,
      cast: null,
      rating: 'Rating',
    };

    const res = await app.request('/api/import/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, mapping }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.titles).toHaveLength(2);
    expect(body.titles[0].name).toBe('Blade Runner');
    expect(body.titles[0].year).toBe(1982);
    expect(body.titles[0].format).toBe('VHS');
    expect(body.titles[0].quantity).toBe(2);
    expect(body.titles[0].genre).toBe('Sci-Fi');
    expect(body.titles[0].rating).toBe('R');

    expect(body.titles[1].name).toBe('The Matrix');
    expect(body.titles[1].year).toBe(1999);
    expect(body.titles[1].format).toBe('DVD');
    expect(body.titles[1].quantity).toBe(3);
  });

  it('defaults year to 0 when not mapped', async () => {
    const rows = [
      { Title: 'Unknown Movie', Format: 'VHS' },
    ];

    const mapping = {
      title: 'Title',
      year: null,
      format: 'Format',
      quantity: null,
      genre: null,
      barcode: null,
      director: null,
      cast: null,
      rating: null,
    };

    const res = await app.request('/api/import/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, mapping }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.titles[0].year).toBe(0);
    expect(body.titles[0].quantity).toBe(1);
  });
});

describe('POST /api/import/commit', () => {
  it('creates titles and copies with correct counts', async () => {
    const titleData = [
      { name: 'Blade Runner', year: 1982, format: 'VHS', quantity: 2, genre: 'Sci-Fi', rating: 'R' },
      { name: 'The Matrix', year: 1999, format: 'DVD', quantity: 3, genre: 'Sci-Fi', rating: 'R' },
    ];

    const res = await app.request('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: titleData }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.titlesCreated).toBe(2);
    expect(body.copiesCreated).toBe(5); // 2 + 3

    // Verify titles exist in database
    const allTitles = await db.select().from(titles);
    expect(allTitles).toHaveLength(2);

    const bladeRunner = allTitles.find((t) => t.name === 'Blade Runner');
    expect(bladeRunner).toBeDefined();
    expect(bladeRunner!.year).toBe(1982);
    expect(bladeRunner!.genre).toBe('Sci-Fi');

    // Verify copies exist
    const allCopies = await db.select().from(copies);
    expect(allCopies).toHaveLength(5);
  });

  it('generates barcodes for copies', async () => {
    const titleData = [
      { name: 'Hackers', year: 1995, format: 'VHS', quantity: 2 },
    ];

    const res = await app.request('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: titleData }),
    });

    expect(res.status).toBe(201);

    const allCopies = await db.select().from(copies);
    expect(allCopies).toHaveLength(2);

    // Barcodes should follow VHS-{titleId}-001 pattern
    for (const copy of allCopies) {
      expect(copy.barcode).toMatch(/^VHS-.+-\d{3}$/);
      expect(copy.format).toBe('VHS');
      expect(copy.status).toBe('in');
    }

    // Barcodes should be unique
    const barcodes = allCopies.map((c) => c.barcode);
    expect(new Set(barcodes).size).toBe(2);
  });

  it('defaults format to VHS and year to 0', async () => {
    const titleData = [
      { name: 'Mystery Movie' },
    ];

    const res = await app.request('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: titleData }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.titlesCreated).toBe(1);
    expect(body.copiesCreated).toBe(1);

    const [title] = await db.select().from(titles);
    expect(title.year).toBe(0);

    const [copy] = await db.select().from(copies);
    expect(copy.format).toBe('VHS');
  });

  it('stores optional fields like tmdbId, synopsis, coverUrl, cast', async () => {
    const titleData = [
      {
        name: 'Blade Runner',
        year: 1982,
        format: 'VHS',
        quantity: 1,
        genre: 'Sci-Fi',
        rating: 'R',
        tmdbId: 78,
        synopsis: 'A blade runner hunts replicants.',
        coverUrl: 'https://example.com/cover.jpg',
        cast: 'Harrison Ford, Rutger Hauer',
        director: 'Ridley Scott',
      },
    ];

    const res = await app.request('/api/import/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titles: titleData }),
    });

    expect(res.status).toBe(201);

    const [title] = await db.select().from(titles);
    expect(title.tmdbId).toBe(78);
    expect(title.synopsis).toBe('A blade runner hunts replicants.');
    expect(title.coverUrl).toBe('https://example.com/cover.jpg');
    expect(title.cast).toBe('Harrison Ford, Rutger Hauer');
  });
});
