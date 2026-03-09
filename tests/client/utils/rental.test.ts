// ABOUTME: Tests for client-side rental utility functions
// ABOUTME: Verifies overdue calculation matches server-side Math.ceil behavior

import { describe, it, expect, vi, afterEach } from 'vitest';
import { calculateOverdue } from '../../../client/src/utils/rental.js';

describe('calculateOverdue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 days when rental is not yet due', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(calculateOverdue(tomorrow).daysOverdue).toBe(0);
  });

  it('returns 1 day when rental is a few hours overdue (partial day)', () => {
    // This is the critical bug case: rental due 3 hours ago
    // Server uses Math.ceil (1 day), client was using Math.floor (0 days)
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(calculateOverdue(threeHoursAgo).daysOverdue).toBe(1);
  });

  it('returns 1 day when rental is 23 hours overdue', () => {
    const twentyThreeHoursAgo = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    expect(calculateOverdue(twentyThreeHoursAgo).daysOverdue).toBe(1);
  });

  it('returns exact day count when overdue by whole days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-09T12:00:00Z'));

    const fiveDaysAgo = new Date('2026-03-04T12:00:00Z').toISOString();
    expect(calculateOverdue(fiveDaysAgo).daysOverdue).toBe(5);

    vi.useRealTimers();
  });

  it('returns 0 when returned exactly at due time', () => {
    // Due right now — not overdue
    const rightNow = new Date(Date.now() + 100).toISOString(); // tiny future buffer
    expect(calculateOverdue(rightNow).daysOverdue).toBe(0);
  });
});
