// ABOUTME: Tests for the search API route with multi-field filtering and pagination
// ABOUTME: Covers text search, genre/format/rating/year filters, availability, combined filters, and pagination

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createSearchRoutes } from '../../../server/routes/search.js';
import { titles, copies } from '../../../server/db/schema.js';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

// Reusable title IDs
let matrixId: string;
let bladeRunnerId: string;
let ghostbustersId: string;
let alienId: string;
let dieHardId: string;

function seedTestData() {
  matrixId = nanoid();
  bladeRunnerId = nanoid();
  ghostbustersId = nanoid();
  alienId = nanoid();
  dieHardId = nanoid();

  // Seed titles
  sqlite.exec(`
    INSERT INTO titles (id, name, year, genre, rating, synopsis, cast_list, cover_url)
    VALUES
      ('${matrixId}', 'The Matrix', 1999, 'Action', 'R', 'A computer hacker learns about the true nature of reality.', 'Keanu Reeves, Laurence Fishburne', 'https://example.com/matrix.jpg'),
      ('${bladeRunnerId}', 'Blade Runner', 1982, 'Sci-Fi', 'R', 'A blade runner hunts replicants in a dystopian future.', 'Harrison Ford, Rutger Hauer', 'https://example.com/bladerunner.jpg'),
      ('${ghostbustersId}', 'Ghostbusters', 1984, 'Comedy', 'PG', 'Three parapsychologists start a ghost removal service.', 'Bill Murray, Dan Aykroyd', 'https://example.com/ghostbusters.jpg'),
      ('${alienId}', 'Alien', 1979, 'Sci-Fi', 'R', 'The crew of a spaceship encounters a deadly creature.', 'Sigourney Weaver, Tom Skerritt', 'https://example.com/alien.jpg'),
      ('${dieHardId}', 'Die Hard', 1988, 'Action', 'R', 'An off-duty cop battles terrorists in a skyscraper.', 'Bruce Willis, Alan Rickman', 'https://example.com/diehard.jpg');
  `);

  // Seed copies
  // The Matrix: 2 DVD in, 1 DVD out, 1 Blu-ray in = 3 available, 4 total
  sqlite.exec(`
    INSERT INTO copies (id, title_id, barcode, format, status)
    VALUES
      ('${nanoid()}', '${matrixId}', 'DVD-MAT-001', 'DVD', 'in'),
      ('${nanoid()}', '${matrixId}', 'DVD-MAT-002', 'DVD', 'in'),
      ('${nanoid()}', '${matrixId}', 'DVD-MAT-003', 'DVD', 'out'),
      ('${nanoid()}', '${matrixId}', 'BLU-MAT-001', 'Blu-ray', 'in');
  `);

  // Blade Runner: 1 VHS in, 1 DVD out = 1 available, 2 total
  sqlite.exec(`
    INSERT INTO copies (id, title_id, barcode, format, status)
    VALUES
      ('${nanoid()}', '${bladeRunnerId}', 'VHS-BR-001', 'VHS', 'in'),
      ('${nanoid()}', '${bladeRunnerId}', 'DVD-BR-001', 'DVD', 'out');
  `);

  // Ghostbusters: 1 DVD in = 1 available, 1 total
  sqlite.exec(`
    INSERT INTO copies (id, title_id, barcode, format, status)
    VALUES
      ('${nanoid()}', '${ghostbustersId}', 'DVD-GB-001', 'DVD', 'in');
  `);

  // Alien: 1 Blu-ray out = 0 available, 1 total
  sqlite.exec(`
    INSERT INTO copies (id, title_id, barcode, format, status)
    VALUES
      ('${nanoid()}', '${alienId}', 'BLU-AL-001', 'Blu-ray', 'out');
  `);

  // Die Hard: no copies = 0 available, 0 total
}

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const searchRoutes = createSearchRoutes(db);
  app = new Hono();
  app.route('/api/search', searchRoutes);

  seedTestData();
});

