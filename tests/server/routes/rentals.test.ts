// ABOUTME: Tests for the rentals API routes (checkout, return, overdue, active, history)
// ABOUTME: Validates HTTP status codes, response shapes, and round-trip rental workflows

import { describe, it, expect } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createRentalsRoutes } from '../../../server/routes/rentals.js';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import {
  customers,
  titles,
  copies,
  pricingRules,
  rentals,
  familyMembers,
} from '../../../server/db/schema.js';
import { eq } from 'drizzle-orm';

function buildApp() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  const routes = createRentalsRoutes(db);
  const app = new Hono();
  app.route('/api/rentals', routes);
  return { app, db, sqlite };
}

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
    name: overrides.titleName ?? 'Jaws',
    year: overrides.year ?? 1975,
  });
  const copyId = nanoid();
  await db.insert(copies).values({
    id: copyId,
    titleId,
    barcode: overrides.barcode ?? `BC-${nanoid(6)}`,
    format: overrides.format ?? 'DVD',
    status: overrides.status ?? 'in',
  });
  return { titleId, copyId };
}

async function seedPricingRule(db: any, overrides: Record<string, any> = {}) {
  const id = nanoid();
  await db.insert(pricingRules).values({
    id,
    name: overrides.name ?? '7-Day Rental',
    type: overrides.type ?? 'rental',
    rate: overrides.rate ?? 399,
    durationDays: overrides.durationDays ?? 7,
    lateFeePerDay: overrides.lateFeePerDay ?? 100,
    active: 1,
  });
  return id;
}

