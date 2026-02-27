// ABOUTME: Entry point for the reRun server process
// ABOUTME: Starts Hono on port 1987, serves API and static frontend

import 'dotenv/config';
import { serve } from '@hono/node-server';
import { app } from './app.js';

const port = parseInt(process.env.PORT || '1987', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`reRun is running on http://localhost:${port}`);
});
