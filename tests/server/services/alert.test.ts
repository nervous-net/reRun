// ABOUTME: Tests for the alert service (overdue rentals, birthday alerts, low stock detection)
// ABOUTME: Validates query logic for each alert type using seeded test data

import { describe, it, expect } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { nanoid } from 'nanoid';
import {
  customers,
  titles,
  copies,
  rentals,
  pricingRules,
  products,
} from '../../../server/db/schema.js';
import {
  getOverdueRentals,
  getBirthdayAlerts,
  getLowStockAlerts,
} from '../../../server/services/alert.js';

function buildDb() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  return { db, sqlite };
}

async function seedCustomer(db: any, overrides: Record<string, any> = {}) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: overrides.firstName ?? 'Rick',
    lastName: overrides.lastName ?? 'Dalton',
    memberBarcode: overrides.memberBarcode ?? `MBR-${nanoid(8)}`,
    birthday: overrides.birthday ?? null,
    balance: overrides.balance ?? 0,
  });
  return id;
}

async function seedTitleAndCopy(db: any, overrides: Record<string, any> = {}) {
  const titleId = nanoid();
  await db.insert(titles).values({
    id: titleId,
    name: overrides.titleName ?? 'The Thing',
    year: overrides.year ?? 1982,
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

describe('Alert Service', () => {
  // ─── Overdue Rentals ────────────────────────────────────────────────
  describe('getOverdueRentals', () => {
    it('returns rentals where status is out and dueAt < now', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      // Create an overdue rental (due 7 days ago)
      const rentalId = nanoid();
      await db.insert(rentals).values({
        id: rentalId,
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'out',
      });

      const results = await getOverdueRentals(db);
      expect(results.length).toBe(1);
      expect(results[0].customerId).toBe(customerId);
      expect(results[0].copyId).toBe(copyId);
      expect(results[0].customerFirstName).toBe('Rick');
      expect(results[0].titleName).toBe('The Thing');
    });

    it('does not include returned rentals even if past due', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      const rentalId = nanoid();
      await db.insert(rentals).values({
        id: rentalId,
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        status: 'returned',
      });

      const results = await getOverdueRentals(db);
      expect(results.length).toBe(0);
    });

    it('does not include rentals that are not yet due', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      const rentalId = nanoid();
      await db.insert(rentals).values({
        id: rentalId,
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'out',
      });

      const results = await getOverdueRentals(db);
      expect(results.length).toBe(0);
    });
  });

  // ─── Birthday Alerts ───────────────────────────────────────────────
  describe('getBirthdayAlerts', () => {
    it('returns customers whose birthday month/day matches today', async () => {
      const { db } = buildDb();
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const birthdayStr = `1990-${month}-${day}`;

      const customerId = await seedCustomer(db, {
        firstName: 'Birthday',
        lastName: 'Person',
        birthday: birthdayStr,
      });

      const results = await getBirthdayAlerts(db);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(customerId);
      expect(results[0].firstName).toBe('Birthday');
    });

    it('does not return customers whose birthday is a different day', async () => {
      const { db } = buildDb();
      // Use a date that is definitely not today
      const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');
      const birthdayStr = `1985-${month}-${day}`;

      await seedCustomer(db, { birthday: birthdayStr });

      const results = await getBirthdayAlerts(db);
      expect(results.length).toBe(0);
    });

    it('handles MM-DD format birthdays', async () => {
      const { db } = buildDb();
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const birthdayStr = `${month}-${day}`;

      const customerId = await seedCustomer(db, {
        firstName: 'Short',
        lastName: 'Format',
        birthday: birthdayStr,
      });

      const results = await getBirthdayAlerts(db);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe(customerId);
    });

    it('does not return inactive customers', async () => {
      const { db } = buildDb();
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const birthdayStr = `1990-${month}-${day}`;

      const customerId = await seedCustomer(db, { birthday: birthdayStr });
      // Deactivate the customer
      const { eq } = await import('drizzle-orm');
      await db.update(customers).set({ active: 0 }).where(eq(customers.id, customerId));

      const results = await getBirthdayAlerts(db);
      expect(results.length).toBe(0);
    });
  });

  // ─── Low Stock Alerts ──────────────────────────────────────────────
  describe('getLowStockAlerts', () => {
    it('returns active products where stockQty <= reorderLevel', async () => {
      const { db } = buildDb();
      const id = nanoid();
      await db.insert(products).values({
        id,
        name: 'Gummy Bears',
        sku: `SKU-${nanoid(6)}`,
        price: 199,
        cost: 99,
        stockQty: 2,
        reorderLevel: 5,
        active: 1,
      });

      const results = await getLowStockAlerts(db);
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Gummy Bears');
      expect(results[0].stockQty).toBe(2);
    });

    it('does not return products with sufficient stock', async () => {
      const { db } = buildDb();
      const id = nanoid();
      await db.insert(products).values({
        id,
        name: 'Popcorn',
        sku: `SKU-${nanoid(6)}`,
        price: 299,
        cost: 149,
        stockQty: 20,
        reorderLevel: 5,
        active: 1,
      });

      const results = await getLowStockAlerts(db);
      expect(results.length).toBe(0);
    });

    it('does not return inactive products even if low stock', async () => {
      const { db } = buildDb();
      const id = nanoid();
      await db.insert(products).values({
        id,
        name: 'Discontinued Candy',
        sku: `SKU-${nanoid(6)}`,
        price: 99,
        cost: 49,
        stockQty: 0,
        reorderLevel: 5,
        active: 0,
      });

      const results = await getLowStockAlerts(db);
      expect(results.length).toBe(0);
    });

    it('includes products where stockQty exactly equals reorderLevel', async () => {
      const { db } = buildDb();
      const id = nanoid();
      await db.insert(products).values({
        id,
        name: 'Soda',
        sku: `SKU-${nanoid(6)}`,
        price: 150,
        cost: 75,
        stockQty: 5,
        reorderLevel: 5,
        active: 1,
      });

      const results = await getLowStockAlerts(db);
      expect(results.length).toBe(1);
    });
  });
});
