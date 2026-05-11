// ABOUTME: Tests for the debug API route that dumps raw title/copy truth for troubleshooting search issues
// ABOUTME: Covers missing param errors, inactive/whitespace title visibility, copy counts, empty results, and case-insensitivity

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createDebugRoutes } from '../../../server/routes/debug.js';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

let roomActiveId: string;
let roomInactiveId: string;

function seedTestData() {
  roomActiveId = nanoid();
  roomInactiveId = nanoid();

  // Active title 'Room' with 2 'in' copies + 1 'out' copy
  sqlite.exec(`
    INSERT INTO titles (id, name, year, genre, rating, active)
    VALUES ('${roomActiveId}', 'Room', 2015, 'Drama', 'R', 1);
  `);
  sqlite.exec(`
    INSERT INTO copies (id, title_id, barcode, format, status)
    VALUES
      ('${nanoid()}', '${roomActiveId}', 'DVD-RM-001', 'DVD', 'in'),
      ('${nanoid()}', '${roomActiveId}', 'DVD-RM-002', 'DVD', 'in'),
      ('${nanoid()}', '${roomActiveId}', 'DVD-RM-003', 'DVD', 'out');
  `);

  // Inactive title literally named 'Room ' (trailing space), no copies
  sqlite.exec(`
    INSERT INTO titles (id, name, year, genre, rating, active)
    VALUES ('${roomInactiveId}', 'Room ', 2019, 'Comedy', 'PG', 0);
  `);
}

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const debugRoutes = createDebugRoutes(db);
  app = new Hono();
  app.route('/api/debug', debugRoutes);

  seedTestData();
});

describe('GET /api/debug/title', () => {
  it('returns 400 when name query param is missing', async () => {
    const res = await app.request('/api/debug/title');
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toBe('name query param is required');
  });

  it('returns an active title with its copy counts', async () => {
    const res = await app.request('/api/debug/title?name=Room');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.query).toBe('Room');
    // Both 'Room' and 'Room ' match the LIKE %Room%
    expect(body.matchCount).toBe(2);

    const active = body.titles.find((t: any) => t.id === roomActiveId);
    expect(active).toBeDefined();
    expect(active.active).toBeTruthy();
    expect(active.availableCopies).toBe(2);
    expect(active.totalCopies).toBe(3);
    expect(active.nameQuoted).toBe('[Room]');
    expect(active.nameLength).toBe(4);
    expect(active.nameJson).toBe('"Room"');
    const inCount = active.copies.find((c: any) => c.status === 'in');
    expect(inCount.count).toBe(2);
    const outCount = active.copies.find((c: any) => c.status === 'out');
    expect(outCount.count).toBe(1);
  });

  it('returns inactive (soft-deleted) titles with trailing whitespace visible', async () => {
    const res = await app.request('/api/debug/title?name=Room');
    expect(res.status).toBe(200);

    const body = await res.json();
    const inactive = body.titles.find((t: any) => t.id === roomInactiveId);
    expect(inactive).toBeDefined();
    expect(inactive.active).toBeFalsy();
    expect(inactive.nameQuoted).toBe('[Room ]');
    expect(inactive.nameLength).toBe(5);
    expect(inactive.totalCopies).toBe(0);
    expect(inactive.availableCopies).toBe(0);
    expect(inactive.copies).toEqual([]);
  });

  it('returns matchCount 0 and empty titles when no title matches', async () => {
    const res = await app.request('/api/debug/title?name=Ghostbusters');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.matchCount).toBe(0);
    expect(body.titles).toEqual([]);
  });

  it('matches case-insensitively', async () => {
    const res = await app.request('/api/debug/title?name=room');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.matchCount).toBe(2);
    const active = body.titles.find((t: any) => t.id === roomActiveId);
    expect(active).toBeDefined();
    expect(active.name).toBe('Room');
  });
});
