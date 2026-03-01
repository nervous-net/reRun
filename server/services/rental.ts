// ABOUTME: Rental service handling checkout, return, late fee calculation, and overdue detection
// ABOUTME: Manages copy status transitions and customer balance charges for late fees

import { nanoid } from 'nanoid';
import { eq, and, lt, sql } from 'drizzle-orm';
import {
  rentals,
  copies,
  customers,
  pricingRules,
  titles,
} from '../db/schema.js';

// ─── Types ──────────────────────────────────────────────────────────

export interface CheckoutInput {
  customerId: string;
  copyId: string;
  pricingRuleId: string;
}

export interface ReturnInput {
  copyId: string;
  lateFeeAction: 'pay' | 'balance' | 'forgive';
}

// ─── Checkout ───────────────────────────────────────────────────────

export async function checkoutCopy(db: any, input: CheckoutInput) {
  const { customerId, copyId, pricingRuleId } = input;

  // Fetch pricing rule for duration (immutable lookup, safe outside transaction)
  const [rule] = await db
    .select()
    .from(pricingRules)
    .where(eq(pricingRules.id, pricingRuleId));

  if (!rule) {
    throw new Error('Pricing rule not found');
  }

  const now = new Date();
  const dueDate = new Date(now.getTime() + rule.durationDays * 24 * 60 * 60 * 1000);

  const rentalId = nanoid();

  // Use SQLite transaction for atomicity — availability check MUST be inside
  const rawDb = (db as any).session.client;
  const runInTransaction = rawDb.transaction(() => {
    // Re-read copy status inside transaction to prevent race conditions
    const [copy] = db.select().from(copies).where(eq(copies.id, copyId)).all();
    if (!copy || copy.status !== 'in') {
      throw new Error('Copy is not available for checkout');
    }

    db.insert(rentals)
      .values({
        id: rentalId,
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt: now.toISOString(),
        dueAt: dueDate.toISOString(),
        status: 'out',
      })
      .run();

    db.update(copies)
      .set({ status: 'out' })
      .where(eq(copies.id, copyId))
      .run();
  });

  runInTransaction();

  // Return the created rental
  const [rental] = await db
    .select()
    .from(rentals)
    .where(eq(rentals.id, rentalId));

  return rental;
}

// ─── Return ─────────────────────────────────────────────────────────

export async function returnCopy(db: any, input: ReturnInput) {
  const { copyId, lateFeeAction } = input;

  // Find active rental for this copy
  const [rental] = await db
    .select()
    .from(rentals)
    .where(and(eq(rentals.copyId, copyId), eq(rentals.status, 'out')));

  if (!rental) {
    throw new Error('No active rental found for this copy');
  }

  const now = new Date();
  const dueAt = new Date(rental.dueAt);

  // Calculate late fee
  let lateFee = 0;
  let lateFeePerDay = 0;

  if (rental.pricingRuleId) {
    const [rule] = await db
      .select()
      .from(pricingRules)
      .where(eq(pricingRules.id, rental.pricingRuleId));

    if (rule) {
      lateFeePerDay = rule.lateFeePerDay ?? 0;
    }
  }

  if (now > dueAt && lateFeePerDay > 0) {
    const msOverdue = now.getTime() - dueAt.getTime();
    const daysOverdue = Math.ceil(msOverdue / (1000 * 60 * 60 * 24));
    lateFee = daysOverdue * lateFeePerDay;
  }

  // Determine late fee status
  let lateFeeStatus: string | null = null;
  if (lateFee > 0) {
    if (lateFeeAction === 'pay') {
      lateFeeStatus = 'paid';
    } else if (lateFeeAction === 'balance') {
      lateFeeStatus = 'balance';
    } else if (lateFeeAction === 'forgive') {
      lateFeeStatus = 'forgiven';
    }
  }

  // Apply changes atomically
  const rawDb = (db as any).session.client;
  const runInTransaction = rawDb.transaction(() => {
    db.update(rentals)
      .set({
        status: 'returned',
        returnedAt: now.toISOString(),
        lateFee,
        lateFeeStatus,
      })
      .where(eq(rentals.id, rental.id))
      .run();

    db.update(copies)
      .set({ status: 'in' })
      .where(eq(copies.id, copyId))
      .run();

    // Add to customer balance if action is 'balance'
    if (lateFee > 0 && lateFeeAction === 'balance') {
      db.update(customers)
        .set({ balance: sql`${customers.balance} + ${lateFee}` })
        .where(eq(customers.id, rental.customerId))
        .run();
    }
  });

  runInTransaction();

  // Return updated rental
  const [updated] = await db
    .select()
    .from(rentals)
    .where(eq(rentals.id, rental.id));

  return updated;
}

// ─── Overdue Rentals ────────────────────────────────────────────────

export async function getOverdueRentals(db: any) {
  const now = new Date().toISOString();

  const results = await db
    .select({
      id: rentals.id,
      customerId: rentals.customerId,
      copyId: rentals.copyId,
      pricingRuleId: rentals.pricingRuleId,
      checkedOutAt: rentals.checkedOutAt,
      dueAt: rentals.dueAt,
      status: rentals.status,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      titleName: titles.name,
    })
    .from(rentals)
    .innerJoin(customers, eq(rentals.customerId, customers.id))
    .innerJoin(copies, eq(rentals.copyId, copies.id))
    .innerJoin(titles, eq(copies.titleId, titles.id))
    .where(and(eq(rentals.status, 'out'), lt(rentals.dueAt, now)));

  return results;
}

// ─── Customer Rentals ───────────────────────────────────────────────

export async function getCustomerRentals(db: any, customerId: string) {
  const results = await db
    .select({
      id: rentals.id,
      customerId: rentals.customerId,
      copyId: rentals.copyId,
      pricingRuleId: rentals.pricingRuleId,
      checkedOutAt: rentals.checkedOutAt,
      dueAt: rentals.dueAt,
      returnedAt: rentals.returnedAt,
      lateFee: rentals.lateFee,
      lateFeeStatus: rentals.lateFeeStatus,
      status: rentals.status,
      titleName: titles.name,
      copyBarcode: copies.barcode,
    })
    .from(rentals)
    .innerJoin(copies, eq(rentals.copyId, copies.id))
    .innerJoin(titles, eq(copies.titleId, titles.id))
    .where(eq(rentals.customerId, customerId));

  return results;
}

// ─── Active Rentals ─────────────────────────────────────────────────

export async function getActiveRentals(db: any) {
  const results = await db
    .select()
    .from(rentals)
    .where(eq(rentals.status, 'out'));

  return results;
}

// ─── Previously Rented ──────────────────────────────────────────────

export async function checkPreviouslyRented(
  db: any,
  customerId: string,
  titleId: string
): Promise<boolean> {
  // Find any rental by this customer for a copy of this title
  const results = await db
    .select({ id: rentals.id })
    .from(rentals)
    .innerJoin(copies, eq(rentals.copyId, copies.id))
    .where(and(eq(rentals.customerId, customerId), eq(copies.titleId, titleId)))
    .limit(1);

  return results.length > 0;
}
