// ABOUTME: Hono route handlers for database backup, restore, and CSV data export
// ABOUTME: Manages SQLite file backups, lists/restores snapshots, and exports tables as CSV

import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import { storeSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const VALID_TABLES = [
  'titles', 'copies', 'customers', 'family_members',
  'rentals', 'transactions', 'transaction_items',
  'products', 'pricing_rules', 'reservations',
  'promotions', 'store_settings', 'alert_configs',
] as const;

type ValidTable = typeof VALID_TABLES[number];

interface BackupOptions {
  dbPath: string;
  backupDir: string;
}

/**
 * Escape a value for CSV output. Wraps in quotes if the value contains
 * commas, double quotes, or newlines. Double quotes are doubled per RFC 4180.
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function createBackupRoutes(db: any, options: BackupOptions) {
  const routes = new Hono();
  const { dbPath, backupDir } = options;

  // Get the raw sqlite instance from Drizzle
  function getSqlite() {
    return db.$client;
  }

  // POST / — Create a backup of the SQLite database
  routes.post('/', async (c) => {
    try {
      const sqlite = getSqlite();

      // Ensure backups directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Flush WAL to ensure the DB file is self-contained
      sqlite.pragma('wal_checkpoint(TRUNCATE)');

      // Generate timestamped filename
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/[-:]/g, (m: string) => m === '-' ? '-' : '')
        .replace(/:/g, '')
        .replace(/\.\d+Z$/, '')
        .split('T')
        .join('T');
      const filename = `rerun-${timestamp}.db`;
      const backupPath = path.join(backupDir, filename);

      // Copy the database file
      fs.copyFileSync(dbPath, backupPath);

      // Store last_backup_at in store_settings
      const backupTime = now.toISOString();
      await db
        .insert(storeSettings)
        .values({ key: 'last_backup_at', value: backupTime })
        .onConflictDoUpdate({
          target: storeSettings.key,
          set: { value: backupTime },
        });

      return c.json({ filename, createdAt: backupTime }, 201);
    } catch (err: any) {
      return c.json({ error: `Backup failed: ${err.message}` }, 500);
    }
  });

  // GET /list — List available backup files
  routes.get('/list', async (c) => {
    try {
      // If backups directory doesn't exist, return empty list
      if (!fs.existsSync(backupDir)) {
        return c.json({ backups: [] });
      }

      const files = fs.readdirSync(backupDir)
        .filter((f) => f.startsWith('rerun-') && f.endsWith('.db'))
        .sort()
        .reverse(); // Most recent first (filenames sort chronologically)

      const backups = files.map((filename) => {
        const filePath = path.join(backupDir, filename);
        const stat = fs.statSync(filePath);
        return {
          filename,
          size: stat.size,
          createdAt: stat.mtime.toISOString(),
        };
      });

      return c.json({ backups });
    } catch (err: any) {
      return c.json({ error: `Failed to list backups: ${err.message}` }, 500);
    }
  });

  // POST /restore/:filename — Restore database from a backup
  routes.post('/restore/:filename', async (c) => {
    const filename = c.req.param('filename');

    // Validate filename to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return c.json({ error: 'Invalid filename' }, 400);
    }

    const backupPath = path.join(backupDir, filename);

    if (!fs.existsSync(backupPath)) {
      return c.json({ error: `Backup file not found: ${filename}` }, 404);
    }

    try {
      console.warn(`[BACKUP] DESTRUCTIVE: Restoring database from ${filename}`);

      // Copy backup over the main database file
      fs.copyFileSync(backupPath, dbPath);

      return c.json({
        message: `Database restored from ${filename}. Server restart required to load restored data.`,
        restartRequired: true,
      });
    } catch (err: any) {
      return c.json({ error: `Restore failed: ${err.message}` }, 500);
    }
  });

  // GET /export/:table — Export a table as CSV
  routes.get('/export/:table', async (c) => {
    const table = c.req.param('table') as string;

    // Validate table name against allowlist
    if (!VALID_TABLES.includes(table as ValidTable)) {
      return c.json({
        error: `Invalid table: ${table}. Valid tables: ${VALID_TABLES.join(', ')}`,
      }, 400);
    }

    try {
      const sqlite = getSqlite();

      // Query all rows from the table using raw SQL
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];

      // Build CSV
      let csv = '';

      if (rows.length === 0) {
        // Get column names from table info for empty tables
        const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
        csv = columns.map((col) => col.name).join(',');
      } else {
        // Header row from first row's keys
        const headers = Object.keys(rows[0]);
        csv = headers.join(',') + '\n';

        // Data rows
        csv += rows
          .map((row) => headers.map((h) => csvEscape(row[h])).join(','))
          .join('\n');
      }

      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${table}-export.csv"`,
        },
      });
    } catch (err: any) {
      return c.json({ error: `Export failed: ${err.message}` }, 500);
    }
  });

  return routes;
}
