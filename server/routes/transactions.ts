// ABOUTME: Transaction API routes for creating, viewing, voiding, and holding transactions
// ABOUTME: Delegates business logic to the transaction service, handles HTTP concerns only

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { eq, sql } from 'drizzle-orm';
import { transactions, transactionItems } from '../db/schema.js';
import {
  createTransaction,
  voidTransaction,
  holdTransaction,
  getHeldTransactions,
  recallTransaction,
} from '../services/transaction.js';

export function createTransactionsRoutes(db: any) {
  const routes = new Hono();

  // POST /hold — hold current transaction (before /:id to avoid collision)
  routes.post('/hold', async (c) => {
    const body = await c.req.json();
    const holdId = nanoid();

    holdTransaction(holdId, body);

    return c.json({ holdId }, 201);
  });

  // GET /held — list held transactions
  routes.get('/held', async (c) => {
    const held = getHeldTransactions();
    return c.json({ data: held });
  });

  // POST /recall/:holdId — recall a held transaction
  routes.post('/recall/:holdId', async (c) => {
    const holdId = c.req.param('holdId');
    const data = recallTransaction(holdId);

    if (!data) {
      return c.json({ error: 'Held transaction not found' }, 404);
    }

    return c.json(data);
  });

  // GET / — search transactions by reference code
  routes.get('/', async (c) => {
    const referenceCode = c.req.query('referenceCode');

    if (!referenceCode) {
      return c.json({ data: [] });
    }

    const results = await db
      .select()
      .from(transactions)
      .where(sql`UPPER(${transactions.referenceCode}) = UPPER(${referenceCode})`);

    return c.json({ data: results });
  });

  // POST / — create a transaction
  routes.post('/', async (c) => {
    const body = await c.req.json();

    if (!body.customerId || !body.type || !body.paymentMethod || !body.items) {
      return c.json(
        { error: 'Missing required fields: customerId, type, paymentMethod, items' },
        400
      );
    }

    try {
      const result = await createTransaction(db, body);
      return c.json(result, 201);
    } catch (err: any) {
      return c.json({ error: err.message }, 500);
    }
  });

  // GET /:id — get transaction with items
  routes.get('/:id', async (c) => {
    const id = c.req.param('id');

    const [txn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));

    if (!txn) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    const items = await db
      .select()
      .from(transactionItems)
      .where(eq(transactionItems.transactionId, id));

    return c.json({ ...txn, items });
  });

  // POST /:id/void — void a transaction
  routes.post('/:id/void', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();

    try {
      const result = await voidTransaction(db, id, body.reason || '');
      return c.json(result);
    } catch (err: any) {
      if (err.message === 'Transaction not found') {
        return c.json({ error: 'Transaction not found' }, 404);
      }
      return c.json({ error: err.message }, 500);
    }
  });

  return routes;
}
