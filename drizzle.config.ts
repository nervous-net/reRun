// ABOUTME: Drizzle Kit configuration for SQLite migrations
// ABOUTME: Points to schema definition and local SQLite database file

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './data/rerun.db',
  },
});
