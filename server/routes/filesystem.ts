// ABOUTME: API route for browsing server filesystem directories
// ABOUTME: Used by the Settings UI directory picker for choosing a backup location

import { Hono } from 'hono';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const MAX_ENTRIES = 200;
const DANGEROUS_PREFIXES_UNIX = ['/proc', '/sys', '/dev'];

function isDangerousPath(resolved: string): boolean {
  if (process.platform === 'win32') return false;
  return DANGEROUS_PREFIXES_UNIX.some(
    (prefix) => resolved === prefix || resolved.startsWith(prefix + '/'),
  );
}

function getWindowsDriveRoots(): Array<{ name: string; path: string }> {
  try {
    const output = execSync(
      'powershell -NoProfile -Command "Get-PSDrive -PSProvider FileSystem | Select-Object -ExpandProperty Root"',
      { encoding: 'utf-8', timeout: 5000 },
    );
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((root) => ({ name: root, path: root }));
  } catch {
    return [{ name: 'C:\\', path: 'C:\\' }];
  }
}

export function createFilesystemRoutes() {
  const routes = new Hono();

  routes.get('/browse', async (c) => {
    const rawPath = c.req.query('path') || '';

    if (!rawPath && process.platform === 'win32') {
      const drives = getWindowsDriveRoots();
      return c.json({ current: '', parent: null, directories: drives });
    }

    const resolved = path.resolve(rawPath || '/');

    if (isDangerousPath(resolved)) {
      return c.json({ error: 'Access to dangerous system path is not allowed' }, 400);
    }

    try {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        return c.json({ error: 'Path is not a directory' }, 400);
      }
    } catch {
      return c.json({ error: 'Path does not exist or is not accessible' }, 400);
    }

    try {
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      const directories = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
        .map((entry) => ({
          name: entry.name,
          path: path.join(resolved, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_ENTRIES);

      const parent = resolved === path.parse(resolved).root ? null : path.dirname(resolved);

      return c.json({ current: resolved, parent, directories });
    } catch {
      return c.json({ error: 'Cannot read directory' }, 400);
    }
  });

  return routes;
}
