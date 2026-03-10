// ABOUTME: E2E tests for return-by-title-search flow
// ABOUTME: Covers title search fallback, copy selection, and today's returns persistence

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, migrateTestDb } from '../setup.js';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import {
  checkoutCopy,
  returnCopy,
  getReturnedToday,
  getRentedCopiesForTitle,
} from '../../server/services/rental.js';
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

async function seedPricingRule(db: any) {
  const id = nanoid();
  await db.insert(pricingRules).values({
    id,
    name: '3-Day Rental',
    type: 'rental',
    rate: 399,
    durationDays: 3,
    lateFeePerDay: 100,
  });
  return id;
}

describe('return by title search flow', () => {
  it('gets rented copies for a title, returns one, and it appears in today returns', async () => {
    const customerId = await seedCustomer(db);
    const ruleId = await seedPricingRule(db);

    const titleId = nanoid();
    await db.insert(titles).values({ id: titleId, name: 'Clerks', year: 1994 });
    const copy1Id = nanoid();
    const copy2Id = nanoid();
    await db.insert(copies).values([
      { id: copy1Id, titleId, barcode: 'BC-CLERKS-1', format: 'DVD', status: 'in' },
      { id: copy2Id, titleId, barcode: 'BC-CLERKS-2', format: 'Blu-ray', status: 'in' },
    ]);

    const customer2Id = await seedCustomer(db, { firstName: 'Randal', lastName: 'Graves' });
    await checkoutCopy(db, { customerId, copyId: copy1Id, pricingRuleId: ruleId });
    await checkoutCopy(db, { customerId: customer2Id, copyId: copy2Id, pricingRuleId: ruleId });

    const rentedCopies = await getRentedCopiesForTitle(db, titleId);
    expect(rentedCopies).toHaveLength(2);

    const returned = await returnCopy(db, { copyId: copy1Id, lateFeeAction: 'pay' });
    expect(returned.status).toBe('returned');

    const remainingCopies = await getRentedCopiesForTitle(db, titleId);
    expect(remainingCopies).toHaveLength(1);
    expect(remainingCopies[0].copyId).toBe(copy2Id);

    const todayReturns = await getReturnedToday(db);
    expect(todayReturns).toHaveLength(1);
    expect(todayReturns[0].titleName).toBe('Clerks');
    expect(todayReturns[0].copyBarcode).toBe('BC-CLERKS-1');
  });

  it('getRentedCopiesForTitle returns copies with customer details', async () => {
    const ruleId = await seedPricingRule(db);
    const titleId = nanoid();
    await db.insert(titles).values({ id: titleId, name: 'Mallrats', year: 1995 });

    const copyId = nanoid();
    await db.insert(copies).values({ id: copyId, titleId, barcode: 'BC-MALL-1', format: 'DVD', status: 'in' });

    const customerId = await seedCustomer(db, { firstName: 'Brodie', lastName: 'Bruce' });
    await checkoutCopy(db, { customerId, copyId, pricingRuleId: ruleId });

    const results = await getRentedCopiesForTitle(db, titleId);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      copyId,
      barcode: 'BC-MALL-1',
      format: 'DVD',
      customerFirstName: 'Brodie',
      customerLastName: 'Bruce',
    });
  });
});
