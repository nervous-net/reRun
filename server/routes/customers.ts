// ABOUTME: Customer API routes for CRUD, search, family members, and balance adjustments
// ABOUTME: Exports a factory function that takes a db instance and returns a Hono router

import { Hono } from 'hono';
import { eq, like, or, sql, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { customers, familyMembers, storeSettings } from '../db/schema.js';

export function createCustomersRoutes(db: any) {
  const routes = new Hono();

  // GET /search — search by name, phone, email, barcode
  // Defined before /:id so it doesn't get captured as an id param
  routes.get('/search', async (c) => {
    const q = c.req.query('q');
    if (!q) {
      return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    const pattern = `%${q}%`;
    const results = await db
      .select()
      .from(customers)
      .where(
        or(
          like(customers.firstName, pattern),
          like(customers.lastName, pattern),
          like(customers.phone, pattern),
          like(customers.email, pattern),
          like(customers.memberBarcode, pattern),
        )
      )
      .all();

    return c.json({ data: results });
  });

  // GET / — list customers (paginated)
  routes.get('/', async (c) => {
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const [totalResult] = await db
      .select({ count: count() })
      .from(customers)
      .all();

    const data = await db
      .select()
      .from(customers)
      .limit(limit)
      .offset(offset)
      .all();

    return c.json({
      data,
      total: totalResult.count,
      page,
      limit,
    });
  });

  // GET /:id — get customer with family members
  routes.get('/:id', async (c) => {
    const id = c.req.param('id');

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .all();

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const family = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.customerId, id))
      .all();

    return c.json({ ...customer, familyMembers: family });
  });

  // POST / — create customer
  routes.post('/', async (c) => {
    const body = await c.req.json();

    if (!body.firstName) {
      return c.json({ error: 'firstName is required' }, 400);
    }
    if (!body.lastName) {
      return c.json({ error: 'lastName is required' }, 400);
    }

    const id = nanoid();
    const memberBarcode = nanoid(10);

    const newCustomer = {
      id,
      memberBarcode,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email || null,
      phone: body.phone || null,
      address: body.address || null,
      birthday: body.birthday || null,
      notes: body.notes || null,
    };

    await db.insert(customers).values(newCustomer).run();

    const [created] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .all();

    return c.json(created, 201);
  });

  // PUT /:id — update customer
  routes.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    const [existing] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .all();

    if (!existing) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const updates: Record<string, any> = {};
    const allowedFields = [
      'firstName', 'lastName', 'email', 'phone',
      'address', 'birthday', 'notes', 'active',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    updates.updatedAt = sql`(datetime('now'))`;

    await db
      .update(customers)
      .set(updates)
      .where(eq(customers.id, id))
      .run();

    const [updated] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .all();

    return c.json(updated);
  });

  // POST /:id/family — add family member
  routes.post('/:id/family', async (c) => {
    const customerId = c.req.param('id');
    const body = await c.req.json();

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, customerId))
      .all();

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    if (!body.firstName) {
      return c.json({ error: 'firstName is required' }, 400);
    }
    if (!body.lastName) {
      return c.json({ error: 'lastName is required' }, 400);
    }

    // Check family member limit from settings
    const [maxSetting] = await db.select().from(storeSettings).where(eq(storeSettings.key, 'max_family_members'));
    const parsed = maxSetting ? parseInt(maxSetting.value ?? '6', 10) : 6;
    const maxMembers = Number.isNaN(parsed) ? 6 : parsed;
    const [memberCount] = await db.select({ count: count() }).from(familyMembers).where(eq(familyMembers.customerId, customerId));
    if (memberCount.count >= maxMembers) {
      return c.json({ error: `Maximum of ${maxMembers} family members allowed` }, 400);
    }

    const id = nanoid();
    const newMember = {
      id,
      customerId,
      firstName: body.firstName,
      lastName: body.lastName,
      relationship: body.relationship || null,
    };

    await db.insert(familyMembers).values(newMember).run();

    const [created] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, id))
      .all();

    return c.json(created, 201);
  });

  // PUT /:id/family/:familyId — update family member
  routes.put('/:id/family/:familyId', async (c) => {
    const customerId = c.req.param('id');
    const familyId = c.req.param('familyId');
    const body = await c.req.json();

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, familyId))
      .all();

    if (!member || member.customerId !== customerId) {
      return c.json({ error: 'Family member not found' }, 404);
    }

    const updates: Record<string, any> = {};
    const allowedFields = ['firstName', 'lastName', 'relationship', 'birthday'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    await db
      .update(familyMembers)
      .set(updates)
      .where(eq(familyMembers.id, familyId))
      .run();

    const [updated] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, familyId))
      .all();

    return c.json(updated);
  });

  // DELETE /:id/family/:familyId — remove family member
  routes.delete('/:id/family/:familyId', async (c) => {
    const familyId = c.req.param('familyId');
    const customerId = c.req.param('id');

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, familyId))
      .all();

    if (!member || member.customerId !== customerId) {
      return c.json({ error: 'Family member not found' }, 404);
    }

    await db
      .delete(familyMembers)
      .where(eq(familyMembers.id, familyId))
      .run();

    return c.json({ success: true });
  });

  // PUT /:id/balance — adjust balance
  routes.put('/:id/balance', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    if (body.amount === undefined || body.amount === null) {
      return c.json({ error: 'amount is required' }, 400);
    }

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .all();

    if (!customer) {
      return c.json({ error: 'Customer not found' }, 404);
    }

    const newBalance = (customer.balance || 0) + body.amount;

    await db
      .update(customers)
      .set({
        balance: newBalance,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(customers.id, id))
      .run();

    const [updated] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id))
      .all();

    return c.json({ ...updated, balanceAdjustReason: body.reason ?? null });
  });

  return routes;
}
