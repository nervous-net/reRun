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
import { createPromotionsRoutes } from './routes/promotions.js';
import { createAlertsRoutes } from './routes/alerts.js';
import { createDashboardRoutes } from './routes/dashboard.js';
import { createSettingsRoutes } from './routes/settings.js';
import { createBackupRoutes } from './routes/backup.js';
import { createTmdbRoutes } from './routes/tmdb.js';
import { createUpdateRoutes } from './routes/update.js';
import { startUpdateChecker } from './services/update.js';
import { createAutoBackupMiddleware } from './middleware/auto-backup.js';
import { DB_PATH } from './db/index.js';
import path from 'path';
import fs from 'fs';

const app = new Hono();

// Global error handler: return structured JSON instead of bare 500s
app.onError((err, c) => {
  console.error(`[${c.req.method}] ${c.req.path} — ${err.message}`);
  return c.json({ error: err.message }, 500);
});

// Read version from package.json (resolve from CWD, works in both dev and production)
const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', name: 'reRun', version: pkg.version }));

// Auto daily backup middleware
const backupDir = path.join(path.dirname(DB_PATH), 'backups');
app.use('/api/*', createAutoBackupMiddleware(db, DB_PATH, backupDir));

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
app.route('/api/import', createImportRoutes(db));
app.route('/api/tmdb', createTmdbRoutes(db));
app.route('/api/promotions', createPromotionsRoutes(db));
app.route('/api/alerts', createAlertsRoutes(db));
app.route('/api/dashboard', createDashboardRoutes(db));
app.route('/api/settings', createSettingsRoutes(db));
app.route('/api/backup', createBackupRoutes(db, {
  dbPath: DB_PATH,
  backupDir,
}));
app.route('/api/update', createUpdateRoutes(DB_PATH, backupDir));

// Start update checker
startUpdateChecker(pkg.version);

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/client' }));
  // SPA fallback for client-side routing
  app.get('*', (c) => {
    const html = fs.readFileSync('./dist/client/index.html', 'utf-8');
    return c.html(html);
  });
}

export { app };
