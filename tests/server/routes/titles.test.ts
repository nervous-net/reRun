// ABOUTME: Tests for the titles API routes (CRUD operations on titles and their copies)
// ABOUTME: Covers creation, listing with pagination, get by ID, update, and adding copies

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createTitlesRoutes } from '../../../server/routes/titles.js';
import { titles, copies } from '../../../server/db/schema.js';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const titlesRoutes = createTitlesRoutes(db);
  app = new Hono();
  app.route('/api/titles', titlesRoutes);
});

describe('POST /api/titles', () => {
  it('creates a title with name and year', async () => {
    const res = await app.request('/api/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Blade Runner', year: 1982 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Blade Runner');
    expect(body.year).toBe(1982);
    expect(body.id).toBeDefined();
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
  });

  it('creates a title with all optional fields', async () => {
    const res = await app.request('/api/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Blade Runner',
        year: 1982,
        genre: 'Sci-Fi',
        runtimeMinutes: 117,
        synopsis: 'A blade runner hunts replicants.',
        rating: 'R',
        cast: 'Harrison Ford, Rutger Hauer',
        coverUrl: 'https://example.com/cover.jpg',
        tmdbId: 78,
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.genre).toBe('Sci-Fi');
    expect(body.runtimeMinutes).toBe(117);
    expect(body.synopsis).toBe('A blade runner hunts replicants.');
    expect(body.rating).toBe('R');
    expect(body.cast).toBe('Harrison Ford, Rutger Hauer');
    expect(body.coverUrl).toBe('https://example.com/cover.jpg');
    expect(body.tmdbId).toBe(78);
  });

  it('returns 400 when name is missing', async () => {
    const res = await app.request('/api/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: 1982 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when year is missing', async () => {
    const res = await app.request('/api/titles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Blade Runner' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('GET /api/titles', () => {
  beforeEach(async () => {
    // Seed some titles directly
    for (let i = 1; i <= 25; i++) {
      await db.insert(titles).values({
        id: nanoid(),
        name: `Movie ${String(i).padStart(2, '0')}`,
        year: 2000 + i,
      });
    }
  });

  it('returns paginated titles with default page=1 and limit=20', async () => {
    const res = await app.request('/api/titles');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(20);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.total).toBe(25);
  });

  it('returns second page of titles', async () => {
    const res = await app.request('/api/titles?page=2&limit=20');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(5);
    expect(body.page).toBe(2);
    expect(body.total).toBe(25);
  });

  it('respects custom limit', async () => {
    const res = await app.request('/api/titles?limit=10');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(10);
    expect(body.limit).toBe(10);
  });

  it('includes availableCopies count for each title', async () => {
    // Get the first title
    const allTitles = await db.select().from(titles);
    const titleId = allTitles[0].id;

    // Add some copies, 2 available (status = 'in'), 1 checked out
    await db.insert(copies).values([
      { id: nanoid(), titleId, barcode: 'DVD-001', format: 'DVD', status: 'in' },
      { id: nanoid(), titleId, barcode: 'DVD-002', format: 'DVD', status: 'in' },
      { id: nanoid(), titleId, barcode: 'DVD-003', format: 'DVD', status: 'out' },
    ]);

    const res = await app.request('/api/titles?limit=25');
    expect(res.status).toBe(200);

    const body = await res.json();
    const titleWithCopies = body.data.find((t: any) => t.id === titleId);
    expect(titleWithCopies.availableCopies).toBe(2);

    // Title without copies should have 0
    const titleWithoutCopies = body.data.find((t: any) => t.id !== titleId);
    expect(titleWithoutCopies.availableCopies).toBe(0);
  });
});

describe('GET /api/titles/:id', () => {
  it('returns a title with all its copies', async () => {
    const titleId = nanoid();
    await db.insert(titles).values({
      id: titleId,
      name: 'The Matrix',
      year: 1999,
      genre: 'Sci-Fi',
    });

    const copyId1 = nanoid();
    const copyId2 = nanoid();
    await db.insert(copies).values([
      { id: copyId1, titleId, barcode: 'DVD-MAT-001', format: 'DVD', status: 'in' },
      { id: copyId2, titleId, barcode: 'BLU-MAT-001', format: 'Blu-ray', status: 'out' },
    ]);

    const res = await app.request(`/api/titles/${titleId}`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.id).toBe(titleId);
    expect(body.name).toBe('The Matrix');
    expect(body.copies).toHaveLength(2);
    expect(body.copies.map((c: any) => c.id).sort()).toEqual([copyId1, copyId2].sort());
  });

  it('returns 404 for non-existent title', async () => {
    const res = await app.request('/api/titles/nonexistent-id');
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('PUT /api/titles/:id', () => {
  it('updates a title', async () => {
    const titleId = nanoid();
    await db.insert(titles).values({
      id: titleId,
      name: 'The Matirx',
      year: 1999,
    });

    const res = await app.request(`/api/titles/${titleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'The Matrix', genre: 'Sci-Fi', rating: 'R' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('The Matrix');
    expect(body.genre).toBe('Sci-Fi');
    expect(body.rating).toBe('R');
    expect(body.year).toBe(1999); // unchanged field preserved
  });

  it('returns 404 for non-existent title', async () => {
    const res = await app.request('/api/titles/nonexistent-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nope' }),
    });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/titles/:id/copies', () => {
  it('adds copies to a title with generated barcodes', async () => {
    const titleId = nanoid();
    await db.insert(titles).values({
      id: titleId,
      name: 'Ghostbusters',
      year: 1984,
    });

    const res = await app.request(`/api/titles/${titleId}/copies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'DVD', quantity: 3 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.copies).toHaveLength(3);
    expect(body.copies[0].format).toBe('DVD');
    expect(body.copies[0].status).toBe('in');
    expect(body.copies[0].condition).toBe('good');
    expect(body.copies[0].barcode).toBeDefined();
    expect(body.copies[0].titleId).toBe(titleId);

    // Each copy should have a unique barcode
    const barcodes = body.copies.map((c: any) => c.barcode);
    expect(new Set(barcodes).size).toBe(3);
  });

  it('accepts a custom condition', async () => {
    const titleId = nanoid();
    await db.insert(titles).values({
      id: titleId,
      name: 'Alien',
      year: 1979,
    });

    const res = await app.request(`/api/titles/${titleId}/copies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'VHS', quantity: 1, condition: 'fair' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.copies[0].condition).toBe('fair');
  });

  it('defaults quantity to 1 if not specified', async () => {
    const titleId = nanoid();
    await db.insert(titles).values({
      id: titleId,
      name: 'Aliens',
      year: 1986,
    });

    const res = await app.request(`/api/titles/${titleId}/copies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'Blu-ray' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.copies).toHaveLength(1);
  });

  it('returns 404 for non-existent title', async () => {
    const res = await app.request('/api/titles/nonexistent-id/copies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'DVD', quantity: 1 }),
    });

    expect(res.status).toBe(404);
  });

  it('returns 400 when format is missing', async () => {
    const titleId = nanoid();
    await db.insert(titles).values({
      id: titleId,
      name: 'Predator',
      year: 1987,
    });

    const res = await app.request(`/api/titles/${titleId}/copies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: 2 }),
    });

    expect(res.status).toBe(400);
  });

  it('continues barcode sequence from existing copies', async () => {
    const titleId = nanoid();
    await db.insert(titles).values({
      id: titleId,
      name: 'Terminator',
      year: 1984,
    });

    // Add first batch
    await app.request(`/api/titles/${titleId}/copies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'DVD', quantity: 2 }),
    });

    // Add second batch
    const res = await app.request(`/api/titles/${titleId}/copies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format: 'DVD', quantity: 2 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();

    // Second batch barcodes should not conflict with first batch
    const allCopies = await db.select().from(copies);
    const barcodes = allCopies.map((c) => c.barcode);
    expect(new Set(barcodes).size).toBe(4); // all unique
  });
});
