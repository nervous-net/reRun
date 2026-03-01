// ABOUTME: Tests for the fuzzy matching utility used during CSV import TMDb enrichment
// ABOUTME: Validates title similarity scoring, composite match scoring, and query variation generation

import { describe, it, expect } from 'vitest';
import { titleSimilarity, scoreTmdbMatch, queryVariations } from '../../../server/services/fuzzy-match.js';

describe('titleSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(titleSimilarity('The Matrix', 'The Matrix')).toBe(1.0);
  });

  it('is case insensitive', () => {
    expect(titleSimilarity('the matrix', 'THE MATRIX')).toBe(1.0);
  });

  it('strips leading "the"', () => {
    expect(titleSimilarity('The Godfather', 'Godfather')).toBe(1.0);
  });

  it('strips punctuation', () => {
    expect(titleSimilarity("Schindler's List", 'Schindlers List')).toBe(1.0);
  });

  it('collapses whitespace', () => {
    expect(titleSimilarity('Star  Wars', 'Star Wars')).toBe(1.0);
  });

  it('returns 0.0 for completely different strings', () => {
    expect(titleSimilarity('The Matrix', 'Frozen')).toBeLessThan(0.3);
  });

  it('returns high similarity for minor typos', () => {
    const score = titleSimilarity('The Matrx', 'The Matrix');
    expect(score).toBeGreaterThan(0.8);
  });

  it('handles empty strings', () => {
    expect(titleSimilarity('', '')).toBe(1.0);
    expect(titleSimilarity('Test', '')).toBe(0);
  });
});

describe('scoreTmdbMatch', () => {
  it('returns 1.0 for exact title and year match', () => {
    const score = scoreTmdbMatch('The Matrix', 'The Matrix', 1999, 1999);
    expect(score).toBe(1.0);
  });

  it('weights title similarity at 70%', () => {
    // Identical title, no year info
    const score = scoreTmdbMatch('The Matrix', 'The Matrix');
    expect(score).toBeCloseTo(0.7, 1);
  });

  it('gives 0.5 year score for ±1 year difference', () => {
    const score = scoreTmdbMatch('The Matrix', 'The Matrix', 1999, 2000);
    // 0.7 * 1.0 (title) + 0.3 * 0.5 (year) = 0.85
    expect(score).toBeCloseTo(0.85, 2);
  });

  it('gives 0 year score for >1 year difference', () => {
    const score = scoreTmdbMatch('The Matrix', 'The Matrix', 1999, 2003);
    // 0.7 * 1.0 (title) + 0.3 * 0.0 (year) = 0.7
    expect(score).toBeCloseTo(0.7, 2);
  });

  it('handles missing input year', () => {
    const score = scoreTmdbMatch('The Matrix', 'The Matrix', undefined, 1999);
    // No year comparison, just title: 0.7 * 1.0 = 0.7
    expect(score).toBeCloseTo(0.7, 1);
  });

  it('handles missing result year', () => {
    const score = scoreTmdbMatch('The Matrix', 'The Matrix', 1999, undefined);
    expect(score).toBeCloseTo(0.7, 1);
  });

  it('returns low score for bad title match even with year match', () => {
    const score = scoreTmdbMatch('Frozen', 'The Matrix', 1999, 1999);
    expect(score).toBeLessThan(0.5);
  });
});

describe('queryVariations', () => {
  it('returns original title first', () => {
    const variations = queryVariations('The Matrix');
    expect(variations[0]).toBe('The Matrix');
  });

  it('strips subtitle after colon', () => {
    const variations = queryVariations('Alien: Resurrection');
    expect(variations).toContain('Alien');
  });

  it('drops leading "The"', () => {
    const variations = queryVariations('The Shawshank Redemption');
    expect(variations).toContain('Shawshank Redemption');
  });

  it('strips trailing parenthetical year', () => {
    const variations = queryVariations('Blade Runner (1982)');
    expect(variations).toContain('Blade Runner');
  });

  it('returns deduplicated variations', () => {
    const variations = queryVariations('Simple');
    const unique = new Set(variations);
    expect(unique.size).toBe(variations.length);
  });

  it('handles title with all variation triggers', () => {
    const variations = queryVariations('The Matrix: Reloaded (2003)');
    expect(variations).toContain('The Matrix: Reloaded (2003)');
    expect(variations).toContain('The Matrix');
    expect(variations).toContain('Matrix: Reloaded (2003)');
  });
});
