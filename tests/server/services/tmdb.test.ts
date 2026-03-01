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

  describe('searchMovie (mediaType)', () => {
    it('includes mediaType: movie in results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      const results = await client.searchMovie('The Matrix');
      expect(results[0].mediaType).toBe('movie');
    });
  });

  describe('getMovieDetails (mediaType)', () => {
    it('includes mediaType: movie in details', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailResponse,
      });

      const details = await client.getMovieDetails(603);
      expect(details.mediaType).toBe('movie');
      expect(details.numberOfSeasons).toBeNull();
    });
  });

  describe('searchMulti', () => {
    const mockMultiResponse = {
      results: [
        {
          id: 603,
          media_type: 'movie',
          title: 'The Matrix',
          release_date: '1999-03-30',
          overview: 'A hacker discovers reality is simulated.',
          poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
          vote_average: 8.2,
        },
        {
          id: 1399,
          media_type: 'tv',
          name: 'Breaking Bad',
          first_air_date: '2008-01-20',
          overview: 'A chemistry teacher becomes a drug lord.',
          poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
          vote_average: 8.9,
        },
        {
          id: 99999,
          media_type: 'person',
          name: 'John Matrix',
        },
      ],
    };

    it('calls /search/multi and filters out person results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMultiResponse,
      });

      const results = await client.searchMulti('matrix');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search/multi'),
        expect.any(Object)
      );
      expect(results).toHaveLength(2);
      expect(results.find((r: any) => r.mediaType === 'person')).toBeUndefined();
    });

    it('maps TV fields (name→title, first_air_date→year)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMultiResponse,
      });

      const results = await client.searchMulti('breaking bad');
      const tvResult = results.find((r: any) => r.mediaType === 'tv');

      expect(tvResult).toBeDefined();
      expect(tvResult!.title).toBe('Breaking Bad');
      expect(tvResult!.year).toBe(2008);
      expect(tvResult!.mediaType).toBe('tv');
    });

    it('sets mediaType on movie results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockMultiResponse,
      });

      const results = await client.searchMulti('matrix');
      const movieResult = results.find((r: any) => r.mediaType === 'movie');

      expect(movieResult).toBeDefined();
      expect(movieResult!.mediaType).toBe('movie');
    });

    it('passes year parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      });

      await client.searchMulti('test', 2020);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('year=2020'),
        expect.any(Object)
      );
    });
  });

  describe('getTvDetails', () => {
    const mockTvDetailResponse = {
      id: 1399,
      name: 'Breaking Bad',
      first_air_date: '2008-01-20',
      overview: 'A chemistry teacher turns to cooking meth.',
      poster_path: '/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
      episode_run_time: [47],
      number_of_seasons: 5,
      genres: [{ id: 18, name: 'Drama' }, { id: 80, name: 'Crime' }],
      vote_average: 8.9,
      credits: {
        cast: [
          { name: 'Bryan Cranston', character: 'Walter White', order: 0 },
          { name: 'Aaron Paul', character: 'Jesse Pinkman', order: 1 },
        ],
      },
      content_ratings: {
        results: [
          { iso_3166_1: 'US', rating: 'TV-MA' },
        ],
      },
    };

    it('fetches TV details with credits and content rating', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTvDetailResponse,
      });

      const details = await client.getTvDetails(1399);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tv/1399'),
        expect.any(Object)
      );
      expect(details.title).toBe('Breaking Bad');
      expect(details.year).toBe(2008);
      expect(details.genre).toBe('Drama, Crime');
      expect(details.cast).toContain('Bryan Cranston');
      expect(details.rating).toBe('TV-MA');
      expect(details.mediaType).toBe('tv');
      expect(details.numberOfSeasons).toBe(5);
    });

    it('uses episode_run_time for runtimeMinutes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockTvDetailResponse,
      });

      const details = await client.getTvDetails(1399);
      expect(details.runtimeMinutes).toBe(47);
    });
  });

  describe('getDetails', () => {
    it('dispatches to getMovieDetails for movie type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailResponse,
      });

      const details = await client.getDetails(603, 'movie');
      expect(details.title).toBe('The Matrix');
      expect(details.mediaType).toBe('movie');
    });

    it('dispatches to getTvDetails for tv type', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 1399,
          name: 'Breaking Bad',
          first_air_date: '2008-01-20',
          overview: 'A chemistry teacher...',
          poster_path: '/poster.jpg',
          episode_run_time: [47],
          number_of_seasons: 5,
          genres: [{ id: 18, name: 'Drama' }],
          vote_average: 8.9,
          credits: { cast: [] },
          content_ratings: { results: [] },
        }),
      });

      const details = await client.getDetails(1399, 'tv');
      expect(details.title).toBe('Breaking Bad');
      expect(details.mediaType).toBe('tv');
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
