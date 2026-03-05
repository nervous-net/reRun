// ABOUTME: Singleton database connection using better-sqlite3 and Drizzle ORM
// ABOUTME: Configures WAL mode, foreign keys, and tracks/applies SQL migrations on startup

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const DB_PATH = process.env.DB_PATH || './data/rerun.db';

// Ensure the data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite: Database.Database = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

// Auto-migrate: track and apply SQL migrations from drizzle/ directory
sqlite.exec(`CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT DEFAULT (datetime('now'))
)`);

// Try both dev path (server/db/ -> ../../drizzle) and prod path (CWD/drizzle)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(__dirname, '../../drizzle'),
  path.resolve('drizzle'),
];
const drizzleDir = candidates.find(d => fs.existsSync(d));
if (drizzleDir) {
  // Backfill: if _migrations is empty but DB already has tables, mark all existing
  // migrations as applied (handles upgrade from drizzle-kit-based workflow)
  const migrationCount = (sqlite.prepare('SELECT COUNT(*) as cnt FROM _migrations').get() as { cnt: number }).cnt;
  const hasExistingTables = (sqlite.prepare(
    "SELECT COUNT(*) as cnt FROM sqlite_master WHERE type='table' AND name='store_settings'"
  ).get() as { cnt: number }).cnt > 0;
  if (migrationCount === 0 && hasExistingTables) {
    const allSqlFiles = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of allSqlFiles) {
      sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    }
    if (allSqlFiles.length > 0) {
      console.log(`Backfilled ${allSqlFiles.length} migration(s) for existing database`);
    }
  }

  const applied = new Set(
    (sqlite.prepare('SELECT name FROM _migrations').all() as { name: string }[])
      .map(r => r.name)
  );
  const sqlFiles = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
  const pending = sqlFiles.filter(f => !applied.has(f));
  if (pending.length > 0) {
    const applyMigration = sqlite.transaction(() => {
      for (const file of pending) {
        const raw = fs.readFileSync(path.join(drizzleDir, file), 'utf-8');
        // Split on drizzle statement breakpoints and run each statement
        const statements = raw.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
        for (const stmt of statements) {
          sqlite.exec(stmt);
        }
        sqlite.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
      }
    });
    applyMigration();
    console.log(`Applied ${pending.length} migration(s): ${pending.join(', ')}`);
  }
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