describe('Rentals API', () => {
  describe('POST /api/rentals/checkout', () => {
    it('checks out a copy and returns 201', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.customerId).toBe(customerId);
      expect(body.copyId).toBe(copyId);
      expect(body.status).toBe('out');
    });

    it('returns 400 when copy is already out', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db, { status: 'out' });
      const pricingRuleId = await seedPricingRule(db);

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeDefined();
    });

    it('returns 400 when required fields are missing', async () => {
      const { app } = buildApp();

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: 'abc' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/rentals/return', () => {
    it('returns a copy and returns 200 with late fee info', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 30 });

      // Checkout first
      await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId }),
      });

      // Return
      const res = await app.request('/api/rentals/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyId, lateFeeAction: 'pay' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('returned');
      expect(body.returnedAt).toBeDefined();
      expect(body.lateFee).toBe(0);
    });

    it('returns 400 when no active rental for copy', async () => {
      const { app } = buildApp();

      const res = await app.request('/api/rentals/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyId: 'nonexistent', lateFeeAction: 'pay' }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/rentals/overdue', () => {
    it('returns overdue rentals', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      // Create an overdue rental manually
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
      await db.update(copies).set({ status: 'out' }).where(eq(copies.id, copyId));

      const res = await app.request('/api/rentals/overdue');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /api/rentals/active', () => {
    it('returns currently rented copies', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 14 });

      // Checkout
      await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId }),
      });

      const res = await app.request('/api/rentals/active');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data[0].copyId).toBe(copyId);
    });
  });

  describe('age restriction check', () => {
    it('returns ageRestriction warning when minor rents R-rated title', async () => {
      const { app, db } = buildApp();

      // Create minor customer (born 2015)
      const minorCustomer = {
        id: nanoid(),
        firstName: 'Kid',
        lastName: 'McFly',
        memberBarcode: nanoid(10),
        birthday: '2015-06-15',
      };
      await db.insert(customers).values(minorCustomer).run();

      // Create R-rated title and copy
      const titleId = nanoid();
      await db.insert(titles).values({
        id: titleId,
        name: 'Die Hard',
        year: 1988,
        rating: 'R',
      }).run();
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: 'DH-001',
        format: 'DVD',
        status: 'in',
      }).run();

      // Create pricing rule
      const ruleId = nanoid();
      await db.insert(pricingRules).values({
        id: ruleId,
        name: '2-Day',
        type: 'rental',
        rate: 399,
        durationDays: 2,
      }).run();

      // Checkout without approval — should get warning
      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: minorCustomer.id,
          copyId,
          pricingRuleId: ruleId,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ageRestriction).toBeDefined();
      expect(body.ageRestriction.requiresApproval).toBe(true);
      expect(body.ageRestriction.rating).toBe('R');
    });

    it('allows checkout when parentApproved flag is set', async () => {
      const { app, db } = buildApp();

      const minorCustomer = {
        id: nanoid(),
        firstName: 'Kid2',
        lastName: 'McFly',
        memberBarcode: nanoid(10),
        birthday: '2015-06-15',
      };
      await db.insert(customers).values(minorCustomer).run();

      const titleId = nanoid();
      await db.insert(titles).values({
        id: titleId,
        name: 'Terminator 2',
        year: 1991,
        rating: 'R',
      }).run();
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: 'T2-001',
        format: 'DVD',
        status: 'in',
      }).run();

      const ruleId = nanoid();
      await db.insert(pricingRules).values({
        id: ruleId,
        name: '2-Day',
        type: 'rental',
        rate: 399,
        durationDays: 2,
      }).run();

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: minorCustomer.id,
          copyId,
          pricingRuleId: ruleId,
          parentApproved: true,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.status).toBe('out');
    });

    it('returns age restriction warning when minor family member rents R-rated title', async () => {
      const { app, db } = buildApp();

      // Adult customer (born 1980)
      const adultCustomer = {
        id: nanoid(),
        firstName: 'Parent',
        lastName: 'McFly',
        memberBarcode: nanoid(10),
        birthday: '1980-03-15',
      };
      await db.insert(customers).values(adultCustomer).run();

      // Minor family member (born 2015)
      const fmId = nanoid();
      await db.insert(familyMembers).values({
        id: fmId,
        customerId: adultCustomer.id,
        firstName: 'Kid',
        lastName: 'McFly',
        relationship: 'child',
        birthday: '2015-06-15',
      }).run();

      // R-rated title and copy
      const titleId = nanoid();
      await db.insert(titles).values({
        id: titleId,
        name: 'Predator',
        year: 1987,
        rating: 'R',
      }).run();
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: `PR-${nanoid(4)}`,
        format: 'DVD',
        status: 'in',
      }).run();

      const ruleId = nanoid();
      await db.insert(pricingRules).values({
        id: ruleId,
        name: '2-Day',
        type: 'rental',
        rate: 399,
        durationDays: 2,
      }).run();

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: adultCustomer.id,
          copyId,
          pricingRuleId: ruleId,
          familyMemberId: fmId,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ageRestriction).toBeDefined();
      expect(body.ageRestriction.requiresApproval).toBe(true);
    });

    it('allows checkout when adult family member rents R-rated title', async () => {
      const { app, db } = buildApp();

      const customer = {
        id: nanoid(),
        firstName: 'Main',
        lastName: 'Customer',
        memberBarcode: nanoid(10),
        birthday: '1975-01-01',
      };
      await db.insert(customers).values(customer).run();

      // Adult family member (born 1990)
      const fmId = nanoid();
      await db.insert(familyMembers).values({
        id: fmId,
        customerId: customer.id,
        firstName: 'Spouse',
        lastName: 'Customer',
        relationship: 'spouse',
        birthday: '1990-07-20',
      }).run();

      const titleId = nanoid();
      await db.insert(titles).values({
        id: titleId,
        name: 'The Matrix',
        year: 1999,
        rating: 'R',
      }).run();
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: `MX-${nanoid(4)}`,
        format: 'DVD',
        status: 'in',
      }).run();

      const ruleId = nanoid();
      await db.insert(pricingRules).values({
        id: ruleId,
        name: '2-Day',
        type: 'rental',
        rate: 399,
        durationDays: 2,
      }).run();

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          copyId,
          pricingRuleId: ruleId,
          familyMemberId: fmId,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
    });

    it('uses primary customer birthday when no familyMemberId provided', async () => {
      const { app, db } = buildApp();

      // Minor customer (born 2012)
      const minorCustomer = {
        id: nanoid(),
        firstName: 'Young',
        lastName: 'Renter',
        memberBarcode: nanoid(10),
        birthday: '2012-09-01',
      };
      await db.insert(customers).values(minorCustomer).run();

      const titleId = nanoid();
      await db.insert(titles).values({
        id: titleId,
        name: 'Robocop',
        year: 1987,
        rating: 'R',
      }).run();
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: `RC-${nanoid(4)}`,
        format: 'DVD',
        status: 'in',
      }).run();

      const ruleId = nanoid();
      await db.insert(pricingRules).values({
        id: ruleId,
        name: '2-Day',
        type: 'rental',
        rate: 399,
        durationDays: 2,
      }).run();

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: minorCustomer.id,
          copyId,
          pricingRuleId: ruleId,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ageRestriction).toBeDefined();
      expect(body.ageRestriction.requiresApproval).toBe(true);
    });

    it('does not warn for adult renting R-rated title', async () => {
      const { app, db } = buildApp();

      const adultCustomer = {
        id: nanoid(),
        firstName: 'Adult',
        lastName: 'McFly',
        memberBarcode: nanoid(10),
        birthday: '1990-01-01',
      };
      await db.insert(customers).values(adultCustomer).run();

      const titleId = nanoid();
      await db.insert(titles).values({
        id: titleId,
        name: 'Aliens',
        year: 1986,
        rating: 'R',
      }).run();
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: 'AL-001',
        format: 'DVD',
        status: 'in',
      }).run();

      const ruleId = nanoid();
      await db.insert(pricingRules).values({
        id: ruleId,
        name: '2-Day',
        type: 'rental',
        rate: 399,
        durationDays: 2,
      }).run();

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: adultCustomer.id,
          copyId,
          pricingRuleId: ruleId,
        }),
      });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/rentals/customer/:id', () => {
    it('returns rental history for a customer', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 7 });

      // Checkout and return
      await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId }),
      });

      await app.request('/api/rentals/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyId, lateFeeAction: 'pay' }),
      });

      const res = await app.request(`/api/rentals/customer/${customerId}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('returned');
    });

    it('includes family member info in rental history', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 7 });

      // Create a family member
      const fmId = nanoid();
      await db.insert(familyMembers).values({
        id: fmId,
        customerId,
        firstName: 'Junior',
        lastName: 'Hicks',
        relationship: 'son',
      });

      // Checkout with family member
      await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId, familyMemberId: fmId }),
      });

      const res = await app.request(`/api/rentals/customer/${customerId}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].familyMemberFirstName).toBe('Junior');
      expect(body.data[0].familyMemberLastName).toBe('Hicks');
      expect(body.data[0].familyMemberRelationship).toBe('son');
    });

    it('returns null family member fields when no family member on rental', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 7 });

      // Checkout without family member
      await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId }),
      });

      const res = await app.request(`/api/rentals/customer/${customerId}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].familyMemberFirstName).toBeNull();
      expect(body.data[0].familyMemberLastName).toBeNull();
    });
  });

  describe('GET /api/rentals/active', () => {
    it('includes family member info in active rentals', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db, { durationDays: 14 });

      // Create a family member
      const fmId = nanoid();
      await db.insert(familyMembers).values({
        id: fmId,
        customerId,
        firstName: 'Spouse',
        lastName: 'Hicks',
        relationship: 'wife',
      });

      // Checkout with family member
      await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId, familyMemberId: fmId }),
      });

      const res = await app.request('/api/rentals/active');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      const rental = body.data.find((r: any) => r.copyId === copyId);
      expect(rental.familyMemberFirstName).toBe('Spouse');
      expect(rental.familyMemberLastName).toBe('Hicks');
      expect(rental.familyMemberRelationship).toBe('wife');
      expect(rental.customerFirstName).toBe('Dante');
      expect(rental.customerLastName).toBe('Hicks');
    });
  });

  describe('GET /api/rentals/returned-today', () => {
    it('returns 200 with today returned rentals', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const ruleId = await seedPricingRule(db);

      // Checkout then return via API
      await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId: ruleId }),
      });
      await app.request('/api/rentals/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyId }),
      });

      const res = await app.request('/api/rentals/returned-today');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].titleName).toBeDefined();
      expect(body.data[0].copyBarcode).toBeDefined();
    });
  });

  describe('GET /api/rentals/title/:titleId/rented-copies', () => {
    it('returns 200 with rented copies for a title', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId, titleId } = await seedTitleAndCopy(db);
      const ruleId = await seedPricingRule(db);

      await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId, copyId, pricingRuleId: ruleId }),
      });

      const res = await app.request(`/api/rentals/title/${titleId}/rented-copies`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].barcode).toBeDefined();
      expect(body.data[0].customerFirstName).toBeDefined();
    });

    it('returns empty data for title with no rented copies', async () => {
      const { app, db } = buildApp();
      const { titleId } = await seedTitleAndCopy(db);

      const res = await app.request(`/api/rentals/title/${titleId}/rented-copies`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(0);
    });
  });

  describe('GET /api/rentals/overdue', () => {
    it('includes family member info in overdue rentals', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      // Create a family member
      const fmId = nanoid();
      await db.insert(familyMembers).values({
        id: fmId,
        customerId,
        firstName: 'Kid',
        lastName: 'Hicks',
        relationship: 'daughter',
      });

      // Create an overdue rental with family member
      const rentalId = nanoid();
      await db.insert(rentals).values({
        id: rentalId,
        customerId,
        copyId,
        pricingRuleId,
        familyMemberId: fmId,
        checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'out',
      });
      await db.update(copies).set({ status: 'out' }).where(eq(copies.id, copyId));

      const res = await app.request('/api/rentals/overdue');
      expect(res.status).toBe(200);
      const body = await res.json();
      const overdueRental = body.data.find((r: any) => r.id === rentalId);
      expect(overdueRental).toBeDefined();
      expect(overdueRental.familyMemberFirstName).toBe('Kid');
      expect(overdueRental.familyMemberLastName).toBe('Hicks');
      expect(overdueRental.familyMemberRelationship).toBe('daughter');
    });
  });
});
