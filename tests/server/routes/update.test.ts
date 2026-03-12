// ABOUTME: Tests for update status and install API endpoints
// ABOUTME: Validates update status response shape and install trigger behavior

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../../../server/services/update.js', () => {
  let status = {
    currentVersion: '0.1.0',
    availableUpdate: null as any,
    lastChecked: '2026-03-05T10:00:00.000Z',
    updating: false,
    lastError: null as string | null,
  };
  return {
    getUpdateStatus: vi.fn(() => ({ ...status })),
    setUpdating: vi.fn((val: boolean) => { status.updating = val; }),
    forceCheck: vi.fn(async () => {
      status.lastChecked = new Date().toISOString();
      return { ...status };
    }),
    __setMockStatus: (s: any) => { status = s; },
  };
});

import { createUpdateRoutes } from '../../../server/routes/update.js';
import { __setMockStatus } from '../../../server/services/update.js';

// Type assertion for the test helper
const setMockStatus = __setMockStatus as (s: any) => void;

describe('Update routes', () => {
  let app: Hono;

  beforeEach(() => {
    setMockStatus({
      currentVersion: '0.1.0',
      availableUpdate: null,
      lastChecked: '2026-03-05T10:00:00.000Z',
      updating: false,
      lastError: null,
    });
    app = new Hono();
    app.route('/api/update', createUpdateRoutes({} as any, '/tmp/test.db', '/tmp/backups'));
  });

  it('GET /api/update/status returns update status', async () => {
    const res = await app.request('/api/update/status');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('currentVersion');
    expect(body).toHaveProperty('availableUpdate');
    expect(body).toHaveProperty('lastChecked');
    expect(body).toHaveProperty('updating');
  });

  it('POST /api/update/install returns 400 when no update available', async () => {
    const res = await app.request('/api/update/install', { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('No update available');
  });

  it('POST /api/update/check triggers force check and returns status', async () => {
    const res = await app.request('/api/update/check', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('currentVersion');
    expect(body).toHaveProperty('lastChecked');
  });

  it('POST /api/update/install returns 400 when already updating', async () => {
    setMockStatus({
      currentVersion: '0.1.0',
      availableUpdate: { version: '0.2.0', downloadUrl: 'https://example.com/v0.2.0.zip', tagName: 'v0.2.0' },
      lastChecked: '2026-03-05T10:00:00.000Z',
      updating: true,
      lastError: null,
    });
    const res = await app.request('/api/update/install', { method: 'POST' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Update already in progress');
  });

  it('GET /api/update/status includes lastError field', async () => {
    setMockStatus({
      currentVersion: '0.1.0',
      availableUpdate: null,
      lastChecked: '2026-03-05T10:00:00.000Z',
      updating: false,
      lastError: 'UPDATE FAILED: Download failed: 404',
    });
    const res = await app.request('/api/update/status');
    const body = await res.json();
    expect(body.lastError).toBe('UPDATE FAILED: Download failed: 404');
  });
});
