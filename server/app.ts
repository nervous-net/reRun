// ABOUTME: Hono application definition with all route mounts
// ABOUTME: Serves API routes under /api and static frontend in production

import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', name: 'reRun', version: '0.1.0' }));

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/client' }));
}

export { app };
