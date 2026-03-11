// ABOUTME: Store settings API routes for global configuration key-value pairs
// ABOUTME: Supports get/upsert settings, backup directory verification, and backup_dir validation

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { storeSettings } from '../db/schema.js';
import { getNow } from '../lib/date.js';

const LOW_SPACE_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100MB

function validateBackupPath(dirPath: string): {
  valid: boolean;
  exists: boolean;
  writable: boolean;
  created: boolean;
  warning?: string;
  error?: string;
} {
  const resolved = path.resolve(dirPath);
  let exists = false;
  let created = false;

  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return { valid: false, exists: true, writable: false, created: false, error: 'Path exists but is not a directory' };
    }
    exists = true;
  } catch {
    // Directory does not exist — try to create it
    try {
      fs.mkdirSync(resolved, { recursive: true });
      exists = true;
      created = true;
    } catch (err: any) {
      return { valid: false, exists: false, writable: false, created: false, error: err.message };
    }
  }

  // Test write access
  const testFile = path.join(resolved, `.rerun-write-test-${Date.now()}`);
  try {
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (err: any) {
    return { valid: false, exists, writable: false, created, error: err.message };
  }

  // Check disk space
  let warning: string | undefined;
  try {
    const stats = fs.statfsSync(resolved);
    const freeBytes = stats.bfree * stats.bsize;
    if (freeBytes < LOW_SPACE_THRESHOLD_BYTES) {
      const freeMB = Math.floor(freeBytes / (1024 * 1024));
      warning = `Low disk space: only ${freeMB}MB free`;
    }
  } catch {
    // statfs not available on all platforms — skip the warning
  }

  return { valid: true, exists, writable: true, created, ...(warning ? { warning } : {}) };
}

async function clearFallbackWarning(db: any) {
  await db
    .insert(storeSettings)
    .values({ key: 'backup_fallback_warning', value: 'false' })
    .onConflictDoUpdate({ target: storeSettings.key, set: { value: 'false' } });
}

export function createSettingsRoutes(db: any) {
  const routes = new Hono();

  // GET / — get all settings as a key-value object
  routes.get('/', async (c) => {
    const rows = await db.select().from(storeSettings);

    const settings: Record<string, string | null> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return c.json({ data: settings });
  });

  // GET /dev-time — get effective date for dev mode
  routes.get('/dev-time', async (c) => {
    const effectiveDate = getNow(db).toISOString();
    const realDate = new Date().toISOString();
    return c.json({ effectiveDate, realDate });
  });

  // POST /backup-dir/verify — validate a directory path for backup use
  // Must be registered before PUT /:key so Hono matches the specific path first
  routes.post('/backup-dir/verify', async (c) => {
    const body = await c.req.json();

    if (!body.path || typeof body.path !== 'string' || body.path.trim() === '') {
      return c.json({ error: 'Missing required field: path' }, 400);
    }

    const result = validateBackupPath(body.path);
    return c.json(result);
  });

  // GET /:key — get a single setting
  routes.get('/:key', async (c) => {
    const key = c.req.param('key');
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.key, key));
    if (!row) {
      return c.json({ key, value: null });
    }
    return c.json(row);
  });

  // PUT /:key — upsert a setting
  routes.put('/:key', async (c) => {
    const key = c.req.param('key');
    const body = await c.req.json();

    if (body.value === undefined) {
      return c.json({ error: 'Missing required field: value' }, 400);
    }

    // Special validation for backup_dir
    if (key === 'backup_dir') {
      if (body.value !== '') {
        // Validate the path before saving
        const result = validateBackupPath(body.value);
        if (!result.valid) {
          return c.json({ error: result.error ?? 'Invalid backup directory' }, 400);
        }
      }

      // Always clear fallback warning when backup_dir is updated (any value, including empty)
      await clearFallbackWarning(db);
    }

    const [existing] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, key));

    if (existing) {
      await db
        .update(storeSettings)
        .set({ value: body.value })
        .where(eq(storeSettings.key, key));
    } else {
      await db.insert(storeSettings).values({
        key,
        value: body.value,
      });
    }

    const [updated] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.key, key));

    return c.json(updated);
  });

  return routes;
}
