// ABOUTME: Resolves the effective backup directory from store_settings
// ABOUTME: Falls back to default path and sets warning flag when custom path is unavailable

import fs from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import { storeSettings } from '../db/schema.js';

interface ResolveResult {
  path: string;
  fallback: boolean;
}

export async function resolveBackupDir(db: any, defaultBackupDir: string): Promise<ResolveResult> {
  const [setting] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, 'backup_dir'));

  const customPath = setting?.value?.trim();

  if (!customPath) {
    return { path: defaultBackupDir, fallback: false };
  }

  const resolved = path.resolve(customPath);

  try {
    // Create directory if it doesn't exist
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }

    // Verify it's a directory and writable by writing a temp file
    const testFile = path.join(resolved, `.backup-test-${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);

    return { path: resolved, fallback: false };
  } catch {
    // Custom path unavailable — set warning flag and fall back
    console.warn(`[BACKUP] Custom backup path unavailable: ${resolved}. Falling back to default.`);
    try {
      await db
        .insert(storeSettings)
        .values({ key: 'backup_fallback_warning', value: 'true' })
        .onConflictDoUpdate({ target: storeSettings.key, set: { value: 'true' } });
    } catch (flagErr) {
      console.error('[BACKUP] Failed to set fallback warning flag:', flagErr);
    }
    return { path: defaultBackupDir, fallback: true };
  }
}
