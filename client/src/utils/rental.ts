// ABOUTME: Rental utility functions shared across client components
// ABOUTME: Provides overdue calculation and rental-related formatting helpers

/**
 * Calculate how many days overdue a rental is based on its due date.
 * Uses Math.ceil to match server-side calculation — any partial day counts as a full day.
 */
export function calculateOverdue(dueAt: string): { daysOverdue: number } {
  const now = new Date();
  const due = new Date(dueAt);
  if (now <= due) return { daysOverdue: 0 };
  const ms = now.getTime() - due.getTime();
  return { daysOverdue: Math.ceil(ms / (1000 * 60 * 60 * 24)) };
}
