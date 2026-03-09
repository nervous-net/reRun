// ABOUTME: Tests for the transaction service (create, void, tax calc, hold/recall)
// ABOUTME: Validates stock adjustments, cash change, and in-memory hold storage

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { nanoid } from 'nanoid';
import {
  createTransaction,
  voidTransaction,
  holdTransaction,
  getHeldTransactions,
  recallTransaction,
} from '../../../server/services/transaction.js';
import {
  customers,
  products,
  storeSettings,
  transactions,
  transactionItems,
  copies,
  titles,
  rentals,
} from '../../../server/db/schema.js';
import { eq } from 'drizzle-orm';

function buildTestDb() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  return { db, sqlite };
}

async function seedCustomer(db: any) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: 'Ferris',
    lastName: 'Bueller',
    memberBarcode: nanoid(10),
  });
  return id;
}

async function seedProduct(db: any, overrides: Record<string, any> = {}) {
  const id = nanoid();
  await db.insert(products).values({
    id,
    name: overrides.name ?? 'Microwave Popcorn',
    sku: overrides.sku ?? `SKU-${nanoid(6)}`,
    price: overrides.price ?? 399,
    cost: overrides.cost ?? 150,
    taxRate: overrides.taxRate ?? 0,
    stockQty: overrides.stockQty ?? 10,
  });
  return id;
}

async function seedTaxRate(db: any, rate: number = 800) {
  await db.insert(storeSettings).values({ key: 'tax_rate', value: String(rate) });
}

async function seedCopyWithTitle(db: any, overrides: Record<string, any> = {}) {
  const titleId = nanoid();
  await db.insert(titles).values({
    id: titleId,
    name: 'Die Hard',
    year: 1988,
  });
  const copyId = nanoid();
  await db.insert(copies).values({
    id: copyId,
    titleId,
    barcode: overrides.barcode ?? `BC-${nanoid(6)}`,
    format: overrides.format ?? 'DVD',
    status: overrides.status ?? 'out',
  });
  return { titleId, copyId };
}

