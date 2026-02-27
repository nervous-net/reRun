// ABOUTME: Tests for the TMDb API client service
// ABOUTME: Validates search, detail fetching, and response parsing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TmdbClient } from '../../../server/services/tmdb.js';

const mockSearchResponse = {
  results: [
    {
      id: 603,
      title: 'The Matrix',
      release_date: '1999-03-30',
      overview: 'A computer hacker learns...',
      poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
      genre_ids: [28, 878],
      vote_average: 8.2,
    },
    {
      id: 604,
      title: 'The Matrix Reloaded',
      release_date: '2003-05-15',
      overview: 'Six months after the events...',
      poster_path: '/aA5qHS0FbSXO8PxEIwODY0MU0p0.jpg',
      genre_ids: [28, 878],
      vote_average: 6.7,
    },
  ],
  total_results: 2,
};

const mockDetailResponse = {
  id: 603,
  title: 'The Matrix',
  release_date: '1999-03-30',
  overview: 'A computer hacker learns about the true nature of reality.',
  poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  runtime: 136,
  genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
  vote_average: 8.2,
  credits: {
    cast: [
      { name: 'Keanu Reeves', character: 'Neo', order: 0 },
      { name: 'Laurence Fishburne', character: 'Morpheus', order: 1 },
      { name: 'Carrie-Anne Moss', character: 'Trinity', order: 2 },
    ],
  },
  release_dates: {
    results: [
      {
        iso_3166_1: 'US',
        release_dates: [{ certification: 'R', type: 3 }],
      },
    ],
  },
};

describe('TmdbClient', () => {
  let client: TmdbClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new TmdbClient('test-api-key', mockFetch);
  });

  describe('searchMovie', () => {
    it('searches by title and returns parsed results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      const results = await client.searchMovie('The Matrix');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search/movie?query=The+Matrix'),
        expect.any(Object)
      );
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('The Matrix');
      expect(results[0].tmdbId).toBe(603);
      expect(results[0].year).toBe(1999);
      expect(results[0].posterUrl).toContain('f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg');
    });

    it('searches by title and year', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      await client.searchMovie('The Matrix', 1999);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('year=1999'),
        expect.any(Object)
      );
    });

    it('returns empty array on no results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [], total_results: 0 }),
      });

      const results = await client.searchMovie('aslkdjflaskdjf');
      expect(results).toHaveLength(0);
    });
  });

  describe('getMovieDetails', () => {
    it('fetches full details with credits and rating', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailResponse,
      });

      const details = await client.getMovieDetails(603);

      expect(details.title).toBe('The Matrix');
      expect(details.runtimeMinutes).toBe(136);
      expect(details.genre).toBe('Action, Science Fiction');
      expect(details.cast).toContain('Keanu Reeves');
      expect(details.rating).toBe('R');
      expect(details.coverUrl).toContain('w500');
    });
  });

  describe('error handling', () => {
    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.searchMovie('test')).rejects.toThrow('TMDb API error: 401');
    });
  });
});
