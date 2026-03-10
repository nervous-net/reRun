// ABOUTME: Tests for the rental service (checkout, return, late fees, overdue detection)
// ABOUTME: Validates copy status transitions, late fee math, balance charges, and rental history

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { nanoid } from 'nanoid';
import {
  checkoutCopy,
  returnCopy,
  getOverdueRentals,
  getCustomerRentals,
  getActiveRentals,
  checkPreviouslyRented,
  getReturnedToday,
  getRentedCopiesForTitle,
} from '../../../server/services/rental.js';
import {
  customers,
  titles,
  copies,
  pricingRules,
  rentals,
} from '../../../server/db/schema.js';
import { eq } from 'drizzle-orm';

function buildTestDb() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  return { db, sqlite };
}

async function seedCustomer(db: any, overrides: Record<string, any> = {}) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: overrides.firstName ?? 'Randal',
    lastName: overrides.lastName ?? 'Graves',
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

describe('Rental Service', () => {
  describe('checkoutCopy', () => {
    it('creates a rental and sets copy status to out', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 5 });

      const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      expect(rental.id).toBeDefined();
      expect(rental.customerId).toBe(customerId);
      expect(rental.copyId).toBe(copyId);
      expect(rental.pricingRuleId).toBe(pricingRuleId);
      expect(rental.status).toBe('out');
      expect(rental.checkedOutAt).toBeDefined();
      expect(rental.dueAt).toBeDefined();

      // Verify due date is ~5 days from now
      const checkedOut = new Date(rental.checkedOutAt);
      const due = new Date(rental.dueAt);
      const diffDays = Math.round((due.getTime() - checkedOut.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(5);

      // Verify copy status changed to 'out'
      const [copy] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copy.status).toBe('out');
    });

    it('throws when copy is already checked out', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db, { status: 'out' });
      const pricingRuleId = await seedPricingRule(db);

      await expect(
        checkoutCopy(db, { customerId, copyId, pricingRuleId })
      ).rejects.toThrow('Copy is not available for checkout');
    });
  });

  describe('returnCopy', () => {
    it('returns on time with no late fee', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 7 });

      // Checkout
      await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      // Return immediately (within due date)
      const result = await returnCopy(db, { copyId, lateFeeAction: 'pay' });

      expect(result.status).toBe('returned');
      expect(result.returnedAt).toBeDefined();
      expect(result.lateFee).toBe(0);

      // Copy should be back to 'in'
      const [copy] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copy.status).toBe('in');
    });

    it('calculates late fee correctly when overdue', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, {
        durationDays: 3,
        lateFeePerDay: 150,
      });

      // Create rental manually with past dates to simulate overdue
      // Add 1hr buffer so Math.ceil gives exact day count
      const HOUR = 60 * 60 * 1000;
      const DAY = 24 * HOUR;
      const rentalId = nanoid();
      const checkedOutAt = new Date(Date.now() - 6 * DAY + HOUR).toISOString();
      const dueAt = new Date(Date.now() - 3 * DAY + HOUR).toISOString();

      await db.insert(rentals).values({
        id: rentalId,
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt,
        dueAt,
        status: 'out',
      });

      // Also set copy to 'out'
      await db.update(copies).set({ status: 'out' }).where(eq(copies.id, copyId));

      const result = await returnCopy(db, { copyId, lateFeeAction: 'pay' });

      expect(result.status).toBe('returned');
      // 3 days overdue * 150 cents/day = 450 cents
      expect(result.lateFee).toBe(450);
      expect(result.lateFeeStatus).toBe('paid');
    });

    it('adds late fee to customer balance when action is balance', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db, { balance: 0 });
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, {
        durationDays: 3,
        lateFeePerDay: 200,
      });

      // Create overdue rental (add 1hr buffer so Math.ceil gives exact day count)
      const rentalId = nanoid();
      const HOUR = 60 * 60 * 1000;
      const DAY = 24 * HOUR;
      const checkedOutAt = new Date(Date.now() - 5 * DAY + HOUR).toISOString();
      const dueAt = new Date(Date.now() - 2 * DAY + HOUR).toISOString();

      await db.insert(rentals).values({
        id: rentalId,
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt,
        dueAt,
        status: 'out',
      });

      await db.update(copies).set({ status: 'out' }).where(eq(copies.id, copyId));

      const result = await returnCopy(db, { copyId, lateFeeAction: 'balance' });

      // 2 days overdue * 200 cents/day = 400 cents
      expect(result.lateFee).toBe(400);
      expect(result.lateFeeStatus).toBe('balance');

      // Customer balance should be -400 (negative = owes money)
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
      expect(customer.balance).toBe(-400);
    });

    it('forgives late fee when action is forgive', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, {
        durationDays: 3,
        lateFeePerDay: 100,
      });

      // Create overdue rental
      const rentalId = nanoid();
      const checkedOutAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const dueAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();

      await db.insert(rentals).values({
        id: rentalId,
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt,
        dueAt,
        status: 'out',
      });

      await db.update(copies).set({ status: 'out' }).where(eq(copies.id, copyId));

      const result = await returnCopy(db, { copyId, lateFeeAction: 'forgive' });

      // Late fee calculated but forgiven
      expect(result.lateFee).toBeGreaterThan(0);
      expect(result.lateFeeStatus).toBe('forgiven');

      // Customer balance should not be affected
      const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
      expect(customer.balance).toBe(0);
    });

    it('throws when no active rental found for copy', async () => {
      const { db } = buildTestDb();
      await seedTitleAndCopy(db);
      const fakeCopyId = nanoid();

      await expect(
        returnCopy(db, { copyId: fakeCopyId, lateFeeAction: 'pay' })
      ).rejects.toThrow('No active rental found for this copy');
    });
  });

  describe('checkPreviouslyRented', () => {
    it('returns true if customer has rented a copy of the title', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { titleId, copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      const result = await checkPreviouslyRented(db, customerId, titleId);
      expect(result).toBe(true);
    });

    it('returns false if customer has not rented the title', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { titleId } = await seedTitleAndCopy(db);

      const result = await checkPreviouslyRented(db, customerId, titleId);
      expect(result).toBe(false);
    });
  });

  describe('getOverdueRentals', () => {
    it('returns rentals that are past due', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { titleId, copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      // Create an overdue rental manually
      const rentalId = nanoid();
      await db.insert(rentals).values({
        id: rentalId,
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'out',
      });

      await db.update(copies).set({ status: 'out' }).where(eq(copies.id, copyId));

      const overdue = await getOverdueRentals(db);
      expect(overdue.length).toBeGreaterThanOrEqual(1);

      const found = overdue.find((r: any) => r.id === rentalId);
      expect(found).toBeDefined();
      expect(found.customerFirstName).toBeDefined();
      expect(found.titleName).toBeDefined();
    });

    it('does not return rentals that are not yet due', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 30 });

      // Checkout -- due date is 30 days from now
      await checkoutCopy(db, { customerId, copyId, pricingRuleId });

      const overdue = await getOverdueRentals(db);
      expect(overdue).toHaveLength(0);
    });
  });

  describe('getCustomerRentals', () => {
    it('returns all rentals for a customer', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId: copyId1 } = await seedTitleAndCopy(db, { barcode: 'BC-AAA' });
      const { copyId: copyId2 } = await seedTitleAndCopy(db, {
        barcode: 'BC-BBB',
        titleName: 'Mallrats',
        year: 1995,
      });
      const pricingRuleId = await seedPricingRule(db);

      await checkoutCopy(db, { customerId, copyId: copyId1, pricingRuleId });
      await checkoutCopy(db, { customerId, copyId: copyId2, pricingRuleId });

      const history = await getCustomerRentals(db, customerId);
      expect(history).toHaveLength(2);
    });
  });

  describe('getActiveRentals', () => {
    it('returns only active (out) rentals', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId: copyId1 } = await seedTitleAndCopy(db, { barcode: 'BC-ONE' });
      const { copyId: copyId2 } = await seedTitleAndCopy(db, {
        barcode: 'BC-TWO',
        titleName: 'Dogma',
        year: 1999,
      });
      const pricingRuleId = await seedPricingRule(db, { durationDays: 7 });

      await checkoutCopy(db, { customerId, copyId: copyId1, pricingRuleId });
      await checkoutCopy(db, { customerId, copyId: copyId2, pricingRuleId });

      // Return one
      await returnCopy(db, { copyId: copyId1, lateFeeAction: 'pay' });

      const active = await getActiveRentals(db);
      expect(active).toHaveLength(1);
      expect(active[0].copyId).toBe(copyId2);
    });
  });

  describe('getReturnedToday', () => {
    it('returns rentals returned today with title and customer info', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db, { firstName: 'Dante', lastName: 'Hicks' });
      const { copyId } = await seedTitleAndCopy(db, { titleName: 'Clerks' });
      const ruleId = await seedPricingRule(db);

      await checkoutCopy(db, { customerId, copyId, pricingRuleId: ruleId });
      await returnCopy(db, { copyId, lateFeeAction: 'pay' });

      const results = await getReturnedToday(db);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        copyId,
        status: 'returned',
        titleName: 'Clerks',
        customerFirstName: 'Dante',
      });
      expect(results[0].returnedAt).toBeDefined();
      expect(results[0].copyBarcode).toBeDefined();
    });

    it('excludes rentals returned on previous days', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const ruleId = await seedPricingRule(db);

      await checkoutCopy(db, { customerId, copyId, pricingRuleId: ruleId });
      await returnCopy(db, { copyId, lateFeeAction: 'pay' });

      // Backdate the returnedAt to yesterday
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      await db.update(rentals).set({ returnedAt: yesterday }).where(eq(rentals.copyId, copyId));

      const results = await getReturnedToday(db);
      expect(results).toHaveLength(0);
    });
  });
});
