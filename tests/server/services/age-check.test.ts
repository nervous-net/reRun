// ABOUTME: Tests for age check utility used during rental checkout
// ABOUTME: Validates minor detection and rating restriction logic

import { describe, it, expect } from 'vitest';
import { isMinor, checkAgeRestriction } from '../../../server/services/age-check.js';

describe('isMinor', () => {
  it('returns true for someone under 18', () => {
    const today = new Date('2026-03-04');
    expect(isMinor('2010-06-15', today)).toBe(true);
  });

  it('returns false for someone 18 or older', () => {
    const today = new Date('2026-03-04');
    expect(isMinor('2008-03-04', today)).toBe(false);
  });

  it('returns false for someone turning 18 today', () => {
    const today = new Date('2026-03-04');
    expect(isMinor('2008-03-04', today)).toBe(false);
  });

  it('returns true for someone turning 18 tomorrow', () => {
    const today = new Date('2026-03-04');
    expect(isMinor('2008-03-05', today)).toBe(true);
  });

  it('returns null if no birthday provided', () => {
    expect(isMinor(null)).toBeNull();
    expect(isMinor(undefined)).toBeNull();
  });
});

describe('checkAgeRestriction', () => {
  it('returns warning for minor renting R-rated title', () => {
    const result = checkAgeRestriction('2012-01-01', 'R');
    expect(result).not.toBeNull();
    expect(result!.rating).toBe('R');
    expect(result!.requiresApproval).toBe(true);
  });

  it('returns warning for minor renting NC-17 title', () => {
    const result = checkAgeRestriction('2012-01-01', 'NC-17');
    expect(result).not.toBeNull();
    expect(result!.rating).toBe('NC-17');
  });

  it('returns null for adult renting R-rated title', () => {
    const result = checkAgeRestriction('1990-01-01', 'R');
    expect(result).toBeNull();
  });

  it('returns null for minor renting PG title', () => {
    const result = checkAgeRestriction('2012-01-01', 'PG');
    expect(result).toBeNull();
  });

  it('returns null when no birthday on file', () => {
    const result = checkAgeRestriction(null, 'R');
    expect(result).toBeNull();
  });

  it('returns null when no rating on title', () => {
    const result = checkAgeRestriction('2012-01-01', null);
    expect(result).toBeNull();
  });
});