describe('GET /api/search', () => {
  it('returns all titles with default pagination when no filters', async () => {
    const res = await app.request('/api/search');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(5);
    expect(body.total).toBe(5);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it('searches by text query matching title name', async () => {
    const res = await app.request('/api/search?q=Matrix');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('The Matrix');
    expect(body.total).toBe(1);
  });

  it('searches by text query matching cast_list field', async () => {
    const res = await app.request('/api/search?q=Keanu');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('The Matrix');
  });

  it('searches by text query matching synopsis', async () => {
    const res = await app.request('/api/search?q=replicants');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('Blade Runner');
  });

  it('searches by text query matching genre', async () => {
    const res = await app.request('/api/search?q=Comedy');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('Ghostbusters');
  });

  it('text search is case-insensitive', async () => {
    const res = await app.request('/api/search?q=matrix');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('The Matrix');
  });

  it('filters by genre (exact match)', async () => {
    const res = await app.request('/api/search?genre=Sci-Fi');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(2);
    const names = body.titles.map((t: any) => t.name).sort();
    expect(names).toEqual(['Alien', 'Blade Runner']);
  });

  it('filters by format (title has at least one copy with that format)', async () => {
    const res = await app.request('/api/search?format=Blu-ray');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(2);
    const names = body.titles.map((t: any) => t.name).sort();
    expect(names).toEqual(['Alien', 'The Matrix']);
  });

  it('filters by available (only titles with in-stock copies)', async () => {
    const res = await app.request('/api/search?available=true');
    expect(res.status).toBe(200);

    const body = await res.json();
    // Alien has 0 available, Die Hard has 0 copies
    expect(body.titles).toHaveLength(3);
    const names = body.titles.map((t: any) => t.name).sort();
    expect(names).toEqual(['Blade Runner', 'Ghostbusters', 'The Matrix']);
  });

  it('filters by rating (exact match)', async () => {
    const res = await app.request('/api/search?rating=PG');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('Ghostbusters');
  });

  it('filters by year (exact match)', async () => {
    const res = await app.request('/api/search?year=1999');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('The Matrix');
  });

  it('combines multiple filters', async () => {
    // Action genre + R rating = Matrix and Die Hard
    // But also available=true should exclude Die Hard (no copies)
    const res = await app.request('/api/search?genre=Action&rating=R&available=true');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('The Matrix');
  });

  it('combines text search with filters', async () => {
    // q=runner + genre=Sci-Fi should find Blade Runner
    const res = await app.request('/api/search?q=runner&genre=Sci-Fi');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('Blade Runner');
  });

  it('returns availableCopies and totalCopies counts', async () => {
    const res = await app.request('/api/search?q=Matrix');
    expect(res.status).toBe(200);

    const body = await res.json();
    const matrix = body.titles[0];
    expect(matrix.availableCopies).toBe(3);
    expect(matrix.totalCopies).toBe(4);
  });

  it('returns correct counts for title with no available copies', async () => {
    const res = await app.request('/api/search?q=Alien');
    expect(res.status).toBe(200);

    const body = await res.json();
    const alien = body.titles[0];
    expect(alien.availableCopies).toBe(0);
    expect(alien.totalCopies).toBe(1);
  });

  it('returns correct counts for title with no copies at all', async () => {
    const res = await app.request('/api/search?q=Die+Hard');
    expect(res.status).toBe(200);

    const body = await res.json();
    const dieHard = body.titles[0];
    expect(dieHard.availableCopies).toBe(0);
    expect(dieHard.totalCopies).toBe(0);
  });

  it('paginates results', async () => {
    const res = await app.request('/api/search?limit=2&page=1');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(2);
    expect(body.total).toBe(5);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(2);
  });

  it('returns correct second page', async () => {
    const res = await app.request('/api/search?limit=2&page=3');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1); // 5 total, page 3 at limit 2 = 1 item
    expect(body.page).toBe(3);
  });

  it('returns empty results when no matches', async () => {
    const res = await app.request('/api/search?q=Nonexistent+Movie+XYZ');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it('sorts by name by default', async () => {
    const res = await app.request('/api/search');
    expect(res.status).toBe(200);

    const body = await res.json();
    const names = body.titles.map((t: any) => t.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('sorts by year when sort=year', async () => {
    const res = await app.request('/api/search?sort=year');
    expect(res.status).toBe(200);

    const body = await res.json();
    const years = body.titles.map((t: any) => t.year);
    const sorted = [...years].sort((a: number, b: number) => a - b);
    expect(years).toEqual(sorted);
  });

  it('returns expected response shape for each title', async () => {
    const res = await app.request('/api/search?q=Matrix');
    expect(res.status).toBe(200);

    const body = await res.json();
    const title = body.titles[0];
    expect(title).toHaveProperty('id');
    expect(title).toHaveProperty('name');
    expect(title).toHaveProperty('year');
    expect(title).toHaveProperty('genre');
    expect(title).toHaveProperty('rating');
    expect(title).toHaveProperty('coverUrl');
    expect(title).toHaveProperty('availableCopies');
    expect(title).toHaveProperty('totalCopies');
  });

  it('filters by VHS format', async () => {
    const res = await app.request('/api/search?format=VHS');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.titles).toHaveLength(1);
    expect(body.titles[0].name).toBe('Blade Runner');
  });
});
