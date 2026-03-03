// ABOUTME: Dashboard stats service for today's activity aggregations
// ABOUTME: Queries rental count, return count, revenue, and collected late fees for the current day

import { sql, eq, and, gte } from 'drizzle-orm';
import { transactions, rentals } from '../db/schema.js';

export interface TodayStats {
  rentalsToday: number;
  returnsToday: number;
  revenueCents: number;
  lateFeesCollectedCents: number;
}

export async function getTodayStats(db: any): Promise<TodayStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Count rental transactions today (non-voided)
  const [rentalCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'rental'),
        eq(transactions.voided, 0),
        gte(transactions.createdAt, todayIso)
      )
    );

  // Count returns today
  const [returnCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(rentals)
    .where(
      and(
        eq(rentals.status, 'returned'),
        gte(rentals.returnedAt, todayIso)
      )
    );

  // Sum revenue today (non-voided)
  const [revenue] = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.total}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.voided, 0),
        gte(transactions.createdAt, todayIso)
      )
    );

  // Sum late fees collected today (paid status, returned today)
  const [lateFees] = await db
    .select({ total: sql<number>`coalesce(sum(${rentals.lateFee}), 0)` })
    .from(rentals)
    .where(
      and(
        eq(rentals.lateFeeStatus, 'paid'),
        gte(rentals.returnedAt, todayIso)
      )
    );

  return {
    rentalsToday: rentalCount.count,
    returnsToday: returnCount.count,
    revenueCents: revenue.total,
    lateFeesCollectedCents: lateFees.total,
  };
}
