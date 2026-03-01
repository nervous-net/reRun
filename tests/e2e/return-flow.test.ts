// ABOUTME: End-to-end test for the return flow with late fee handling
// ABOUTME: Covers checkout, backdating, return with balance/forgive actions, and fee verification

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, migrateTestDb } from '../setup.js';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { checkoutCopy, returnCopy } from '../../server/services/rental.js';
import {
  customers,
  titles,
  copies,
  pricingRules,
  rentals,
} from '../../server/db/schema.js';

let db: any;
let sqlite: any;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);
});

async function seedCustomer(db: any, overrides: Record<string, any> = {}) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: overrides.firstName ?? 'Dante',
    lastName: overrides.lastName ?? 'Hicks',
    memberBarcode: overrides.memberBarcode ?? `MBR-${nanoid(8)}`,
    balance: overrides.balance ?? 0,
  });
  return id;
}

async function seedTitleAndCopy(db: any, overrides: Record<string, any> = {}) {
  const titleId = nanoid();
  await db.insert(titles).values({
    id: titleId,
    name: overrides.titleName ?? 'Clerks',
    year: overrides.year ?? 1994,
  });
  const copyId = nanoid();
  await db.insert(copies).values({
    id: copyId,
    titleId,
    barcode: overrides.barcode ?? `BC-${nanoid(6)}`,
    format: overrides.format ?? 'VHS',
    status: overrides.status ?? 'in',
  });
  return { titleId, copyId };
}

async function seedPricingRule(db: any, overrides: Record<string, any> = {}) {
  const id = nanoid();
  await db.insert(pricingRules).values({
    id,
    name: overrides.name ?? '3-Day Rental',
    type: overrides.type ?? 'rental',
    rate: overrides.rate ?? 299,
    durationDays: overrides.durationDays ?? 3,
    lateFeePerDay: overrides.lateFeePerDay ?? 100,
    active: 1,
  });
  return id;
}

