// ABOUTME: Singleton database connection using better-sqlite3 and Drizzle ORM
// ABOUTME: Configures WAL mode, foreign keys, and auto-migrates if tables are missing

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

// Auto-migrate: apply schema if core tables are missing
const tables = sqlite.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='store_settings'"
).all();
if (tables.length === 0) {
  // Try both dev path (server/db/ -> ../../drizzle) and prod path (CWD/drizzle)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, '../../drizzle'),
    path.resolve('drizzle'),
  ];
  const drizzleDir = candidates.find(d => fs.existsSync(d));
  if (drizzleDir) {
    const sqlFiles = fs.readdirSync(drizzleDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of sqlFiles) {
      const sql = fs.readFileSync(path.join(drizzleDir, file), 'utf-8');
      sqlite.exec(sql);
    }
    console.log('Database tables created automatically');
  }
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
