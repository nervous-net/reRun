// ABOUTME: Tests for the dashboard stats service (today's activity aggregations)
// ABOUTME: Validates rental count, return count, revenue sum, and late fee sum queries

import { describe, it, expect } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { nanoid } from 'nanoid';
import {
  customers,
  titles,
  copies,
  rentals,
  pricingRules,
  transactions,
} from '../../../server/db/schema.js';
import { getTodayStats } from '../../../server/services/dashboard.js';

function buildDb() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  return { db, sqlite };
}

async function seedCustomer(db: any) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: 'Test',
    lastName: 'Customer',
    memberBarcode: `MBR-${nanoid(8)}`,
    balance: 0,
  });
  return id;
}

async function seedTitleAndCopy(db: any) {
  const titleId = nanoid();
  await db.insert(titles).values({ id: titleId, name: 'Test Movie', year: 2024 });
  const copyId = nanoid();
  await db.insert(copies).values({
    id: copyId,
    titleId,
    barcode: `BC-${nanoid(6)}`,
    format: 'VHS',
    status: 'in',
  });
  return { titleId, copyId };
}

async function seedPricingRule(db: any) {
  const id = nanoid();
  await db.insert(pricingRules).values({
    id,
    name: '7-Day Rental',
    type: 'rental',
    rate: 399,
    durationDays: 7,
    lateFeePerDay: 100,
    active: 1,
  });
  return id;
}

describe('Dashboard Service', () => {
  describe('getTodayStats', () => {
    it('returns zeros when no activity exists', async () => {
      const { db } = buildDb();
      const stats = await getTodayStats(db);
      expect(stats).toEqual({
        rentalsToday: 0,
        returnsToday: 0,
        revenueCents: 0,
        lateFeesCollectedCents: 0,
      });
    });

    it('counts rental transactions created today', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.rentalsToday).toBe(1);
    });

    it('excludes voided transactions from rental count', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 1,
        voidReason: 'mistake',
        createdAt: new Date().toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.rentalsToday).toBe(0);
    });

    it('excludes transactions from previous days', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: yesterday.toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.rentalsToday).toBe(0);
    });

    it('counts rentals returned today', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        status: 'returned',
      });

      const stats = await getTodayStats(db);
      expect(stats.returnsToday).toBe(1);
    });

    it('sums revenue from non-voided transactions today', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 32,
        total: 431,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'sale',
        subtotal: 199,
        tax: 16,
        total: 215,
        paymentMethod: 'card',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.revenueCents).toBe(431 + 215);
    });

    it('excludes voided transactions from revenue', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 1,
        voidReason: 'oops',
        createdAt: new Date().toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.revenueCents).toBe(399);
    });

    it('sums late fees with paid status for rentals returned today', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        lateFee: 700,
        lateFeeStatus: 'paid',
        status: 'returned',
      });

      const stats = await getTodayStats(db);
      expect(stats.lateFeesCollectedCents).toBe(700);
    });

    it('excludes late fees with balance or forgiven status', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);
      const pricingRuleId = await seedPricingRule(db);

      const titleId = nanoid();
      await db.insert(titles).values({ id: titleId, name: 'Test', year: 2024 });
      const copyId1 = nanoid();
      const copyId2 = nanoid();
      await db.insert(copies).values({
        id: copyId1,
        titleId,
        barcode: `BC-${nanoid(6)}`,
        format: 'VHS',
        status: 'in',
      });
      await db.insert(copies).values({
        id: copyId2,
        titleId,
        barcode: `BC-${nanoid(6)}`,
        format: 'DVD',
        status: 'in',
      });

      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId: copyId1,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        lateFee: 700,
        lateFeeStatus: 'balance',
        status: 'returned',
      });

      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId: copyId2,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        lateFee: 500,
        lateFeeStatus: 'forgiven',
        status: 'returned',
      });

      const stats = await getTodayStats(db);
      expect(stats.lateFeesCollectedCents).toBe(0);
    });
  });
});
