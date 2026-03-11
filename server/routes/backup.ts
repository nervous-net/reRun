// ABOUTME: Hono route handlers for database backup, restore, and CSV data export
// ABOUTME: Manages SQLite file backups, lists/restores snapshots, and exports tables as CSV

import { Hono } from 'hono';
import fs from 'fs';
import path from 'path';
import { storeSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { resolveBackupDir } from '../lib/resolve-backup-dir.js';

const VALID_TABLES = [
  'titles', 'copies', 'customers', 'family_members',
  'rentals', 'transactions', 'transaction_items',
  'products', 'pricing_rules', 'reservations',
  'promotions', 'store_settings', 'alert_configs',
] as const;

type ValidTable = typeof VALID_TABLES[number];

interface BackupOptions {
  dbPath: string;
  defaultBackupDir: string;
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

/**
 * Scan a directory for backup files and return metadata for each.
 * Returns empty array if directory doesn't exist or can't be read.
 */
function scanBackupDir(dir: string): Array<{ filename: string; size: number; createdAt: string; location: string }> {
  if (!fs.existsSync(dir)) return [];
  try {
    return fs.readdirSync(dir)
      .filter((f) => f.startsWith('rerun-') && f.endsWith('.db'))
      .map((filename) => {
        const filePath = path.join(dir, filename);
        const stat = fs.statSync(filePath);
        return { filename, size: stat.size, createdAt: stat.mtime.toISOString(), location: dir };
      });
  } catch {
    return [];
  }
}

export function createBackupRoutes(db: any, options: BackupOptions) {
  const routes = new Hono();
  const { dbPath, defaultBackupDir } = options;

  // Get the raw sqlite instance from Drizzle
  function getSqlite() {
    return db.$client;
  }

  // POST / — Create a backup of the SQLite database
  routes.post('/', async (c) => {
    try {
      const sqlite = getSqlite();

      // Resolve effective backup directory (respects custom backup_dir setting)
      const { path: effectiveBackupDir } = await resolveBackupDir(db, defaultBackupDir);

      // Ensure backups directory exists
      if (!fs.existsSync(effectiveBackupDir)) {
        fs.mkdirSync(effectiveBackupDir, { recursive: true });
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
      const backupPath = path.join(effectiveBackupDir, filename);

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

  // GET /list — List available backup files from both default and custom directories
  routes.get('/list', async (c) => {
    try {
      const [setting] = await db.select().from(storeSettings)
        .where(eq(storeSettings.key, 'backup_dir'));
      const customDir = setting?.value?.trim() || null;

      const defaultBackups = scanBackupDir(defaultBackupDir);
      const customBackups = (customDir && path.resolve(customDir) !== path.resolve(defaultBackupDir))
        ? scanBackupDir(path.resolve(customDir))
        : [];

      // Merge, dedup by filename (custom takes precedence), sort by mtime desc
      const seen = new Set<string>();
      const merged: Array<{ filename: string; size: number; createdAt: string; location: string }> = [];
      for (const b of [...customBackups, ...defaultBackups]) {
        if (!seen.has(b.filename)) {
          seen.add(b.filename);
          merged.push(b);
        }
      }
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return c.json({ backups: merged });
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

    // Get location from body (optional)
    let location: string | null = null;
    try {
      const body = await c.req.json();
      location = body?.location ?? null;
    } catch { /* no body is fine */ }

    // Validate location is one of the known backup directories
    const [setting] = await db.select().from(storeSettings)
      .where(eq(storeSettings.key, 'backup_dir'));
    const customDir = setting?.value?.trim() || null;
    const knownDirs = [path.resolve(defaultBackupDir)];
    if (customDir) knownDirs.push(path.resolve(customDir));

    if (location) {
      const resolvedLocation = path.resolve(location);
      if (!knownDirs.includes(resolvedLocation)) {
        return c.json({ error: 'Invalid backup location' }, 400);
      }
    }

    // Find the backup file
    const searchDirs = location ? [path.resolve(location)] : knownDirs;
    let backupPath: string | null = null;
    for (const dir of searchDirs) {
      const candidate = path.join(dir, filename);
      if (fs.existsSync(candidate)) {
        backupPath = candidate;
        break;
      }
    }

    if (!backupPath) {
      return c.json({ error: `Backup file not found: ${filename}` }, 404);
    }

    try {
      console.warn(`[BACKUP] DESTRUCTIVE: Restoring database from ${filename}`);

      const sqlite = getSqlite();

      // Close the active database connection so SQLite releases the file
      sqlite.close();

      // Remove WAL and SHM files — stale WAL data would overwrite the restored backup
      const walPath = dbPath + '-wal';
      const shmPath = dbPath + '-shm';
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

      // Copy backup over the main database file
      fs.copyFileSync(backupPath, dbPath);

      // Send response before exiting — PM2 will restart the process
      const body = JSON.stringify({
        message: `Database restored from ${filename}. Server is restarting...`,
        restartRequired: true,
      });
      const response = new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      // Exit after a brief delay to allow the response to flush
      setTimeout(() => {
        console.log('[BACKUP] Restore complete. Exiting for PM2 restart...');
        process.exit(0);
      }, 500);

      return response;
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
