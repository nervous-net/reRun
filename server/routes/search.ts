// ABOUTME: Hono route handler for searching titles with multi-field filtering and pagination
// ABOUTME: Supports text search, genre/format/rating/year filters, availability check, and sorting

import { Hono } from 'hono';

export function createSearchRoutes(db: any) {
  const routes = new Hono();

  // GET / — Search titles with filters
  routes.get('/', async (c) => {
    const q = c.req.query('q');
    const genre = c.req.query('genre');
    const format = c.req.query('format');
    const available = c.req.query('available');
    const rating = c.req.query('rating');
    const year = c.req.query('year');
    const sort = c.req.query('sort') || 'name';
    const page = Math.max(1, Number(c.req.query('page') || '1'));
    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || '20')));
    const offset = (page - 1) * limit;

    // Build dynamic WHERE clauses with parameterized values
    const conditions: string[] = [];
    const params: any[] = [];

    if (q) {
      conditions.push(
        `(t.name LIKE ? COLLATE NOCASE OR t.cast_list LIKE ? COLLATE NOCASE OR t.synopsis LIKE ? COLLATE NOCASE OR t.genre LIKE ? COLLATE NOCASE)`
      );
      const likePattern = `%${q}%`;
      params.push(likePattern, likePattern, likePattern, likePattern);
    }

    if (genre) {
      conditions.push(`t.genre LIKE ?`);
      params.push(`%${genre}%`);
    }

    if (rating) {
      conditions.push(`t.rating = ?`);
      params.push(rating);
    }

    if (year) {
      conditions.push(`t.year = ?`);
      params.push(Number(year));
    }

    if (format) {
      const formats = format.split(',').map(f => f.trim());
      const placeholders = formats.map(() => '?').join(',');
      conditions.push(
        `EXISTS (SELECT 1 FROM copies c2 WHERE c2.title_id = t.id AND c2.format IN (${placeholders}))`
      );
      params.push(...formats);
    }

    if (available === 'true') {
      conditions.push(
        `EXISTS (SELECT 1 FROM copies c3 WHERE c3.title_id = t.id AND c3.status = 'in')`
      );
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const orderClause = sort === 'year'
      ? 'ORDER BY t.year ASC, t.name ASC'
      : 'ORDER BY t.name ASC';

    // Access the underlying better-sqlite3 instance for parameterized raw SQL
    const sqlite = db.$client;

    // Count query for total matching results
    const countSql = `SELECT count(*) as total FROM titles t ${whereClause}`;
    const countRow = sqlite.prepare(countSql).get(...params) as { total: number };
    const total = countRow.total;

    // Main query with copy counts
    const mainSql = `
      SELECT
        t.id,
        t.name,
        t.year,
        t.genre,
        t.rating,
        t.cover_url AS "coverUrl",
        (SELECT count(*) FROM copies c WHERE c.title_id = t.id AND c.status = 'in') AS "availableCopies",
        (SELECT count(*) FROM copies c WHERE c.title_id = t.id) AS "totalCopies"
      FROM titles t
      ${whereClause}
      ${orderClause}
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = sqlite.prepare(mainSql).all(...params) as any[];

    // Fetch distinct formats per title
    const formatSql = `SELECT DISTINCT format FROM copies WHERE title_id = ?`;
    const formatStmt = sqlite.prepare(formatSql);
    const enriched = rows.map((row) => {
      const formatRows = formatStmt.all(row.id) as { format: string }[];
      return { ...row, formats: formatRows.map((f) => f.format) };
    });

    return c.json({
      titles: enriched,
      total,
      page,
      limit,
    });
  });

  return routes;
}
