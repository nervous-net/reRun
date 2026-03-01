// ABOUTME: TMDb API proxy routes for searching movies/TV and fetching details
// ABOUTME: Used by TitleForm and import flow for looking up title metadata

import { Hono } from 'hono';
import type { TmdbClient } from '../services/tmdb.js';

export function createTmdbRoutes(tmdb?: TmdbClient) {
  const routes = new Hono();

  // GET /search?q=term&year=2024 — search TMDb for movies and TV shows
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
      const results = await tmdb.searchMulti(q.trim(), year);
      return c.json({ data: results.slice(0, 10) });
    } catch {
      return c.json({ data: [], error: 'TMDb search failed' });
    }
  });

  // GET /details/:tmdbId?type=tv — get full movie or TV details
  routes.get('/details/:tmdbId', async (c) => {
    if (!tmdb) {
      return c.json({ error: 'TMDb not configured' }, 503);
    }

    const tmdbId = parseInt(c.req.param('tmdbId'), 10);
    if (isNaN(tmdbId)) {
      return c.json({ error: 'Invalid TMDb ID' }, 400);
    }

    const mediaType = (c.req.query('type') === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';

    try {
      const details = await tmdb.getDetails(tmdbId, mediaType);
      return c.json(details);
    } catch {
      return c.json({ error: 'Failed to fetch details' }, 500);
    }
  });

  return routes;
}
