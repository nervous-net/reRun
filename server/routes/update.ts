// ABOUTME: API routes for checking and installing app updates
// ABOUTME: GET /status returns update availability, POST /install triggers the update process

import { Hono } from 'hono';
import { spawn } from 'child_process';
import path from 'path';
import { getUpdateStatus, setUpdating } from '../services/update.js';

export function createUpdateRoutes(dbPath: string, backupDir: string) {
  const routes = new Hono();

  routes.get('/status', async (c) => {
    const status = getUpdateStatus();
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
    const scriptPath = path.resolve('dist/scripts/do-update.js');
    const child = spawn('node', [
      scriptPath,
      '--version', status.availableUpdate.tagName,
      '--url', status.availableUpdate.downloadUrl,
      '--db-path', dbPath,
      '--backup-dir', backupDir,
    ], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    return c.json({ message: 'Update started', version: status.availableUpdate.version });
  });

  return routes;
}
