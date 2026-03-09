// ABOUTME: Transaction service handling creation, voiding, tax calculation, and hold/recall
// ABOUTME: Manages sale stock adjustments and rental copy status within SQLite transactions

import { nanoid } from 'nanoid';
import { generateReferenceCode } from './reference-code.js';
import { eq, and, sql } from 'drizzle-orm';
import {
  transactions,
  transactionItems,
  products,
  copies,
  rentals,
  storeSettings,
  heldTransactions as heldTransactionsTable,
} from '../db/schema.js';
import { getNow } from '../lib/date.js';

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
  paymentMethod?: string;
  amountTendered?: number;
  notes?: string;
  items: TransactionItemInput[];
}

interface HeldTransactionEntry {
  data: any;
  heldAt: string;
}

interface HeldTransactionSummary {
  id: string;
  customerId: string | null;
  customerName: string | null;
  itemCount: number;
  total: number;
  heldAt: string;
}

// ─── DB-backed hold storage ─────────────────────────────────────────

export function holdTransaction(db: any, holdId: string, data: any): void {
  db.insert(heldTransactionsTable).values({
    id: holdId,
    data: JSON.stringify(data),
    heldAt: getNow(db).toISOString(),
  }).run();
}

export function getHeldTransactions(db: any): HeldTransactionSummary[] {
  const rows = db.select().from(heldTransactionsTable).all();
  return rows.map((row: any) => {
    const data = JSON.parse(row.data);
    return {
      id: row.id,
      customerId: data.customerId ?? null,
      customerName: data.customerName ?? null,
      itemCount: Array.isArray(data.items) ? data.items.length : 0,
      total: data.total ?? 0,
      heldAt: row.heldAt,
    };
  });
}

export function recallTransaction(db: any, holdId: string): any | undefined {
  const [row] = db.select().from(heldTransactionsTable)
    .where(eq(heldTransactionsTable.id, holdId)).all();
  if (!row) return undefined;
  db.delete(heldTransactionsTable).where(eq(heldTransactionsTable.id, holdId)).run();
  return JSON.parse(row.data);
}

// ─── Tax calculation ────────────────────────────────────────────────

async function getTaxRate(db: any): Promise<number> {
  const [setting] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.key, 'tax_rate'));

  if (!setting || !setting.value) return 0;
  return Number(setting.value) || 0;
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
  const referenceCode = generateReferenceCode();

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
        paymentMethod: data.paymentMethod ?? 'cash',
        amountTendered: data.amountTendered ?? null,
        changeGiven,
        notes: data.notes ?? null,
        referenceCode,
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
        // Check stock availability before decrementing
        const [product] = db.select().from(products).where(eq(products.id, item.productId)).all();
        if (product && product.stockQty <= 0) {
          throw new Error(`Product ${product.name} is out of stock`);
        }

        db.update(products)
          .set({ stockQty: sql`${products.stockQty} - 1` })
          .where(eq(products.id, item.productId))
          .run();
      }

      // Link rental record to this transaction
      if (item.type === 'rental' && item.copyId) {
        db.update(rentals)
          .set({ transactionId: txnId })
          .where(and(eq(rentals.copyId, item.copyId), eq(rentals.status, 'out')))
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

  if (txn.voided) {
    throw new Error('Transaction is already voided');
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
        // Only revert copy status if no newer active rental exists for this copy
        const activeRentals = db.select({ id: rentals.id })
          .from(rentals)
          .where(and(eq(rentals.copyId, item.copyId), eq(rentals.status, 'out')))
          .all();
        const hasNewerRental = activeRentals.some((r: any) => r.id !== item.rentalId);
        if (!hasNewerRental) {
          db.update(copies)
            .set({ status: 'in' })
            .where(eq(copies.id, item.copyId))
            .run();
        }

        // Find and reverse the rental for this copy
        if (item.rentalId) {
          db.update(rentals)
            .set({ status: 'returned', returnedAt: new Date().toISOString() })
            .where(eq(rentals.id, item.rentalId))
            .run();
        }
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
