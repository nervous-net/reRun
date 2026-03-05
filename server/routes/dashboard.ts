// ABOUTME: Dashboard API routes for today's activity stats and recent transactions
// ABOUTME: Provides aggregated daily metrics and transaction history for the dashboard panel

import { Hono } from 'hono';
import { getTodayStats, getRecentTransactions } from '../services/dashboard.js';

export function createDashboardRoutes(db: any) {
  const routes = new Hono();

  // GET /stats — get today's activity aggregations
  routes.get('/stats', async (c) => {
    const stats = await getTodayStats(db);
    return c.json(stats);
  });

  // GET /recent — get recent transactions with reference codes
  routes.get('/recent', async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '10', 10);
    const recent = await getRecentTransactions(db, Math.min(limit, 50));
    return c.json({ data: recent });
  });

  return routes;
}
