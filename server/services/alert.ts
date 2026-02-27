// ABOUTME: Alert service for detecting overdue rentals, birthday customers, and low stock products
// ABOUTME: Provides query functions used by the alerts dashboard endpoint

import { eq, and, lt, sql } from 'drizzle-orm';
import {
  rentals,
  copies,
  customers,
  titles,
  products,
} from '../db/schema.js';

// ─── Overdue Rentals ────────────────────────────────────────────────

export async function getOverdueRentals(db: any) {
  const now = new Date().toISOString();

  const results = await db
    .select({
      id: rentals.id,
      customerId: rentals.customerId,
      copyId: rentals.copyId,
      pricingRuleId: rentals.pricingRuleId,
      checkedOutAt: rentals.checkedOutAt,
      dueAt: rentals.dueAt,
      status: rentals.status,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      titleName: titles.name,
      copyBarcode: copies.barcode,
      copyFormat: copies.format,
    })
    .from(rentals)
    .innerJoin(customers, eq(rentals.customerId, customers.id))
    .innerJoin(copies, eq(rentals.copyId, copies.id))
    .innerJoin(titles, eq(copies.titleId, titles.id))
    .where(and(eq(rentals.status, 'out'), lt(rentals.dueAt, now)));

  return results;
}

// ─── Birthday Alerts ────────────────────────────────────────────────

export async function getBirthdayAlerts(db: any) {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const mmdd = `${month}-${day}`;

  // Match birthdays stored as YYYY-MM-DD or MM-DD by checking if the string ends with MM-DD
  const results = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      phone: customers.phone,
      birthday: customers.birthday,
    })
    .from(customers)
    .where(
      and(
        eq(customers.active, 1),
        sql`${customers.birthday} LIKE ${'%' + mmdd}`
      )
    );

  return results;
}

// ─── Low Stock Alerts ───────────────────────────────────────────────

export async function getLowStockAlerts(db: any) {
  const results = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.active, 1),
        sql`${products.stockQty} <= ${products.reorderLevel}`
      )
    );

  return results;
}
