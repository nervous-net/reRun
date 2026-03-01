// ABOUTME: TMDb API client for searching and fetching movie metadata
// ABOUTME: Used during CSV import to enrich titles with cover art, cast, genre, etc.

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

export interface TmdbSearchResult {
  tmdbId: number;
  title: string;
  year: number | null;
  overview: string;
  posterUrl: string | null;
  voteAverage: number;
  mediaType: 'movie' | 'tv';
}

export interface TmdbMovieDetails {
  tmdbId: number;
  title: string;
  year: number | null;
  synopsis: string;
  coverUrl: string | null;
  runtimeMinutes: number | null;
  genre: string;
  cast: string;
  rating: string | null;
  voteAverage: number;
  mediaType: 'movie' | 'tv';
  numberOfSeasons: number | null;
}

type FetchFn = typeof globalThis.fetch;

export class TmdbClient {
  private apiKey: string;
  private fetchFn: FetchFn;

  constructor(apiKey: string, fetchFn?: FetchFn) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn || globalThis.fetch;
  }

  async searchMovie(query: string, year?: number): Promise<TmdbSearchResult[]> {
    const params = new URLSearchParams({
      query,
      api_key: this.apiKey,
    });
    if (year) params.set('year', String(year));

    const response = await this.fetchFn(
      `${TMDB_BASE_URL}/search/movie?${params}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.results || []).map((r: any) => ({
      tmdbId: r.id,
      title: r.title,
      year: r.release_date ? parseInt(r.release_date.substring(0, 4), 10) : null,
      overview: r.overview,
      posterUrl: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
      voteAverage: r.vote_average,
      mediaType: 'movie' as const,
    }));
  }

  async getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      append_to_response: 'credits,release_dates',
    });

    const response = await this.fetchFn(
      `${TMDB_BASE_URL}/movie/${tmdbId}?${params}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract US rating from release_dates
    let rating: string | null = null;
    const usRelease = data.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
    if (usRelease) {
      const theatrical = usRelease.release_dates?.find((rd: any) => rd.certification);
      if (theatrical) rating = theatrical.certification;
    }

    // Top 5 cast members
    const castNames = (data.credits?.cast || [])
      .slice(0, 5)
      .map((c: any) => c.name)
      .join(', ');

    // Genre names
    const genres = (data.genres || []).map((g: any) => g.name).join(', ');

    return {
      tmdbId: data.id,
      title: data.title,
      year: data.release_date ? parseInt(data.release_date.substring(0, 4), 10) : null,
      synopsis: data.overview,
      coverUrl: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : null,
      runtimeMinutes: data.runtime || null,
      genre: genres,
      cast: castNames,
      rating,
      voteAverage: data.vote_average,
      mediaType: 'movie' as const,
      numberOfSeasons: null,
    };
  }

  async searchMulti(query: string, year?: number): Promise<TmdbSearchResult[]> {
    const params = new URLSearchParams({
      query,
      api_key: this.apiKey,
    });
    if (year) params.set('year', String(year));

    const response = await this.fetchFn(
      `${TMDB_BASE_URL}/search/multi?${params}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.results || [])
      .filter((r: any) => r.media_type !== 'person')
      .map((r: any) => {
        const isTV = r.media_type === 'tv';
        const dateStr = isTV ? r.first_air_date : r.release_date;
        return {
          tmdbId: r.id,
          title: isTV ? r.name : r.title,
          year: dateStr ? parseInt(dateStr.substring(0, 4), 10) : null,
          overview: r.overview,
          posterUrl: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
          voteAverage: r.vote_average,
          mediaType: isTV ? 'tv' as const : 'movie' as const,
        };
      });
  }

  async getTvDetails(tmdbId: number): Promise<TmdbMovieDetails> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      append_to_response: 'credits,content_ratings',
    });

    const response = await this.fetchFn(
      `${TMDB_BASE_URL}/tv/${tmdbId}?${params}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract US content rating
    let rating: string | null = null;
    const usRating = data.content_ratings?.results?.find((r: any) => r.iso_3166_1 === 'US');
    if (usRating) rating = usRating.rating;

    // Top 5 cast members
    const castNames = (data.credits?.cast || [])
      .slice(0, 5)
      .map((c: any) => c.name)
      .join(', ');

    // Genre names
    const genres = (data.genres || []).map((g: any) => g.name).join(', ');

    // Episode runtime (first value from array)
    const runtime = data.episode_run_time?.[0] || null;

    return {
      tmdbId: data.id,
      title: data.name,
      year: data.first_air_date ? parseInt(data.first_air_date.substring(0, 4), 10) : null,
      synopsis: data.overview,
      coverUrl: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : null,
      runtimeMinutes: runtime,
      genre: genres,
      cast: castNames,
      rating,
      voteAverage: data.vote_average,
      mediaType: 'tv' as const,
      numberOfSeasons: data.number_of_seasons ?? null,
    };
  }

  async getDetails(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<TmdbMovieDetails> {
    if (mediaType === 'tv') {
      return this.getTvDetails(tmdbId);
    }
    return this.getMovieDetails(tmdbId);
  }
}
