// ABOUTME: Tests for the customers API routes (CRUD, search, family members, balance)
// ABOUTME: Validates all customer endpoints using in-memory SQLite test database

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createCustomersRoutes } from '../../../server/routes/customers.js';
import { customers, familyMembers } from '../../../server/db/schema.js';
import { nanoid } from 'nanoid';

let db: ReturnType<typeof createTestDb>['db'];
let sqlite: ReturnType<typeof createTestDb>['sqlite'];
let app: Hono;

beforeAll(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);

  const routes = createCustomersRoutes(db);
  app = new Hono();
  app.route('/api/customers', routes);
});

beforeEach(() => {
  // Clear tables between tests
  sqlite.exec('DELETE FROM family_members');
  sqlite.exec('DELETE FROM customers');
});

describe('POST /api/customers', () => {
  it('creates a customer and auto-generates id and memberBarcode', async () => {
    const res = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Marty',
        lastName: 'McFly',
        email: 'marty@hillvalley.com',
        phone: '555-0100',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.id.length).toBe(21); // default nanoid length
    expect(body.memberBarcode).toBeDefined();
    expect(body.memberBarcode.length).toBe(10); // short barcode
    expect(body.firstName).toBe('Marty');
    expect(body.lastName).toBe('McFly');
    expect(body.email).toBe('marty@hillvalley.com');
    expect(body.phone).toBe('555-0100');
    expect(body.balance).toBe(0);
    expect(body.active).toBe(1);
  });

  it('returns 400 if firstName is missing', async () => {
    const res = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastName: 'McFly' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 if lastName is missing', async () => {
    const res = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Marty' }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('GET /api/customers', () => {
  it('lists customers with pagination', async () => {
    // Insert 3 customers directly
    for (let i = 0; i < 3; i++) {
      db.insert(customers).values({
        id: nanoid(),
        firstName: `Customer${i}`,
        lastName: 'Test',
        memberBarcode: nanoid(10),
      }).run();
    }

    const res = await app.request('/api/customers?page=1&limit=2');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(3);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(2);
  });

  it('defaults to page 1 and limit 20', async () => {
    db.insert(customers).values({
      id: nanoid(),
      firstName: 'Solo',
      lastName: 'Customer',
      memberBarcode: nanoid(10),
    }).run();

    const res = await app.request('/api/customers');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.data).toHaveLength(1);
  });
});

