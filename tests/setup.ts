// ABOUTME: Global test setup for Vitest
// ABOUTME: Creates in-memory SQLite database and applies schema for each test run

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../server/db/schema.js';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export function migrateTestDb(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS titles (
      id TEXT PRIMARY KEY,
      tmdb_id INTEGER,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      genre TEXT,
      runtime_minutes INTEGER,
      synopsis TEXT,
      rating TEXT,
      cast_list TEXT,
      director TEXT,
      cover_url TEXT,
      media_type TEXT DEFAULT 'movie',
      number_of_seasons INTEGER,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS copies (
      id TEXT PRIMARY KEY,
      title_id TEXT NOT NULL REFERENCES titles(id),
      barcode TEXT NOT NULL UNIQUE,
      format TEXT NOT NULL,
      condition TEXT DEFAULT 'good',
      status TEXT DEFAULT 'in',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      birthday TEXT,
      notes TEXT,
      balance INTEGER DEFAULT 0,
      member_barcode TEXT NOT NULL UNIQUE,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      relationship TEXT,
      birthday TEXT,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS pricing_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      rate INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      late_fee_per_day INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      type TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      tax INTEGER DEFAULT 0,
      total INTEGER NOT NULL,
      payment_method TEXT,
      amount_tendered INTEGER,
      change_given INTEGER,
      voided INTEGER DEFAULT 0,
      void_reason TEXT,
      notes TEXT,
      reference_code TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      family_member_id TEXT REFERENCES family_members(id),
      copy_id TEXT NOT NULL REFERENCES copies(id),
      transaction_id TEXT REFERENCES transactions(id),
      pricing_rule_id TEXT REFERENCES pricing_rules(id),
      checked_out_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      returned_at TEXT,
      late_fee INTEGER DEFAULT 0,
      late_fee_status TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      price INTEGER NOT NULL,
      cost INTEGER NOT NULL,
      tax_rate INTEGER DEFAULT 0,
      stock_qty INTEGER DEFAULT 0,
      reorder_level INTEGER DEFAULT 0,
      category TEXT,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL REFERENCES transactions(id),
      type TEXT NOT NULL,
      copy_id TEXT REFERENCES copies(id),
      product_id TEXT REFERENCES products(id),
      rental_id TEXT REFERENCES rentals(id),
      description TEXT,
      amount INTEGER NOT NULL,
      tax INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      title_id TEXT NOT NULL REFERENCES titles(id),
      reserved_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      fulfilled INTEGER DEFAULT 0,
      notified INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      rules TEXT,
      start_date TEXT,
      end_date TEXT,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS prepaid_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      credit_value INTEGER NOT NULL,
      rental_count INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS customer_prepaid (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      plan_id TEXT NOT NULL REFERENCES prepaid_plans(id),
      remaining_credit INTEGER NOT NULL,
      remaining_rentals INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      purchased_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_configs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      template TEXT NOT NULL,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS held_transactions (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      held_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS copies_title_id_idx ON copies(title_id);
    CREATE INDEX IF NOT EXISTS copies_status_idx ON copies(status);
    CREATE INDEX IF NOT EXISTS family_members_customer_id_idx ON family_members(customer_id);
    CREATE INDEX IF NOT EXISTS rentals_customer_id_idx ON rentals(customer_id);
    CREATE INDEX IF NOT EXISTS rentals_copy_id_idx ON rentals(copy_id);
    CREATE INDEX IF NOT EXISTS rentals_status_idx ON rentals(status);
    CREATE INDEX IF NOT EXISTS transaction_items_transaction_id_idx ON transaction_items(transaction_id);
    CREATE INDEX IF NOT EXISTS reservations_customer_id_idx ON reservations(customer_id);
    CREATE INDEX IF NOT EXISTS reservations_title_id_idx ON reservations(title_id);
  `);
}