describe('Return Flow E2E', () => {
  describe('on-time return', () => {
    it('returns a copy on time with no late fee', async () => {
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, {
        durationDays: 7,
        lateFeePerDay: 150,
      });

      // Checkout the copy
      const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });
      expect(rental.status).toBe('out');

      // Return immediately (within due period)
      const result = await returnCopy(db, { copyId, lateFeeAction: 'balance' });

      // Verify rental marked as returned with no late fee
      expect(result.status).toBe('returned');
      expect(result.returnedAt).toBeDefined();
      expect(result.lateFee).toBe(0);
      expect(result.lateFeeStatus).toBeNull();

      // Verify copy status back to 'in'
      const [copy] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copy.status).toBe('in');

      // Verify customer balance unchanged
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
      expect(customer.balance).toBe(0);
    });
  });

  describe('overdue return with balance action', () => {
    it('calculates late fee and charges customer balance', async () => {
      const customerId = await seedCustomer(db, { balance: 0 });
      const { copyId } = await seedTitleAndCopy(db, {
        titleName: 'Mallrats',
        year: 1995,
      });
      const pricingRuleId = await seedPricingRule(db, {
        name: '3-Day DVD Rental',
        durationDays: 3,
        lateFeePerDay: 150, // $1.50/day in cents
      });

      // Step 1: Checkout the copy
      const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });
      expect(rental.status).toBe('out');

      // Step 2: Backdate the rental's due_at to make it 5 days overdue
      // Add 1hr buffer so Math.ceil gives exact day count
      const HOUR = 60 * 60 * 1000;
      const DAY = 24 * HOUR;
      const fiveDaysAgo = new Date(Date.now() - 5 * DAY + HOUR).toISOString();
      const eightDaysAgo = new Date(Date.now() - 8 * DAY + HOUR).toISOString();

      await db.update(rentals)
        .set({
          dueAt: fiveDaysAgo,
          checkedOutAt: eightDaysAgo,
        })
        .where(eq(rentals.id, rental.id));

      // Step 3: Process return with 'balance' action
      const result = await returnCopy(db, { copyId, lateFeeAction: 'balance' });

      // Step 4: Verify late fee calculated correctly (5 days * 150 cents = 750 cents)
      expect(result.status).toBe('returned');
      expect(result.returnedAt).toBeDefined();
      expect(result.lateFee).toBe(750);
      expect(result.lateFeeStatus).toBe('balance');

      // Step 5: Verify copy status back to 'in'
      const [copy] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copy.status).toBe('in');

      // Step 6: Verify customer balance updated (increased by late fee)
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
      expect(customer.balance).toBe(750);
    });

    it('adds late fee to existing customer balance', async () => {
      // Customer starts with a $5.00 existing balance
      const customerId = await seedCustomer(db, { balance: 500 });
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, {
        durationDays: 3,
        lateFeePerDay: 200, // $2.00/day
      });

      // Checkout
      const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      // Backdate to 3 days overdue
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

      await db.update(rentals)
        .set({
          dueAt: threeDaysAgo,
          checkedOutAt: sixDaysAgo,
        })
        .where(eq(rentals.id, rental.id));

      // Return with balance action
      const result = await returnCopy(db, { copyId, lateFeeAction: 'balance' });

      // 3 days * 200 cents = 600 cents
      expect(result.lateFee).toBe(600);
      expect(result.lateFeeStatus).toBe('balance');

      // Customer balance should be 500 (existing) + 600 (late fee) = 1100
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
      expect(customer.balance).toBe(1100);
    });
  });

  describe('overdue return with forgive action', () => {
    it('records late fee but does not charge customer balance', async () => {
      const customerId = await seedCustomer(db, { balance: 0 });
      const { copyId } = await seedTitleAndCopy(db, {
        titleName: 'Chasing Amy',
        year: 1997,
      });
      const pricingRuleId = await seedPricingRule(db, {
        durationDays: 3,
        lateFeePerDay: 100, // $1.00/day
      });

      // Checkout the copy
      const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      // Backdate to 4 days overdue
      const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      await db.update(rentals)
        .set({
          dueAt: fourDaysAgo,
          checkedOutAt: sevenDaysAgo,
        })
        .where(eq(rentals.id, rental.id));

      // Process return with 'forgive' action
      const result = await returnCopy(db, { copyId, lateFeeAction: 'forgive' });

      // Late fee should be calculated and recorded
      expect(result.status).toBe('returned');
      expect(result.lateFee).toBe(400); // 4 days * 100 cents
      expect(result.lateFeeStatus).toBe('forgiven');

      // Copy should be back to 'in'
      const [copy] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copy.status).toBe('in');

      // Customer balance should NOT be charged
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
      expect(customer.balance).toBe(0);
    });
  });

  describe('overdue return with pay action', () => {
    it('records late fee as paid without affecting balance', async () => {
      const customerId = await seedCustomer(db, { balance: 0 });
      const { copyId } = await seedTitleAndCopy(db, {
        titleName: 'Dogma',
        year: 1999,
      });
      const pricingRuleId = await seedPricingRule(db, {
        durationDays: 3,
        lateFeePerDay: 200,
      });

      const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      // Backdate to 2 days overdue
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

      await db.update(rentals)
        .set({
          dueAt: twoDaysAgo,
          checkedOutAt: fiveDaysAgo,
        })
        .where(eq(rentals.id, rental.id));

      const result = await returnCopy(db, { copyId, lateFeeAction: 'pay' });

      expect(result.lateFee).toBe(400); // 2 days * 200 cents
      expect(result.lateFeeStatus).toBe('paid');

      // Balance should not change for 'pay' action (paid at counter)
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
      expect(customer.balance).toBe(0);
    });
  });

  describe('full checkout-return cycle', () => {
    it('completes a full cycle: checkout -> backdate -> return -> verify all state', async () => {
      // Setup
      const customerId = await seedCustomer(db, {
        firstName: 'Jay',
        lastName: 'Silent Bob',
        balance: 0,
      });
      const { titleId, copyId } = await seedTitleAndCopy(db, {
        titleName: 'Jay and Silent Bob Strike Back',
        year: 2001,
      });
      const pricingRuleId = await seedPricingRule(db, {
        name: '7-Day VHS Rental',
        durationDays: 7,
        lateFeePerDay: 100,
      });

      // Checkout
      const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      // Verify intermediate state
      const [copyMid] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copyMid.status).toBe('out');
      const [rentalMid] = await db.select().from(rentals).where(eq(rentals.id, rental.id));
      expect(rentalMid.status).toBe('out');

      // Backdate to 3 days overdue (add 1hr buffer so Math.ceil gives exact day count)
      const HOUR = 60 * 60 * 1000;
      const DAY = 24 * HOUR;
      const threeDaysAgo = new Date(Date.now() - 3 * DAY + HOUR).toISOString();
      const tenDaysAgo = new Date(Date.now() - 10 * DAY + HOUR).toISOString();

      await db.update(rentals)
        .set({
          dueAt: threeDaysAgo,
          checkedOutAt: tenDaysAgo,
        })
        .where(eq(rentals.id, rental.id));

      // Return with balance
      const returned = await returnCopy(db, { copyId, lateFeeAction: 'balance' });

      // Verify final rental state
      expect(returned.status).toBe('returned');
      expect(returned.lateFee).toBe(300); // 3 days * 100 cents
      expect(returned.lateFeeStatus).toBe('balance');
      expect(returned.returnedAt).toBeDefined();

      // Verify final copy state
      const [copyFinal] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copyFinal.status).toBe('in');

      // Verify final customer state
      const [customerFinal] = await db.select().from(customers).where(eq(customers.id, customerId));
      expect(customerFinal.balance).toBe(300);

      // Verify rental record is fully updated in DB
      const [rentalFinal] = await db.select().from(rentals).where(eq(rentals.id, rental.id));
      expect(rentalFinal.status).toBe('returned');
      expect(rentalFinal.lateFee).toBe(300);
      expect(rentalFinal.lateFeeStatus).toBe('balance');
      expect(rentalFinal.returnedAt).toBeDefined();
    });

    it('allows re-checkout of a returned copy', async () => {
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 7 });

      // First checkout
      await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      // Return
      await returnCopy(db, { copyId, lateFeeAction: 'pay' });

      // Verify copy is 'in' again
      const [copyAfterReturn] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copyAfterReturn.status).toBe('in');

      // Second checkout should succeed
      const rental2 = await checkoutCopy(db, { customerId, copyId, pricingRuleId });
      expect(rental2.status).toBe('out');

      const [copyAfterReCheckout] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copyAfterReCheckout.status).toBe('out');

      // Should now have 2 rental records for this copy
      const allRentals = await db.select().from(rentals);
      const copyRentals = allRentals.filter((r: any) => r.copyId === copyId);
      expect(copyRentals).toHaveLength(2);
      expect(copyRentals.filter((r: any) => r.status === 'returned')).toHaveLength(1);
      expect(copyRentals.filter((r: any) => r.status === 'out')).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('returns with no late fee when pricing rule has zero late fee per day', async () => {
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, {
        durationDays: 3,
        lateFeePerDay: 0, // No late fee
      });

      const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      // Backdate to 5 days overdue
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

      await db.update(rentals)
        .set({
          dueAt: fiveDaysAgo,
          checkedOutAt: eightDaysAgo,
        })
        .where(eq(rentals.id, rental.id));

      const result = await returnCopy(db, { copyId, lateFeeAction: 'balance' });

      // Even though overdue, no fee because lateFeePerDay is 0
      expect(result.lateFee).toBe(0);
      expect(result.lateFeeStatus).toBeNull();

      // Balance should not change
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
      expect(customer.balance).toBe(0);
    });

    it('throws when trying to return a copy with no active rental', async () => {
      await seedTitleAndCopy(db);
      const fakeCopyId = nanoid();

      await expect(
        returnCopy(db, { copyId: fakeCopyId, lateFeeAction: 'pay' })
      ).rejects.toThrow('No active rental found for this copy');
    });
  });
});
