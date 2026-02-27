// ABOUTME: CSV parsing and column auto-detection for bulk title import
// ABOUTME: Handles various CSV formats and maps columns to reRun's data model

import { parse } from 'csv-parse/sync';

export interface ColumnMapping {
  title: string | null;
  year: string | null;
  format: string | null;
  quantity: string | null;
  genre: string | null;
  barcode: string | null;
  director: string | null;
  cast: string | null;
  rating: string | null;
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseCsv(csvContent: string): Promise<ParsedCsv> {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  });

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { headers, rows: records };
}

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  title: ['title', 'movie', 'movie name', 'film', 'name', 'movie title', 'film name'],
  year: ['year', 'release year', 'release_year', 'yr', 'release date', 'date'],
  format: ['format', 'media', 'media type', 'type', 'medium', 'vhs/dvd/bluray', 'vhs/dvd/blu-ray', 'media format'],
  quantity: ['quantity', 'qty', 'copies', 'count', 'num copies', 'number'],
  genre: ['genre', 'category', 'genres', 'categories'],
  barcode: ['barcode', 'upc', 'sku', 'code', 'bar code', 'isbn'],
  director: ['director', 'directed by', 'dir', 'director(s)', 'directors'],
  cast: ['cast', 'actors', 'starring', 'stars', 'principal actors', 'cast members'],
  rating: ['rating', 'mpaa', 'mpaa rating', 'certification', 'rated'],
};

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    title: null,
    year: null,
    format: null,
    quantity: null,
    genre: null,
    barcode: null,
    director: null,
    cast: null,
    rating: null,
  };

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(normalized) && mapping[field as keyof ColumnMapping] === null) {
        mapping[field as keyof ColumnMapping] = header;
        break;
      }
    }
  }

  return mapping;
}
