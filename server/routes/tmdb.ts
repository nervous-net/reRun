// ABOUTME: TMDb API proxy routes for searching movies and fetching details
// ABOUTME: Used by TitleForm for looking up movie metadata before adding to inventory

import { Hono } from 'hono';
import type { TmdbClient } from '../services/tmdb.js';

export function createTmdbRoutes(tmdb?: TmdbClient) {
  const routes = new Hono();

  // GET /search?q=term&year=2024 — search TMDb for movies
  routes.get('/search', async (c) => {
    if (!tmdb) {
      return c.json({ data: [], error: 'TMDb not configured' });
    }

    const q = c.req.query('q') ?? '';
    if (!q.trim()) {
      return c.json({ data: [] });
    }

    const yearParam = c.req.query('year');
    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    try {
      const results = await tmdb.searchMovie(q.trim(), year);
      return c.json({ data: results.slice(0, 10) });
    } catch {
      return c.json({ data: [], error: 'TMDb search failed' });
    }
  });

  // GET /details/:tmdbId — get full movie details
  routes.get('/details/:tmdbId', async (c) => {
    if (!tmdb) {
      return c.json({ error: 'TMDb not configured' }, 503);
    }

    const tmdbId = parseInt(c.req.param('tmdbId'), 10);
    if (isNaN(tmdbId)) {
      return c.json({ error: 'Invalid TMDb ID' }, 400);
    }

    try {
      const details = await tmdb.getMovieDetails(tmdbId);
      return c.json(details);
    } catch {
      return c.json({ error: 'Failed to fetch movie details' }, 500);
    }
  });

  return routes;
}
