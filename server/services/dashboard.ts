// ABOUTME: Dashboard stats service for today's activity aggregations and recent transaction history
// ABOUTME: Queries rental count, return count, revenue, late fees, and recent transactions with reference codes

import { sql, eq, and, gte, desc } from 'drizzle-orm';
import { transactions, rentals, customers } from '../db/schema.js';

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

// ─── Recent Transactions ──────────────────────────────────────────

export interface RecentTransaction {
  id: string;
  referenceCode: string | null;
  type: string;
  total: number;
  voided: number;
  customerName: string;
  createdAt: string;
}

export async function getRecentTransactions(db: any, limit = 10): Promise<RecentTransaction[]> {
  const rows = await db
    .select({
      id: transactions.id,
      referenceCode: transactions.referenceCode,
      type: transactions.type,
      total: transactions.total,
      voided: transactions.voided,
      createdAt: transactions.createdAt,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
    })
    .from(transactions)
    .leftJoin(customers, eq(transactions.customerId, customers.id))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);

  return rows.map((row: any) => ({
    id: row.id,
    referenceCode: row.referenceCode ?? null,
    type: row.type,
    total: row.total,
    voided: row.voided ?? 0,
    customerName: row.customerFirstName
      ? `${row.customerFirstName} ${row.customerLastName}`
      : 'Walk-in',
    createdAt: row.createdAt,
  }));
}
