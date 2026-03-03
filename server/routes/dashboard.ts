// ABOUTME: Dashboard API routes for today's activity stats
// ABOUTME: Provides aggregated daily metrics for the dashboard panel

import { Hono } from 'hono';
import { getTodayStats } from '../services/dashboard.js';

export function createDashboardRoutes(db: any) {
  const routes = new Hono();

  // GET /stats — get today's activity aggregations
  routes.get('/stats', async (c) => {
    const stats = await getTodayStats(db);
    return c.json(stats);
  });

  return routes;
}
