// ABOUTME: Hono diagnostic route for troubleshooting "title won't show up in search" issues
// ABOUTME: Dumps raw title rows (including inactive/soft-deleted) plus copy counts and name byte details

import { Hono } from 'hono';

export function createDebugRoutes(db: any) {
  const routes = new Hono();

  // GET /title?name=<query> — dump raw title truth from the DB
  routes.get('/title', async (c) => {
    const name = c.req.query('name');
    if (!name) {
      return c.json({ error: 'name query param is required' }, 400);
    }

    // Access the underlying better-sqlite3 instance for parameterized raw SQL
    const sqlite = db.$client;

    // Include inactive (soft-deleted) titles — no active filter on purpose
    const titleRows = sqlite
      .prepare(`SELECT * FROM titles WHERE name LIKE ? COLLATE NOCASE`)
      .all(`%${name}%`) as any[];

    const copyStmt = sqlite.prepare(
      `SELECT status, count(*) as count FROM copies WHERE title_id = ? GROUP BY status`
    );

    const enriched = titleRows.map((row) => {
      const copies = copyStmt.all(row.id) as { status: string; count: number }[];
      const totalCopies = copies.reduce((sum, c) => sum + c.count, 0);
      const inRow = copies.find((c) => c.status === 'in');
      const availableCopies = inRow ? inRow.count : 0;
      return {
        ...row,
        nameQuoted: `[${row.name}]`,
        nameLength: row.name.length,
        nameJson: JSON.stringify(row.name),
        active: row.active,
        copies,
        totalCopies,
        availableCopies,
      };
    });

    return c.json({
      query: name,
      matchCount: titleRows.length,
      titles: enriched,
    });
  });

  return routes;
}
