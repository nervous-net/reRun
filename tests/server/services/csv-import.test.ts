// ABOUTME: Tests for CSV parsing and column auto-detection
// ABOUTME: Validates handling of various CSV formats and edge cases

import { describe, it, expect } from 'vitest';
import { parseCsv, detectColumns, type ColumnMapping } from '../../../server/services/csv-import.js';

const CSV_WITH_HEADERS = `Title,Year,Format,Quantity,Genre
The Matrix,1999,DVD,3,Action
Aliens,1986,VHS,2,Sci-Fi
The Shining,1980,Blu-ray,1,Horror`;

const CSV_DIFFERENT_HEADERS = `Movie Name,Release Year,Media Type,Copies,Category,Barcode
The Matrix,1999,DVD,3,Action,DVD-MTX-001
Aliens,1986,VHS,2,Sci-Fi,VHS-ALN-001`;

const CSV_MINIMAL = `title
The Matrix
Aliens
The Shining`;

const CSV_WITH_QUOTES = `"Title","Year","Format"
"The Good, the Bad and the Ugly",1966,"DVD"
"Alien",1979,"VHS"`;

// This matches the REAL inventory CSV format
const CSV_REAL_INVENTORY = `Title,VHS/DVD/Bluray,Principal Actors,Director(s),Rating
Cool Runnings,VHS ,"Leon Robinson, Doug E. Doug, John Candy",Jon Turteltaub,PG
Aladdin,VHS,"Robin Williams, Scott Weinger, Gilbert Gottfried","John Clements, John Musker",G`;

describe('parseCsv', () => {
  it('parses standard CSV with headers', async () => {
    const result = await parseCsv(CSV_WITH_HEADERS);
    expect(result.headers).toEqual(['Title', 'Year', 'Format', 'Quantity', 'Genre']);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({
      Title: 'The Matrix', Year: '1999', Format: 'DVD', Quantity: '3', Genre: 'Action',
    });
  });

  it('handles quoted fields with commas', async () => {
    const result = await parseCsv(CSV_WITH_QUOTES);
    expect(result.rows[0].Title).toBe('The Good, the Bad and the Ugly');
  });

  it('handles minimal CSV with just titles', async () => {
    const result = await parseCsv(CSV_MINIMAL);
    expect(result.headers).toEqual(['title']);
    expect(result.rows).toHaveLength(3);
  });

  it('parses real inventory CSV format', async () => {
    const result = await parseCsv(CSV_REAL_INVENTORY);
    expect(result.headers).toEqual(['Title', 'VHS/DVD/Bluray', 'Principal Actors', 'Director(s)', 'Rating']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].Title).toBe('Cool Runnings');
    expect(result.rows[0]['VHS/DVD/Bluray']).toBe('VHS');
    expect(result.rows[0]['Principal Actors']).toBe('Leon Robinson, Doug E. Doug, John Candy');
  });
});

describe('detectColumns', () => {
  it('auto-detects standard column names', () => {
    const headers = ['Title', 'Year', 'Format', 'Quantity', 'Genre'];
    const mapping = detectColumns(headers);
    expect(mapping.title).toBe('Title');
    expect(mapping.year).toBe('Year');
    expect(mapping.format).toBe('Format');
    expect(mapping.quantity).toBe('Quantity');
    expect(mapping.genre).toBe('Genre');
  });

  it('detects alternate column names', () => {
    const headers = ['Movie Name', 'Release Year', 'Media Type', 'Copies', 'Category', 'Barcode'];
    const mapping = detectColumns(headers);
    expect(mapping.title).toBe('Movie Name');
    expect(mapping.year).toBe('Release Year');
    expect(mapping.format).toBe('Media Type');
    expect(mapping.quantity).toBe('Copies');
    expect(mapping.genre).toBe('Category');
    expect(mapping.barcode).toBe('Barcode');
  });

  it('detects real inventory column names', () => {
    const headers = ['Title', 'VHS/DVD/Bluray', 'Principal Actors', 'Director(s)', 'Rating'];
    const mapping = detectColumns(headers);
    expect(mapping.title).toBe('Title');
    expect(mapping.format).toBe('VHS/DVD/Bluray');
    expect(mapping.cast).toBe('Principal Actors');
    expect(mapping.director).toBe('Director(s)');
    expect(mapping.rating).toBe('Rating');
  });

  it('handles case insensitivity', () => {
    const headers = ['TITLE', 'YEAR', 'FORMAT'];
    const mapping = detectColumns(headers);
    expect(mapping.title).toBe('TITLE');
    expect(mapping.year).toBe('YEAR');
  });

  it('returns null for undetectable columns', () => {
    const headers = ['title'];
    const mapping = detectColumns(headers);
    expect(mapping.title).toBe('title');
    expect(mapping.year).toBeNull();
    expect(mapping.format).toBeNull();
  });
});
