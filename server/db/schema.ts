// ABOUTME: Drizzle ORM schema definitions for all reRun database tables
// ABOUTME: Stores all amounts in cents (integer) to avoid floating point issues

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── Titles ──────────────────────────────────────────────────────────
export const titles = sqliteTable('titles', {
  id: text('id').primaryKey(),
  tmdbId: integer('tmdb_id'),
  name: text('name').notNull(),
  year: integer('year').notNull(),
  genre: text('genre'),
  runtimeMinutes: integer('runtime_minutes'),
  synopsis: text('synopsis'),
  rating: text('rating'),
  cast: text('cast_list'),
  coverUrl: text('cover_url'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ─── Copies ──────────────────────────────────────────────────────────
export const copies = sqliteTable('copies', {
  id: text('id').primaryKey(),
  titleId: text('title_id').notNull().references(() => titles.id),
  barcode: text('barcode').notNull().unique(),
  format: text('format').notNull(),
  condition: text('condition').default('good'),
  status: text('status').default('in'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── Customers ───────────────────────────────────────────────────────
export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  birthday: text('birthday'),
  notes: text('notes'),
  balance: integer('balance').default(0),
  memberBarcode: text('member_barcode').notNull().unique(),
  active: integer('active').default(1),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

// ─── Family Members ──────────────────────────────────────────────────
export const familyMembers = sqliteTable('family_members', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  relationship: text('relationship'),
});

// ─── Pricing Rules ───────────────────────────────────────────────────
export const pricingRules = sqliteTable('pricing_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  rate: integer('rate').notNull(),
  durationDays: integer('duration_days').notNull(),
  lateFeePerDay: integer('late_fee_per_day').default(0),
  active: integer('active').default(1),
});

// ─── Transactions ────────────────────────────────────────────────────
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  type: text('type').notNull(),
  subtotal: integer('subtotal').notNull(),
  tax: integer('tax').default(0),
  total: integer('total').notNull(),
  paymentMethod: text('payment_method').notNull(),
  amountTendered: integer('amount_tendered'),
  changeGiven: integer('change_given'),
  voided: integer('voided').default(0),
  voidReason: text('void_reason'),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── Rentals ─────────────────────────────────────────────────────────
export const rentals = sqliteTable('rentals', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  copyId: text('copy_id').notNull().references(() => copies.id),
  transactionId: text('transaction_id').references(() => transactions.id),
  pricingRuleId: text('pricing_rule_id').references(() => pricingRules.id),
  checkedOutAt: text('checked_out_at').notNull(),
  dueAt: text('due_at').notNull(),
  returnedAt: text('returned_at'),
  lateFee: integer('late_fee').default(0),
  lateFeeStatus: text('late_fee_status'),
  status: text('status').notNull(),
});

// ─── Products ────────────────────────────────────────────────────────
export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull().unique(),
  price: integer('price').notNull(),
  cost: integer('cost').notNull(),
  taxRate: integer('tax_rate').default(0),
  stockQty: integer('stock_qty').default(0),
  reorderLevel: integer('reorder_level').default(0),
  category: text('category'),
  active: integer('active').default(1),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── Transaction Items ───────────────────────────────────────────────
export const transactionItems = sqliteTable('transaction_items', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().references(() => transactions.id),
  type: text('type').notNull(),
  copyId: text('copy_id').references(() => copies.id),
  productId: text('product_id').references(() => products.id),
  rentalId: text('rental_id').references(() => rentals.id),
  description: text('description'),
  amount: integer('amount').notNull(),
  tax: integer('tax').default(0),
});

// ─── Reservations ────────────────────────────────────────────────────
export const reservations = sqliteTable('reservations', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  titleId: text('title_id').notNull().references(() => titles.id),
  reservedAt: text('reserved_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  fulfilled: integer('fulfilled').default(0),
  notified: integer('notified').default(0),
});

// ─── Promotions ──────────────────────────────────────────────────────
export const promotions = sqliteTable('promotions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  rules: text('rules'),
  startDate: text('start_date'),
  endDate: text('end_date'),
  active: integer('active').default(1),
});

// ─── Prepaid Plans ───────────────────────────────────────────────────
export const prepaidPlans = sqliteTable('prepaid_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  creditValue: integer('credit_value').notNull(),
  rentalCount: integer('rental_count').notNull(),
  durationDays: integer('duration_days').notNull(),
  active: integer('active').default(1),
});

// ─── Customer Prepaid ────────────────────────────────────────────────
export const customerPrepaid = sqliteTable('customer_prepaid', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  planId: text('plan_id').notNull().references(() => prepaidPlans.id),
  remainingCredit: integer('remaining_credit').notNull(),
  remainingRentals: integer('remaining_rentals').notNull(),
  expiresAt: text('expires_at').notNull(),
  purchasedAt: text('purchased_at').notNull(),
});

// ─── Alert Configs ───────────────────────────────────────────────────
export const alertConfigs = sqliteTable('alert_configs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  template: text('template').notNull(),
  enabled: integer('enabled').default(1),
});

// ─── Store Settings ──────────────────────────────────────────────────
export const storeSettings = sqliteTable('store_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});
