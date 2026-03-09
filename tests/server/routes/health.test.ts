// ABOUTME: Smoke test for the health check endpoint
// ABOUTME: Verifies the server starts and responds correctly

import { describe, it, expect } from 'vitest';
import { app } from '../../../server/app.js';
import pkg from '../../../package.json';

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', name: 'reRun', version: pkg.version });
  });
});
