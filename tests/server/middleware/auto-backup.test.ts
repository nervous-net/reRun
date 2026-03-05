// ABOUTME: Tests for automatic daily backup middleware
// ABOUTME: Verifies backup creation triggers once per day on first request

import { describe, it, expect } from 'vitest';
import { shouldRunDailyBackup } from '../../../server/middleware/auto-backup.js';

describe('shouldRunDailyBackup', () => {
  it('returns true when no backup exists for today', () => {
    const lastBackup = '2026-03-04T10:00:00.000Z';
    const now = new Date('2026-03-05T08:00:00.000Z');
    expect(shouldRunDailyBackup(lastBackup, now)).toBe(true);
  });

  it('returns false when backup already exists for today', () => {
    const lastBackup = '2026-03-05T06:00:00.000Z';
    const now = new Date('2026-03-05T08:00:00.000Z');
    expect(shouldRunDailyBackup(lastBackup, now)).toBe(false);
  });

  it('returns true when no backup has ever been made', () => {
    expect(shouldRunDailyBackup(null, new Date())).toBe(true);
  });
});
