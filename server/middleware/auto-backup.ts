// ABOUTME: Middleware that creates a daily automatic backup of the SQLite database
// ABOUTME: Triggers on first request after midnight if no backup exists for today

import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema.js';
import { resolveBackupDir } from '../lib/resolve-backup-dir.js';

let lastCheckDate: string | null = null;

export function resetLastCheckDate() {
  lastCheckDate = null;
}

export function shouldRunDailyBackup(lastBackupAt: string | null, now: Date): boolean {
  const todayStr = now.toISOString().split('T')[0];
  if (!lastBackupAt) return true;
  const lastBackupDate = lastBackupAt.split('T')[0];
  return lastBackupDate < todayStr;
}

export function createAutoBackupMiddleware(db: any, dbPath: string, defaultBackupDir: string) {
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
        // Resolve the effective backup directory dynamically
        const { path: backupDir } = await resolveBackupDir(db, defaultBackupDir);

        if (!fs.existsSync(backupDir)) {
          fs.mkdirSync(backupDir, { recursive: true });
        }

        const sqlite = db.$client;
        sqlite.pragma('wal_checkpoint(TRUNCATE)');

        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '');
        const filename = `rerun-daily-${timestamp}.db`;

        let actualBackupDir = backupDir;
        try {
          fs.copyFileSync(dbPath, path.join(backupDir, filename));
        } catch (copyErr: any) {
          if (backupDir !== defaultBackupDir) {
            console.warn(`[AUTO-BACKUP] Copy failed in custom dir (${copyErr.code || copyErr.message}), falling back to default`);
            if (!fs.existsSync(defaultBackupDir)) {
              fs.mkdirSync(defaultBackupDir, { recursive: true });
            }
            fs.copyFileSync(dbPath, path.join(defaultBackupDir, filename));
            actualBackupDir = defaultBackupDir;
            await db
              .insert(storeSettings)
              .values({ key: 'backup_fallback_warning', value: 'true' })
              .onConflictDoUpdate({ target: storeSettings.key, set: { value: 'true' } });
          } else {
            throw copyErr;
          }
        }

        // Update last_backup_at
        const now = new Date().toISOString();
        await db
          .insert(storeSettings)
          .values({ key: 'last_backup_at', value: now })
          .onConflictDoUpdate({ target: storeSettings.key, set: { value: now } });

        // Prune old backups in actualBackupDir only (keep last 30)
        const files = fs.readdirSync(actualBackupDir)
          .filter((f: string) => f.startsWith('rerun-') && f.endsWith('.db'))
          .sort()
          .reverse();
        for (const old of files.slice(30)) {
          fs.unlinkSync(path.join(actualBackupDir, old));
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
