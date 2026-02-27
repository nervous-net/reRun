// ABOUTME: Hono application definition with all route mounts
// ABOUTME: Serves API routes under /api and static frontend in production

import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { db } from './db/index.js';
import { createTitlesRoutes } from './routes/titles.js';
import { createCopiesRoutes } from './routes/copies.js';
import { createCustomersRoutes } from './routes/customers.js';
import { createProductsRoutes } from './routes/products.js';
import { createPricingRoutes } from './routes/pricing.js';
import { createSearchRoutes } from './routes/search.js';
import { createTransactionsRoutes } from './routes/transactions.js';
import { createRentalsRoutes } from './routes/rentals.js';
import { createReservationsRoutes } from './routes/reservations.js';
import { createImportRoutes } from './routes/import.js';
import { TmdbClient } from './services/tmdb.js';
import { createPromotionsRoutes } from './routes/promotions.js';
import { createAlertsRoutes } from './routes/alerts.js';
import { createSettingsRoutes } from './routes/settings.js';
import { createBackupRoutes } from './routes/backup.js';
import { createTmdbRoutes } from './routes/tmdb.js';
import { DB_PATH } from './db/index.js';
import path from 'path';

const app = new Hono();

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', name: 'reRun', version: '0.1.0' }));

// API routes
app.route('/api/titles', createTitlesRoutes(db));
app.route('/api/copies', createCopiesRoutes(db));
app.route('/api/customers', createCustomersRoutes(db));
app.route('/api/products', createProductsRoutes(db));
app.route('/api/pricing', createPricingRoutes(db));
app.route('/api/search', createSearchRoutes(db));
app.route('/api/transactions', createTransactionsRoutes(db));
app.route('/api/rentals', createRentalsRoutes(db));
app.route('/api/reservations', createReservationsRoutes(db));
const tmdbApiKey = process.env.TMDB_API_KEY;
const tmdb = tmdbApiKey && tmdbApiKey !== 'your_tmdb_api_key_here'
  ? new TmdbClient(tmdbApiKey) : undefined;
app.route('/api/import', createImportRoutes(db, tmdb));
app.route('/api/tmdb', createTmdbRoutes(tmdb));
app.route('/api/promotions', createPromotionsRoutes(db));
app.route('/api/alerts', createAlertsRoutes(db));
app.route('/api/settings', createSettingsRoutes(db));
app.route('/api/backup', createBackupRoutes(db, {
  dbPath: DB_PATH,
  backupDir: path.join(path.dirname(DB_PATH), 'backups'),
}));

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/client' }));
}

export { app };
