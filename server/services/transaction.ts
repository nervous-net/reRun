// ABOUTME: Transaction service handling creation, voiding, tax calculation, and hold/recall
// ABOUTME: Manages sale stock adjustments and rental copy status within SQLite transactions

import { nanoid } from 'nanoid';
import { eq, sql } from 'drizzle-orm';
import {
  transactions,
  transactionItems,
  products,
  copies,
  storeSettings,
} from '../db/schema.js';

// ─── Types ──────────────────────────────────────────────────────────

export interface TransactionItemInput {
  type: string;
  productId?: string;
  copyId?: string;
  rentalId?: string;
  description?: string;
  amount: number;
}

export interface CreateTransactionInput {
  customerId: string;
  type: string;
  paymentMethod: string;
  amountTendered?: number;
  notes?: string;
  items: TransactionItemInput[];
}

interface HeldTransaction {
  holdId: string;
  data: any;
  heldAt: string;
}

// ─── In-memory hold storage ─────────────────────────────────────────

const heldTransactions = new Map<string, { data: any; heldAt: string }>();

export function holdTransaction(holdId: string, data: any): void {
  heldTransactions.set(holdId, {
    data,
    heldAt: new Date().toISOString(),
  });
}

export function getHeldTransactions(): HeldTransaction[] {
  const result: HeldTransaction[] = [];
  for (const [holdId, entry] of heldTransactions.entries()) {
    result.push({ holdId, data: entry.data, heldAt: entry.heldAt });
  }
  return result;
}

export function recallTransaction(holdId: string): any | undefined {
  const entry = heldTransactions.get(holdId);
  if (!entry) return undefined;
  heldTransactions.delete(holdId);
  return entry.data;
}

// ─── Tax calculation ────────────────────────────────────────────────

async function getTaxRate(db: any): Promise<number> {
  const [setting] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, 'tax_rate'));

  if (!setting || !setting.value) return 0;
  return parseInt(setting.value, 10);
}

function calculateTax(subtotal: number, taxRateBasisPoints: number): number {
  return Math.round((subtotal * taxRateBasisPoints) / 10000);
}

// ─── Create Transaction ─────────────────────────────────────────────

export async function createTransaction(db: any, data: CreateTransactionInput) {
  const taxRate = await getTaxRate(db);

  const subtotal = data.items.reduce((sum, item) => sum + item.amount, 0);
  const tax = calculateTax(subtotal, taxRate);
  const total = subtotal + tax;

  const changeGiven =
    data.paymentMethod === 'cash' && data.amountTendered != null
      ? data.amountTendered - total
      : null;

  const txnId = nanoid();

  // Use SQLite transaction for atomicity
  const rawDb = (db as any).session.client;
  const runInTransaction = rawDb.transaction(() => {
    // Insert the transaction record
    db.insert(transactions)
      .values({
        id: txnId,
        customerId: data.customerId,
        type: data.type,
        subtotal,
        tax,
        total,
        paymentMethod: data.paymentMethod,
        amountTendered: data.amountTendered ?? null,
        changeGiven,
        notes: data.notes ?? null,
      })
      .run();

    // Insert line items and apply side effects
    for (const item of data.items) {
      const itemId = nanoid();
      const itemTax = calculateTax(item.amount, taxRate);

      db.insert(transactionItems)
        .values({
          id: itemId,
          transactionId: txnId,
          type: item.type,
          productId: item.productId ?? null,
          copyId: item.copyId ?? null,
          rentalId: item.rentalId ?? null,
          description: item.description ?? null,
          amount: item.amount,
          tax: itemTax,
        })
        .run();

      // Decrement product stock for sale items
      if (item.type === 'sale' && item.productId) {
        db.update(products)
          .set({ stockQty: sql`${products.stockQty} - 1` })
          .where(eq(products.id, item.productId))
          .run();
      }
    }
  });

  runInTransaction();

  // Fetch the created transaction and items
  const [txn] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, txnId));

  const items = await db
    .select()
    .from(transactionItems)
    .where(eq(transactionItems.transactionId, txnId));

  return { ...txn, items };
}

// ─── Void Transaction ───────────────────────────────────────────────

export async function voidTransaction(db: any, transactionId: string, reason: string) {
  const [txn] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId));

  if (!txn) {
    throw new Error('Transaction not found');
  }

  const items = await db
    .select()
    .from(transactionItems)
    .where(eq(transactionItems.transactionId, transactionId));

  const rawDb = (db as any).session.client;
  const runInTransaction = rawDb.transaction(() => {
    // Mark as voided
    db.update(transactions)
      .set({ voided: 1, voidReason: reason })
      .where(eq(transactions.id, transactionId))
      .run();

    // Reverse side effects
    for (const item of items) {
      if (item.type === 'sale' && item.productId) {
        db.update(products)
          .set({ stockQty: sql`${products.stockQty} + 1` })
          .where(eq(products.id, item.productId))
          .run();
      }

      if (item.type === 'rental' && item.copyId) {
        db.update(copies)
          .set({ status: 'in' })
          .where(eq(copies.id, item.copyId))
          .run();
      }
    }
  });

  runInTransaction();

  // Return updated transaction
  const [voided] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId));

  const updatedItems = await db
    .select()
    .from(transactionItems)
    .where(eq(transactionItems.transactionId, transactionId));

  return { ...voided, items: updatedItems };
}
