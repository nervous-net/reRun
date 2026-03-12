// ABOUTME: Shared backup creation utility used by backup route and nuke endpoint
// ABOUTME: Copies SQLite database file to timestamped backup after flushing WAL

import fs from 'fs';
import path from 'path';
import { storeSettings } from '../db/schema.js';
import { resolveBackupDir } from './resolve-backup-dir.js';

interface CreateBackupResult {
  filename: string;
  createdAt: string;
}

interface CreateBackupOptions {
  db: any;
  dbPath: string;
  defaultBackupDir: string;
}

export async function createBackup(options: CreateBackupOptions): Promise<CreateBackupResult> {
  const { db, dbPath, defaultBackupDir } = options;
  const sqlite = db.$client;

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

  return { filename, createdAt: backupTime };
}
