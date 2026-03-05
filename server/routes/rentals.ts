// ABOUTME: Rental API routes for checkout, return, overdue tracking, and rental history
// ABOUTME: Delegates business logic to the rental service, handles HTTP concerns only

import { Hono } from 'hono';
import { eq, and, count } from 'drizzle-orm';
import { rentals, storeSettings, customers, copies, titles, familyMembers } from '../db/schema.js';
import { checkAgeRestriction } from '../services/age-check.js';
import {
  checkoutCopy,
  returnCopy,
  getOverdueRentals,
  getCustomerRentals,
  getActiveRentals,
} from '../services/rental.js';

export function createRentalsRoutes(db: any) {
  const routes = new Hono();

  // POST /checkout — checkout a copy to a customer
  routes.post('/checkout', async (c) => {
    const body = await c.req.json();

    if (!body.customerId || !body.copyId || !body.pricingRuleId) {
      return c.json(
        { error: 'Missing required fields: customerId, copyId, pricingRuleId' },
        400
      );
    }

    // Check rental limit from settings
    const [maxSetting] = await db.select().from(storeSettings).where(eq(storeSettings.key, 'max_active_rentals'));
    const parsed = maxSetting ? parseInt(maxSetting.value ?? '6', 10) : 6;
    const maxRentals = Number.isNaN(parsed) ? 6 : parsed;
    const [activeCount] = await db
      .select({ count: count() })
      .from(rentals)
      .where(and(eq(rentals.customerId, body.customerId), eq(rentals.status, 'out')));
    if (activeCount.count >= maxRentals) {
      return c.json({ error: `Rental limit reached. Maximum ${maxRentals} active rentals allowed.` }, 400);
    }

    // Age restriction check
    const [copy] = await db.select().from(copies).where(eq(copies.id, body.copyId));
    if (copy) {
      const [title] = await db.select().from(titles).where(eq(titles.id, copy.titleId));
      if (title) {
        let birthdayToCheck: string | null = null;

        if (body.familyMemberId) {
          const [fm] = await db.select().from(familyMembers)
            .where(eq(familyMembers.id, body.familyMemberId));
          birthdayToCheck = fm?.birthday ?? null;
        } else {
          const [cust] = await db.select().from(customers)
            .where(eq(customers.id, body.customerId));
          birthdayToCheck = cust?.birthday ?? null;
        }

        const warning = checkAgeRestriction(birthdayToCheck, title.rating);
        if (warning && !body.parentApproved) {
          return c.json({ ageRestriction: warning }, 200);
        }
      }
    }

    try {
      const rental = await checkoutCopy(db, {
        customerId: body.customerId,
        copyId: body.copyId,
        pricingRuleId: body.pricingRuleId,
        familyMemberId: body.familyMemberId,
      });
      return c.json(rental, 201);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  // POST /return — return a copy
  routes.post('/return', async (c) => {
    const body = await c.req.json();

    if (!body.copyId) {
      return c.json({ error: 'Missing required field: copyId' }, 400);
    }

    const lateFeeAction = body.lateFeeAction ?? 'pay';

    try {
      const rental = await returnCopy(db, {
        copyId: body.copyId,
        lateFeeAction,
      });
      return c.json(rental);
    } catch (err: any) {
      return c.json({ error: err.message }, 400);
    }
  });

  // GET /overdue — list overdue rentals
  routes.get('/overdue', async (c) => {
    const data = await getOverdueRentals(db);
    return c.json({ data });
  });

  // GET /active — all currently rented copies
  routes.get('/active', async (c) => {
    const data = await getActiveRentals(db);
    return c.json({ data });
  });

  // GET /customer/:id — rental history for a customer
  routes.get('/customer/:id', async (c) => {
    const customerId = c.req.param('id');
    const data = await getCustomerRentals(db, customerId);
    return c.json({ data });
  });

  return routes;
}
