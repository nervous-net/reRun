// ABOUTME: Middleware that creates a daily automatic backup of the SQLite database
// ABOUTME: Triggers on first request after midnight if no backup exists for today

import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema.js';

let lastCheckDate: string | null = null;

export function shouldRunDailyBackup(lastBackupAt: string | null, now: Date): boolean {
  const todayStr = now.toISOString().split('T')[0];
  if (!lastBackupAt) return true;
  const lastBackupDate = lastBackupAt.split('T')[0];
  return lastBackupDate < todayStr;
}

export function createAutoBackupMiddleware(db: any, dbPath: string, backupDir: string) {
  return async function autoBackup(_c: any, next: () => Promise<void>) {
    const todayStr = new Date().toISOString().split('T')[0];

    // Only check once per calendar day
    if (lastCheckDate === todayStr) {
      return next();
    }

    try {
      const [setting] = await db
        .select()
        .from(storeSettings)
        .where(eq(storeSettings.key, 'last_backup_at'));

      const lastBackupAt = setting?.value ?? null;

      if (shouldRunDailyBackup(lastBackupAt, new Date())) {
        // Create backup
        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }

        const sqlite = db.$client;
        sqlite.pragma('wal_checkpoint(TRUNCATE)');

        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '');
        const filename = `rerun-daily-${timestamp}.db`;
        fs.copyFileSync(dbPath, path.join(backupDir, filename));

        // Update last_backup_at
        const now = new Date().toISOString();
        await db
          .insert(storeSettings)
          .values({ key: 'last_backup_at', value: now })
          .onConflictDoUpdate({ target: storeSettings.key, set: { value: now } });

        // Prune old backups (keep last 30)
        const files = fs.readdirSync(backupDir)
          .filter((f: string) => f.startsWith('rerun-') && f.endsWith('.db'))
          .sort()
          .reverse();
        for (const old of files.slice(30)) {
          fs.unlinkSync(path.join(backupDir, old));
        }
      }

      lastCheckDate = todayStr;
    } catch (err) {
      console.error('[AUTO-BACKUP] Failed:', err);
      // Don't block the request on backup failure
    }

    return next();
  };
}
