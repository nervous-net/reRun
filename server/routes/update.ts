// ABOUTME: API routes for checking and installing app updates
// ABOUTME: GET /status returns update availability, POST /install triggers the update process

import { Hono } from 'hono';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { getUpdateStatus, setUpdating, forceCheck } from '../services/update.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createUpdateRoutes(dbPath: string, backupDir: string) {
  const routes = new Hono();

  routes.get('/status', async (c) => {
    const status = getUpdateStatus();
    return c.json(status);
  });

  routes.post('/check', async (c) => {
    const status = await forceCheck();
    return c.json(status);
  });

  routes.post('/install', async (c) => {
    const status = getUpdateStatus();

    if (!status.availableUpdate) {
      return c.json({ error: 'No update available' }, 400);
    }

    if (status.updating) {
      return c.json({ error: 'Update already in progress' }, 400);
    }

    setUpdating(true);

    // Spawn the update script as a detached process
    // Use __dirname to build an absolute path — path.resolve relies on cwd which
    // may differ under PM2. Route is at dist/server/routes/, script is at dist/scripts/
    const scriptPath = path.resolve(__dirname, '..', '..', 'scripts', 'do-update.js');
    const appDir = path.resolve(__dirname, '..', '..', '..');
    const child = spawn('node', [
      scriptPath,
      '--version', status.availableUpdate.tagName,
      '--url', status.availableUpdate.downloadUrl,
      '--db-path', dbPath,
      '--backup-dir', backupDir,
    ], {
      cwd: appDir,
      detached: true,
      stdio: 'ignore',
    });
    child.on('error', (err) => {
      console.error(`[UPDATE] Failed to spawn update script: ${err.message}`);
      setUpdating(false);
    });
    child.unref();

    return c.json({ message: 'Update started', version: status.availableUpdate.version });
  });

  return routes;
}