describe('Transaction Service', () => {
  describe('createTransaction', () => {
    it('creates a transaction with line items', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db, { stockQty: 10 });
      await seedTaxRate(db, 800);

      const result = await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'cash',
        amountTendered: 500,
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 399 },
        ],
      });

      expect(result.id).toBeDefined();
      expect(result.customerId).toBe(customerId);
      expect(result.type).toBe('sale');
      expect(result.subtotal).toBe(399);
      // Tax: Math.round(399 * 800 / 10000) = Math.round(31.92) = 32
      expect(result.tax).toBe(32);
      expect(result.total).toBe(431);
      expect(result.paymentMethod).toBe('cash');
      expect(result.amountTendered).toBe(500);
      expect(result.changeGiven).toBe(69);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].type).toBe('sale');
      expect(result.items[0].amount).toBe(399);
    });

    it('defaults paymentMethod to cash when not provided', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db, { stockQty: 10 });
      await seedTaxRate(db, 0);

      const result = await createTransaction(db, {
        customerId,
        type: 'sale',
        // No paymentMethod provided
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 399 },
        ],
      });

      expect(result.paymentMethod).toBe('cash');
    });

    it('decrements product stock on sale items', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db, { stockQty: 10 });
      await seedTaxRate(db, 0);

      await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'card',
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 399 },
        ],
      });

      const [product] = await db
        .select()
        .from(products)
        .where(eq(products.id, productId));
      expect(product.stockQty).toBe(9);
    });

    it('calculates tax from store settings', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db);
      await seedTaxRate(db, 925); // 9.25%

      const result = await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'card',
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 1000 },
        ],
      });

      // Tax: Math.round(1000 * 925 / 10000) = Math.round(92.5) = 93
      expect(result.tax).toBe(93);
      expect(result.total).toBe(1093);
    });

    it('defaults to zero tax when store setting is missing', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db);

      const result = await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'card',
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 399 },
        ],
      });

      expect(result.tax).toBe(0);
      expect(result.total).toBe(399);
    });

    it('calculates cash change correctly', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db);
      await seedTaxRate(db, 0);

      const result = await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'cash',
        amountTendered: 2000,
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 399 },
        ],
      });

      expect(result.amountTendered).toBe(2000);
      expect(result.changeGiven).toBe(1601);
    });

    it('handles multiple line items', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId1 = await seedProduct(db, { sku: 'A', stockQty: 5 });
      const productId2 = await seedProduct(db, { sku: 'B', stockQty: 3 });
      await seedTaxRate(db, 800);

      const result = await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'card',
        items: [
          { type: 'sale', productId: productId1, description: 'Item A', amount: 500 },
          { type: 'sale', productId: productId2, description: 'Item B', amount: 300 },
        ],
      });

      expect(result.subtotal).toBe(800);
      // Tax: Math.round(800 * 800 / 10000) = 64
      expect(result.tax).toBe(64);
      expect(result.total).toBe(864);
      expect(result.items).toHaveLength(2);

      // Both products decremented
      const [p1] = await db.select().from(products).where(eq(products.id, productId1));
      const [p2] = await db.select().from(products).where(eq(products.id, productId2));
      expect(p1.stockQty).toBe(4);
      expect(p2.stockQty).toBe(2);
    });

    it('includes a reference code in RN-XXXX format', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db);
      await seedTaxRate(db, 0);

      const result = await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'card',
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 399 },
        ],
      });

      expect(result.referenceCode).toMatch(/^RN-[0-9A-HJ-NP-Z]{4}$/);
    });

    it('does not set change for card payments', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db);
      await seedTaxRate(db, 0);

      const result = await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'card',
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 399 },
        ],
      });

      expect(result.amountTendered).toBeNull();
      expect(result.changeGiven).toBeNull();
    });
  });

  describe('voidTransaction', () => {
    it('marks transaction as voided with reason', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db, { stockQty: 10 });
      await seedTaxRate(db, 0);

      const txn = await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'cash',
        amountTendered: 500,
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 399 },
        ],
      });

      const voided = await voidTransaction(db, txn.id, 'Customer changed mind');
      expect(voided.voided).toBe(1);
      expect(voided.voidReason).toBe('Customer changed mind');
    });

    it('restores product stock on voided sale', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const productId = await seedProduct(db, { stockQty: 10 });
      await seedTaxRate(db, 0);

      const txn = await createTransaction(db, {
        customerId,
        type: 'sale',
        paymentMethod: 'card',
        items: [
          { type: 'sale', productId, description: 'Popcorn', amount: 399 },
        ],
      });

      // Stock went from 10 -> 9 after sale
      const [beforeVoid] = await db.select().from(products).where(eq(products.id, productId));
      expect(beforeVoid.stockQty).toBe(9);

      await voidTransaction(db, txn.id, 'Void test');

      const [afterVoid] = await db.select().from(products).where(eq(products.id, productId));
      expect(afterVoid.stockQty).toBe(10);
    });

    it('sets copy status back to in for rental items', async () => {
      const { db } = buildTestDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedCopyWithTitle(db, { status: 'out' });
      await seedTaxRate(db, 0);

      // Create a rental record
      const rentalId = nanoid();
      await db.insert(rentals).values({
        id: rentalId,
        customerId,
        copyId,
        checkedOutAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'out',
      });

      const txn = await createTransaction(db, {
        customerId,
        type: 'rental',
        paymentMethod: 'card',
        items: [
          { type: 'rental', copyId, rentalId, description: 'Die Hard rental', amount: 299 },
        ],
      });

      await voidTransaction(db, txn.id, 'Void rental');

      const [copy] = await db.select().from(copies).where(eq(copies.id, copyId));
      expect(copy.status).toBe('in');
    });

    it('throws when transaction not found', async () => {
      const { db } = buildTestDb();

      await expect(
        voidTransaction(db, 'nonexistent-id', 'reason')
      ).rejects.toThrow('Transaction not found');
    });
  });

  describe('hold/recall transactions', () => {
    it('holds and recalls a transaction', () => {
      const { db } = buildTestDb();
      const holdData = {
        customerId: 'cust-1',
        items: [{ type: 'sale', description: 'Held item', amount: 500 }],
      };

      holdTransaction(db, 'hold-1', holdData);
      const held = getHeldTransactions(db);
      expect(held).toHaveLength(1);
      expect(held[0].id).toBe('hold-1');
      expect(held[0].customerId).toBe('cust-1');

      const recalled = recallTransaction(db, 'hold-1');
      expect(recalled).toBeDefined();
      expect(recalled!.customerId).toBe('cust-1');

      // After recall, the hold should be removed
      const heldAfter = getHeldTransactions(db);
      expect(heldAfter).toHaveLength(0);
    });

    it('returns undefined when recalling a nonexistent hold', () => {
      const { db } = buildTestDb();
      const result = recallTransaction(db, 'does-not-exist');
      expect(result).toBeUndefined();
    });

    it('can hold multiple transactions', () => {
      const { db } = buildTestDb();

      holdTransaction(db, 'h1', { customerId: 'c1', items: [] });
      holdTransaction(db, 'h2', { customerId: 'c2', items: [] });

      const held = getHeldTransactions(db);
      expect(held).toHaveLength(2);

      // Clean up
      recallTransaction(db, 'h1');
      recallTransaction(db, 'h2');
    });
  });
});
