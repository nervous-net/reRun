// ABOUTME: Tests for all Drizzle ORM schema tables in the reRun database
// ABOUTME: Validates table creation, inserts, foreign keys, defaults, and unique constraints

import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, migrateTestDb } from '../../setup.js';
import * as schema from '../../../server/db/schema.js';

describe('Database Schema', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  let sqlite: ReturnType<typeof createTestDb>['sqlite'];

  beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    sqlite = testDb.sqlite;
    migrateTestDb(sqlite);
  });

  describe('titles', () => {
    it('inserts and retrieves a title', async () => {
      db.insert(schema.titles).values({
        id: 'title-1',
        tmdbId: 550,
        name: 'Fight Club',
        year: 1999,
        genre: 'Drama',
        runtimeMinutes: 139,
        synopsis: 'An insomniac office worker...',
        rating: 'R',
        cast: 'Brad Pitt, Edward Norton',
        coverUrl: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
      }).run();

      const rows = db.select().from(schema.titles).where(eq(schema.titles.id, 'title-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Fight Club');
      expect(rows[0].tmdbId).toBe(550);
      expect(rows[0].cast).toBe('Brad Pitt, Edward Norton');
    });

    it('sets createdAt and updatedAt automatically', () => {
      db.insert(schema.titles).values({
        id: 'title-2',
        name: 'The Matrix',
        year: 1999,
      }).run();

      const rows = db.select().from(schema.titles).where(eq(schema.titles.id, 'title-2')).all();
      expect(rows[0].createdAt).toBeTruthy();
      expect(rows[0].updatedAt).toBeTruthy();
    });
  });

  describe('copies', () => {
    it('inserts a copy linked to a title', () => {
      db.insert(schema.titles).values({ id: 'title-1', name: 'Fight Club', year: 1999 }).run();
      db.insert(schema.copies).values({
        id: 'copy-1',
        titleId: 'title-1',
        barcode: 'RR-00001',
        format: 'VHS',
      }).run();

      const rows = db.select().from(schema.copies).where(eq(schema.copies.id, 'copy-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].format).toBe('VHS');
      expect(rows[0].condition).toBe('good');
      expect(rows[0].status).toBe('in');
    });

    it('enforces unique barcode', () => {
      db.insert(schema.titles).values({ id: 'title-1', name: 'Fight Club', year: 1999 }).run();
      db.insert(schema.copies).values({ id: 'copy-1', titleId: 'title-1', barcode: 'RR-00001', format: 'VHS' }).run();

      expect(() => {
        db.insert(schema.copies).values({ id: 'copy-2', titleId: 'title-1', barcode: 'RR-00001', format: 'DVD' }).run();
      }).toThrow();
    });
  });

  describe('customers', () => {
    it('inserts a customer with defaults', () => {
      db.insert(schema.customers).values({
        id: 'cust-1',
        firstName: 'Tyler',
        lastName: 'Durden',
        email: 'tyler@paperstreet.com',
        memberBarcode: 'MBR-00001',
      }).run();

      const rows = db.select().from(schema.customers).where(eq(schema.customers.id, 'cust-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].balance).toBe(0);
      expect(rows[0].active).toBe(1);
    });

    it('enforces unique memberBarcode', () => {
      db.insert(schema.customers).values({ id: 'cust-1', firstName: 'Tyler', lastName: 'Durden', memberBarcode: 'MBR-00001' }).run();

      expect(() => {
        db.insert(schema.customers).values({ id: 'cust-2', firstName: 'Marla', lastName: 'Singer', memberBarcode: 'MBR-00001' }).run();
      }).toThrow();
    });
  });

  describe('familyMembers', () => {
    it('inserts a family member linked to a customer', () => {
      db.insert(schema.customers).values({ id: 'cust-1', firstName: 'Tyler', lastName: 'Durden', memberBarcode: 'MBR-00001' }).run();
      db.insert(schema.familyMembers).values({
        id: 'fm-1',
        customerId: 'cust-1',
        firstName: 'Tyler Jr',
        lastName: 'Durden',
        relationship: 'child',
      }).run();

      const rows = db.select().from(schema.familyMembers).where(eq(schema.familyMembers.customerId, 'cust-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].relationship).toBe('child');
    });
  });

  describe('rentals', () => {
    it('inserts a rental with foreign keys', () => {
      // Set up required rows
      db.insert(schema.titles).values({ id: 'title-1', name: 'Fight Club', year: 1999 }).run();
      db.insert(schema.copies).values({ id: 'copy-1', titleId: 'title-1', barcode: 'RR-00001', format: 'VHS' }).run();
      db.insert(schema.customers).values({ id: 'cust-1', firstName: 'Tyler', lastName: 'Durden', memberBarcode: 'MBR-00001' }).run();
      db.insert(schema.pricingRules).values({ id: 'pr-1', name: '3-Day Rental', type: 'standard', rate: 399, durationDays: 3 }).run();
      db.insert(schema.transactions).values({
        id: 'txn-1',
        customerId: 'cust-1',
        type: 'rental',
        subtotal: 399,
        total: 399,
        paymentMethod: 'cash',
      }).run();

      db.insert(schema.rentals).values({
        id: 'rental-1',
        customerId: 'cust-1',
        copyId: 'copy-1',
        transactionId: 'txn-1',
        pricingRuleId: 'pr-1',
        checkedOutAt: '2025-01-15T10:00:00Z',
        dueAt: '2025-01-18T22:00:00Z',
        status: 'out',
      }).run();

      const rows = db.select().from(schema.rentals).where(eq(schema.rentals.id, 'rental-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].lateFee).toBe(0);
      expect(rows[0].status).toBe('out');
    });
  });

  describe('transactions', () => {
    it('inserts a transaction with defaults', () => {
      db.insert(schema.customers).values({ id: 'cust-1', firstName: 'Tyler', lastName: 'Durden', memberBarcode: 'MBR-00001' }).run();
      db.insert(schema.transactions).values({
        id: 'txn-1',
        customerId: 'cust-1',
        type: 'rental',
        subtotal: 399,
        total: 432,
        paymentMethod: 'cash',
        amountTendered: 500,
        changeGiven: 68,
      }).run();

      const rows = db.select().from(schema.transactions).where(eq(schema.transactions.id, 'txn-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].tax).toBe(0);
      expect(rows[0].voided).toBe(0);
      expect(rows[0].total).toBe(432);
    });
  });

  describe('transactionItems', () => {
    it('inserts a transaction item linked to a transaction', () => {
      db.insert(schema.customers).values({ id: 'cust-1', firstName: 'Tyler', lastName: 'Durden', memberBarcode: 'MBR-00001' }).run();
      db.insert(schema.transactions).values({ id: 'txn-1', customerId: 'cust-1', type: 'rental', subtotal: 399, total: 399, paymentMethod: 'cash' }).run();

      db.insert(schema.transactionItems).values({
        id: 'ti-1',
        transactionId: 'txn-1',
        type: 'rental',
        description: 'Fight Club - 3 Day Rental',
        amount: 399,
      }).run();

      const rows = db.select().from(schema.transactionItems).where(eq(schema.transactionItems.transactionId, 'txn-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].tax).toBe(0);
    });
  });

  describe('products', () => {
    it('inserts a product with defaults', () => {
      db.insert(schema.products).values({
        id: 'prod-1',
        name: 'Microwave Popcorn',
        sku: 'POP-001',
        price: 299,
        cost: 150,
        category: 'snacks',
      }).run();

      const rows = db.select().from(schema.products).where(eq(schema.products.id, 'prod-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].taxRate).toBe(0);
      expect(rows[0].stockQty).toBe(0);
      expect(rows[0].reorderLevel).toBe(0);
      expect(rows[0].active).toBe(1);
    });

    it('enforces unique sku', () => {
      db.insert(schema.products).values({ id: 'prod-1', name: 'Popcorn', sku: 'POP-001', price: 299, cost: 150 }).run();

      expect(() => {
        db.insert(schema.products).values({ id: 'prod-2', name: 'Popcorn XL', sku: 'POP-001', price: 499, cost: 250 }).run();
      }).toThrow();
    });
  });

  describe('pricingRules', () => {
    it('inserts a pricing rule with defaults', () => {
      db.insert(schema.pricingRules).values({
        id: 'pr-1',
        name: '3-Day Rental',
        type: 'standard',
        rate: 399,
        durationDays: 3,
      }).run();

      const rows = db.select().from(schema.pricingRules).where(eq(schema.pricingRules.id, 'pr-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].lateFeePerDay).toBe(0);
      expect(rows[0].active).toBe(1);
    });
  });

  describe('reservations', () => {
    it('inserts a reservation with defaults', () => {
      db.insert(schema.titles).values({ id: 'title-1', name: 'Fight Club', year: 1999 }).run();
      db.insert(schema.customers).values({ id: 'cust-1', firstName: 'Tyler', lastName: 'Durden', memberBarcode: 'MBR-00001' }).run();

      db.insert(schema.reservations).values({
        id: 'res-1',
        customerId: 'cust-1',
        titleId: 'title-1',
        reservedAt: '2025-01-15T10:00:00Z',
        expiresAt: '2025-01-22T10:00:00Z',
      }).run();

      const rows = db.select().from(schema.reservations).where(eq(schema.reservations.id, 'res-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].fulfilled).toBe(0);
      expect(rows[0].notified).toBe(0);
    });
  });

  describe('promotions', () => {
    it('inserts a promotion', () => {
      db.insert(schema.promotions).values({
        id: 'promo-1',
        name: 'BOGO Tuesdays',
        type: 'bogo',
        rules: JSON.stringify({ dayOfWeek: 2 }),
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      }).run();

      const rows = db.select().from(schema.promotions).where(eq(schema.promotions.id, 'promo-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].active).toBe(1);
    });
  });

  describe('prepaidPlans', () => {
    it('inserts a prepaid plan', () => {
      db.insert(schema.prepaidPlans).values({
        id: 'plan-1',
        name: '10-Rental Bundle',
        price: 2999,
        creditValue: 0,
        rentalCount: 10,
        durationDays: 90,
      }).run();

      const rows = db.select().from(schema.prepaidPlans).where(eq(schema.prepaidPlans.id, 'plan-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].active).toBe(1);
    });
  });

  describe('customerPrepaid', () => {
    it('inserts a customer prepaid record', () => {
      db.insert(schema.customers).values({ id: 'cust-1', firstName: 'Tyler', lastName: 'Durden', memberBarcode: 'MBR-00001' }).run();
      db.insert(schema.prepaidPlans).values({ id: 'plan-1', name: '10-Rental Bundle', price: 2999, creditValue: 0, rentalCount: 10, durationDays: 90 }).run();

      db.insert(schema.customerPrepaid).values({
        id: 'cp-1',
        customerId: 'cust-1',
        planId: 'plan-1',
        remainingCredit: 0,
        remainingRentals: 10,
        expiresAt: '2025-04-15T10:00:00Z',
        purchasedAt: '2025-01-15T10:00:00Z',
      }).run();

      const rows = db.select().from(schema.customerPrepaid).where(eq(schema.customerPrepaid.id, 'cp-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].remainingRentals).toBe(10);
    });
  });

  describe('alertConfigs', () => {
    it('inserts an alert config with defaults', () => {
      db.insert(schema.alertConfigs).values({
        id: 'alert-1',
        type: 'overdue',
        template: 'Your rental of {{title}} is overdue.',
      }).run();

      const rows = db.select().from(schema.alertConfigs).where(eq(schema.alertConfigs.id, 'alert-1')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].enabled).toBe(1);
    });
  });

  describe('storeSettings', () => {
    it('inserts and retrieves a store setting', () => {
      db.insert(schema.storeSettings).values({
        key: 'store_name',
        value: 'reRun Video',
      }).run();

      const rows = db.select().from(schema.storeSettings).where(eq(schema.storeSettings.key, 'store_name')).all();
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe('reRun Video');
    });
  });
});
