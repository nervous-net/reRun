// ABOUTME: Rental API routes for checkout, return, overdue tracking, and rental history
// ABOUTME: Delegates business logic to the rental service, handles HTTP concerns only

import { Hono } from 'hono';
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

    try {
      const rental = await checkoutCopy(db, {
        customerId: body.customerId,
        copyId: body.copyId,
        pricingRuleId: body.pricingRuleId,
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
