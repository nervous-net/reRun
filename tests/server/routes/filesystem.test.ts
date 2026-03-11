// ABOUTME: Tests for the filesystem directory browsing endpoint
// ABOUTME: Verifies directory listing, dangerous path rejection, and entry caps

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createFilesystemRoutes } from '../../../server/routes/filesystem.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

let app: Hono;
let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-browse-'));
  fs.mkdirSync(path.join(tmpDir, 'dir-a'));
  fs.mkdirSync(path.join(tmpDir, 'dir-b'));
  fs.mkdirSync(path.join(tmpDir, 'dir-c'));
  fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'not a directory');

  const routes = createFilesystemRoutes();
  app = new Hono();
  app.route('/api/filesystem', routes);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/filesystem/browse', () => {
  it('lists only directories, not files', async () => {
    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent(tmpDir)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current).toBe(tmpDir);
    expect(body.directories.length).toBe(3);
    expect(body.directories.map((d: any) => d.name).sort()).toEqual(['dir-a', 'dir-b', 'dir-c']);
    expect(body.parent).toBe(path.dirname(tmpDir));
  });

  it('returns 400 for non-existent path', async () => {
    const res = await app.request('/api/filesystem/browse?path=/nonexistent/path/xyz');
    expect(res.status).toBe(400);
  });

  it('rejects dangerous paths on Linux/macOS', async () => {
    if (process.platform === 'win32') return;
    const res = await app.request('/api/filesystem/browse?path=/proc');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/dangerous/i);
  });

  it('rejects path traversal attempts', async () => {
    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent('/tmp/../proc')}`);
    expect(res.status).toBe(400);
  });

  it('returns parent as null at root', async () => {
    const res = await app.request('/api/filesystem/browse?path=/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.parent).toBeNull();
  });

  it('caps results at 200 entries', async () => {
    for (let i = 0; i < 210; i++) {
      fs.mkdirSync(path.join(tmpDir, `subdir-${String(i).padStart(4, '0')}`));
    }
    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent(tmpDir)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.directories.length).toBe(200);
  });

  it('filters out hidden directories', async () => {
    fs.mkdirSync(path.join(tmpDir, '.hidden'));
    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent(tmpDir)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.directories.map((d: any) => d.name);
    expect(names).not.toContain('.hidden');
  });

  it('returns directories sorted alphabetically', async () => {
    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent(tmpDir)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const names = body.directories.map((d: any) => d.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('returns 400 for a file path, not a directory', async () => {
    const filePath = path.join(tmpDir, 'file.txt');
    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent(filePath)}`);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/not a directory/i);
  });

  it('each directory entry includes name and path', async () => {
    const res = await app.request(`/api/filesystem/browse?path=${encodeURIComponent(tmpDir)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const dir of body.directories) {
      expect(dir).toHaveProperty('name');
      expect(dir).toHaveProperty('path');
      expect(dir.path).toBe(path.join(tmpDir, dir.name));
    }
  });
});
