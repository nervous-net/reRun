// ABOUTME: End-to-end test for the full checkout flow
// ABOUTME: Covers customer/title/copy setup, checkout via rental service, transaction creation, and DB verification

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, migrateTestDb } from '../setup.js';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { checkoutCopy } from '../../server/services/rental.js';
import { createTransaction } from '../../server/services/transaction.js';
import {
  customers,
  titles,
  copies,
  pricingRules,
  rentals,
  transactions,
  transactionItems,
  storeSettings,
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
    firstName: overrides.firstName ?? 'Ted',
    lastName: overrides.lastName ?? 'Theodore Logan',
    memberBarcode: overrides.memberBarcode ?? `MBR-${nanoid(8)}`,
    balance: overrides.balance ?? 0,
  });
  return id;
}

async function seedTitleAndCopy(db: any, overrides: Record<string, any> = {}) {
  const titleId = nanoid();
  await db.insert(titles).values({
    id: titleId,
    name: overrides.titleName ?? 'Bill & Teds Excellent Adventure',
    year: overrides.year ?? 1989,
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

describe('Checkout Flow E2E', () => {
  it('completes the full checkout flow: setup, checkout, verify, transact', async () => {
    // Step 1: Set up all required records in DB
    const customerId = await seedCustomer(db, {
      firstName: 'Wayne',
      lastName: 'Campbell',
    });
    const { titleId, copyId } = await seedTitleAndCopy(db, {
      titleName: 'Wayne\'s World',
      year: 1992,
      format: 'VHS',
    });
    const pricingRuleId = await seedPricingRule(db, {
      name: '5-Day VHS Rental',
      rate: 299,
      durationDays: 5,
      lateFeePerDay: 100,
    });

    // Verify initial state: copy is 'in'
    const [copyBefore] = await db.select().from(copies).where(eq(copies.id, copyId));
    expect(copyBefore.status).toBe('in');

    // Step 2: Checkout the copy using the rental service
    const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });

    // Step 3: Verify copy status changed to 'out'
    const [copyAfter] = await db.select().from(copies).where(eq(copies.id, copyId));
    expect(copyAfter.status).toBe('out');

    // Step 4: Verify rental record exists with correct data
    expect(rental.id).toBeDefined();
    expect(rental.customerId).toBe(customerId);
    expect(rental.copyId).toBe(copyId);
    expect(rental.pricingRuleId).toBe(pricingRuleId);
    expect(rental.status).toBe('out');
    expect(rental.checkedOutAt).toBeDefined();
    expect(rental.dueAt).toBeDefined();

    // Verify due date is ~5 days from checkout
    const checkedOut = new Date(rental.checkedOutAt);
    const due = new Date(rental.dueAt);
    const diffDays = Math.round((due.getTime() - checkedOut.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(5);

    // Verify the rental is persisted in the DB
    const [dbRental] = await db.select().from(rentals).where(eq(rentals.id, rental.id));
    expect(dbRental).toBeDefined();
    expect(dbRental.status).toBe('out');
    expect(dbRental.customerId).toBe(customerId);

    // Step 5: Create a transaction for this rental
    const txn = await createTransaction(db, {
      customerId,
      type: 'rental',
      paymentMethod: 'cash',
      amountTendered: 500,
      items: [
        {
          type: 'rental',
          copyId,
          rentalId: rental.id,
          description: 'Wayne\'s World - 5 Day VHS Rental',
          amount: 299,
        },
      ],
    });

    // Step 6: Verify transaction record with correct totals
    expect(txn.id).toBeDefined();
    expect(txn.customerId).toBe(customerId);
    expect(txn.type).toBe('rental');
    expect(txn.subtotal).toBe(299);
    expect(txn.total).toBe(299); // no tax configured
    expect(txn.paymentMethod).toBe('cash');
    expect(txn.amountTendered).toBe(500);
    expect(txn.changeGiven).toBe(201);

    // Verify transaction is persisted in DB
    const [dbTxn] = await db.select().from(transactions).where(eq(transactions.id, txn.id));
    expect(dbTxn).toBeDefined();
    expect(dbTxn.subtotal).toBe(299);
    expect(dbTxn.total).toBe(299);

    // Step 7: Verify transaction items linked correctly
    expect(txn.items).toHaveLength(1);
    expect(txn.items[0].type).toBe('rental');
    expect(txn.items[0].copyId).toBe(copyId);
    expect(txn.items[0].rentalId).toBe(rental.id);
    expect(txn.items[0].amount).toBe(299);
    expect(txn.items[0].description).toBe('Wayne\'s World - 5 Day VHS Rental');

    // Also verify in DB
    const dbItems = await db
      .select()
      .from(transactionItems)
      .where(eq(transactionItems.transactionId, txn.id));
    expect(dbItems).toHaveLength(1);
    expect(dbItems[0].transactionId).toBe(txn.id);
    expect(dbItems[0].copyId).toBe(copyId);
    expect(dbItems[0].rentalId).toBe(rental.id);
  });

  it('applies tax to a rental transaction when store tax rate is set', async () => {
    // Set up tax rate (8% = 800 basis points)
    await db.insert(storeSettings).values({ key: 'tax_rate', value: '800' });

    const customerId = await seedCustomer(db);
    const { copyId } = await seedTitleAndCopy(db);
    const pricingRuleId = await seedPricingRule(db, { rate: 500 });

    // Checkout
    const rental = await checkoutCopy(db, { customerId, copyId, pricingRuleId });

    // Create transaction
    const txn = await createTransaction(db, {
      customerId,
      type: 'rental',
      paymentMethod: 'card',
      items: [
        {
          type: 'rental',
          copyId,
          rentalId: rental.id,
          description: 'Rental with tax',
          amount: 500,
        },
      ],
    });

    // Tax: Math.round(500 * 800 / 10000) = Math.round(40) = 40
    expect(txn.subtotal).toBe(500);
    expect(txn.tax).toBe(40);
    expect(txn.total).toBe(540);
    expect(txn.paymentMethod).toBe('card');
    // No change for card payment
    expect(txn.changeGiven).toBeNull();
  });

  it('handles multiple rentals in a single transaction', async () => {
    const customerId = await seedCustomer(db, {
      firstName: 'Marty',
      lastName: 'McFly',
    });
    const { copyId: copyId1 } = await seedTitleAndCopy(db, {
      titleName: 'Back to the Future',
      year: 1985,
      barcode: 'BC-BTTF-001',
    });
    const { copyId: copyId2 } = await seedTitleAndCopy(db, {
      titleName: 'Back to the Future Part II',
      year: 1989,
      barcode: 'BC-BTTF-002',
    });
    const pricingRuleId = await seedPricingRule(db, { rate: 299 });

    // Checkout both copies
    const rental1 = await checkoutCopy(db, { customerId, copyId: copyId1, pricingRuleId });
    const rental2 = await checkoutCopy(db, { customerId, copyId: copyId2, pricingRuleId });

    // Verify both copies are 'out'
    const [copy1] = await db.select().from(copies).where(eq(copies.id, copyId1));
    const [copy2] = await db.select().from(copies).where(eq(copies.id, copyId2));
    expect(copy1.status).toBe('out');
    expect(copy2.status).toBe('out');

    // Create a single transaction for both rentals
    const txn = await createTransaction(db, {
      customerId,
      type: 'rental',
      paymentMethod: 'cash',
      amountTendered: 1000,
      items: [
        {
          type: 'rental',
          copyId: copyId1,
          rentalId: rental1.id,
          description: 'Back to the Future rental',
          amount: 299,
        },
        {
          type: 'rental',
          copyId: copyId2,
          rentalId: rental2.id,
          description: 'Back to the Future Part II rental',
          amount: 299,
        },
      ],
    });

    expect(txn.subtotal).toBe(598);
    expect(txn.total).toBe(598); // no tax
    expect(txn.changeGiven).toBe(402);
    expect(txn.items).toHaveLength(2);

    // Verify both items reference the correct copies and rentals
    const item1 = txn.items.find((i: any) => i.copyId === copyId1);
    const item2 = txn.items.find((i: any) => i.copyId === copyId2);
    expect(item1).toBeDefined();
    expect(item1.rentalId).toBe(rental1.id);
    expect(item2).toBeDefined();
    expect(item2.rentalId).toBe(rental2.id);
  });

  it('prevents double-checkout of the same copy', async () => {
    const customerId = await seedCustomer(db);
    const { copyId } = await seedTitleAndCopy(db);
    const pricingRuleId = await seedPricingRule(db);

    // First checkout succeeds
    await checkoutCopy(db, { customerId, copyId, pricingRuleId });

    // Second checkout should fail because copy is 'out'
    await expect(
      checkoutCopy(db, { customerId, copyId, pricingRuleId })
    ).rejects.toThrow('Copy is not available for checkout');
  });
});