describe('GET /api/customers/:id', () => {
  it('returns a customer with family members', async () => {
    const customerId = nanoid();
    db.insert(customers).values({
      id: customerId,
      firstName: 'Doc',
      lastName: 'Brown',
      email: 'doc@hillvalley.com',
      memberBarcode: nanoid(10),
    }).run();

    db.insert(familyMembers).values({
      id: nanoid(),
      customerId,
      firstName: 'Clara',
      lastName: 'Brown',
      relationship: 'spouse',
    }).run();

    const res = await app.request(`/api/customers/${customerId}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.firstName).toBe('Doc');
    expect(body.lastName).toBe('Brown');
    expect(body.familyMembers).toHaveLength(1);
    expect(body.familyMembers[0].firstName).toBe('Clara');
    expect(body.familyMembers[0].relationship).toBe('spouse');
  });

  it('returns 404 for non-existent customer', async () => {
    const res = await app.request('/api/customers/nonexistent-id');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('GET /api/customers/search', () => {
  beforeEach(() => {
    // Seed some customers for search
    const testCustomers = [
      { id: nanoid(), firstName: 'Marty', lastName: 'McFly', email: 'marty@hillvalley.com', phone: '555-0100', memberBarcode: 'BARCODE0001' },
      { id: nanoid(), firstName: 'Doc', lastName: 'Brown', email: 'doc@time.com', phone: '555-0200', memberBarcode: 'BARCODE0002' },
      { id: nanoid(), firstName: 'Biff', lastName: 'Tannen', email: 'biff@biff.com', phone: '555-0300', memberBarcode: 'BARCODE0003' },
    ];

    for (const c of testCustomers) {
      db.insert(customers).values(c).run();
    }
  });

  it('searches by first name', async () => {
    const res = await app.request('/api/customers/search?q=Marty');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].firstName).toBe('Marty');
  });

  it('searches by last name', async () => {
    const res = await app.request('/api/customers/search?q=Brown');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].lastName).toBe('Brown');
  });

  it('searches by phone number', async () => {
    const res = await app.request('/api/customers/search?q=555-0300');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].firstName).toBe('Biff');
  });

  it('searches by email', async () => {
    const res = await app.request('/api/customers/search?q=doc@time');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].firstName).toBe('Doc');
  });

  it('searches by barcode', async () => {
    const res = await app.request('/api/customers/search?q=BARCODE0001');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].firstName).toBe('Marty');
  });

  it('returns empty results for no match', async () => {
    const res = await app.request('/api/customers/search?q=Lorraine');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });

  it('returns 400 if q is missing', async () => {
    const res = await app.request('/api/customers/search');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});

describe('PUT /api/customers/:id', () => {
  it('updates a customer', async () => {
    const customerId = nanoid();
    db.insert(customers).values({
      id: customerId,
      firstName: 'Marty',
      lastName: 'McFly',
      memberBarcode: nanoid(10),
    }).run();

    const res = await app.request(`/api/customers/${customerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'marty@future.com',
        phone: '555-9999',
        notes: 'Great Scott!',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe('marty@future.com');
    expect(body.phone).toBe('555-9999');
    expect(body.notes).toBe('Great Scott!');
    // Original fields should be preserved
    expect(body.firstName).toBe('Marty');
    expect(body.lastName).toBe('McFly');
  });

  it('returns 404 for non-existent customer', async () => {
    const res = await app.request('/api/customers/nonexistent-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com' }),
    });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/customers/:id/family', () => {
  it('adds a family member', async () => {
    const customerId = nanoid();
    db.insert(customers).values({
      id: customerId,
      firstName: 'Doc',
      lastName: 'Brown',
      memberBarcode: nanoid(10),
    }).run();

    const res = await app.request(`/api/customers/${customerId}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Jules',
        lastName: 'Brown',
        relationship: 'son',
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeDefined();
    expect(body.firstName).toBe('Jules');
    expect(body.lastName).toBe('Brown');
    expect(body.relationship).toBe('son');
    expect(body.customerId).toBe(customerId);
  });

  it('returns 400 if firstName is missing', async () => {
    const customerId = nanoid();
    db.insert(customers).values({
      id: customerId,
      firstName: 'Doc',
      lastName: 'Brown',
      memberBarcode: nanoid(10),
    }).run();

    const res = await app.request(`/api/customers/${customerId}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastName: 'Brown' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent customer', async () => {
    const res = await app.request('/api/customers/nonexistent-id/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Jules', lastName: 'Brown' }),
    });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/customers/:id/family/:familyId', () => {
  it('removes a family member', async () => {
    const customerId = nanoid();
    const familyId = nanoid();
    db.insert(customers).values({
      id: customerId,
      firstName: 'Doc',
      lastName: 'Brown',
      memberBarcode: nanoid(10),
    }).run();

    db.insert(familyMembers).values({
      id: familyId,
      customerId,
      firstName: 'Verne',
      lastName: 'Brown',
      relationship: 'son',
    }).run();

    const res = await app.request(`/api/customers/${customerId}/family/${familyId}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify deletion
    const getRes = await app.request(`/api/customers/${customerId}`);
    const customer = await getRes.json();
    expect(customer.familyMembers).toHaveLength(0);
  });

  it('returns 404 for non-existent family member', async () => {
    const customerId = nanoid();
    db.insert(customers).values({
      id: customerId,
      firstName: 'Doc',
      lastName: 'Brown',
      memberBarcode: nanoid(10),
    }).run();

    const res = await app.request(`/api/customers/${customerId}/family/nonexistent-id`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/customers/:id/balance', () => {
  it('adds credit to balance', async () => {
    const customerId = nanoid();
    db.insert(customers).values({
      id: customerId,
      firstName: 'Marty',
      lastName: 'McFly',
      memberBarcode: nanoid(10),
      balance: 0,
    }).run();

    const res = await app.request(`/api/customers/${customerId}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, reason: 'Store credit' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(500);
  });

  it('deducts from balance', async () => {
    const customerId = nanoid();
    db.insert(customers).values({
      id: customerId,
      firstName: 'Marty',
      lastName: 'McFly',
      memberBarcode: nanoid(10),
      balance: 1000,
    }).run();

    const res = await app.request(`/api/customers/${customerId}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -300, reason: 'Late fee applied' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(700);
  });

  it('returns 400 if amount is missing', async () => {
    const customerId = nanoid();
    db.insert(customers).values({
      id: customerId,
      firstName: 'Marty',
      lastName: 'McFly',
      memberBarcode: nanoid(10),
    }).run();

    const res = await app.request(`/api/customers/${customerId}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'No amount' }),
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 for non-existent customer', async () => {
    const res = await app.request('/api/customers/nonexistent-id/balance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, reason: 'Test' }),
    });

    expect(res.status).toBe(404);
  });
});
