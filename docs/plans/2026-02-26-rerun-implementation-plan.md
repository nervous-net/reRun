# reRun Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first video rental POS system that imports 1,700+ titles from CSV, enriches them via TMDb, and handles the full rental lifecycle — ready for store launch on March 14, 2026.

**Architecture:** TypeScript monorepo with a Hono backend serving a React frontend. SQLite via Drizzle ORM for persistence. Single Node.js process serves API + static files in production. Vite for frontend builds. PM2 for process management.

**Tech Stack:** Node.js, TypeScript, Hono, React, SQLite (better-sqlite3), Drizzle ORM, Vite, Vitest, TMDb API, PM2

**Design Doc:** `docs/plans/2026-02-26-video-rental-pos-design.md`

---

## Project Structure

```
rerun/
├── package.json
├── tsconfig.json
├── tsconfig.server.json
├── vite.config.ts
├── drizzle.config.ts
├── vitest.config.ts
├── .env
├── .env.example
├── server/
│   ├── index.ts                 ← Entry point: starts Hono, serves static + API
│   ├── app.ts                   ← Hono app definition (routes mounted here)
│   ├── db/
│   │   ├── index.ts             ← DB connection (better-sqlite3 + Drizzle)
│   │   ├── schema.ts            ← All Drizzle table definitions
│   │   └── seed.ts              ← Dev seed data
│   ├── routes/
│   │   ├── titles.ts
│   │   ├── copies.ts
│   │   ├── customers.ts
│   │   ├── rentals.ts
│   │   ├── transactions.ts
│   │   ├── products.ts
│   │   ├── reservations.ts
│   │   ├── pricing.ts
│   │   ├── promotions.ts
│   │   ├── alerts.ts
│   │   ├── import.ts
│   │   ├── search.ts
│   │   └── backup.ts
│   └── services/
│       ├── tmdb.ts              ← TMDb API client with caching
│       ├── csv-import.ts        ← CSV parsing + column detection
│       ├── rental.ts            ← Checkout/return/late fee logic
│       ├── transaction.ts       ← Transaction creation + payment
│       ├── barcode.ts           ← Barcode generation
│       └── alert.ts             ← Alert detection + email
├── client/
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx              ← Router + layout
│       ├── api/
│       │   └── client.ts        ← Typed fetch wrapper for all API calls
│       ├── components/
│       │   ├── crt/             ← CRT theme primitives
│       │   │   ├── CRTScreen.tsx
│       │   │   ├── Scanlines.tsx
│       │   │   └── GlowText.tsx
│       │   ├── pos/
│       │   │   ├── POSScreen.tsx
│       │   │   ├── TransactionPanel.tsx
│       │   │   ├── CustomerBar.tsx
│       │   │   ├── PaymentModal.tsx
│       │   │   ├── HeldTransactions.tsx
│       │   │   └── Receipt.tsx
│       │   ├── inventory/
│       │   │   ├── InventoryBrowser.tsx
│       │   │   ├── TitleCard.tsx
│       │   │   ├── TitleDetail.tsx
│       │   │   └── TitleForm.tsx
│       │   ├── customers/
│       │   │   ├── CustomerSearch.tsx
│       │   │   ├── CustomerCard.tsx
│       │   │   └── CustomerForm.tsx
│       │   ├── import/
│       │   │   ├── ImportWizard.tsx
│       │   │   ├── FileUpload.tsx
│       │   │   ├── ColumnMapper.tsx
│       │   │   ├── MatchReview.tsx
│       │   │   └── ImportProgress.tsx
│       │   ├── rentals/
│       │   │   ├── ReturnScreen.tsx
│       │   │   └── ReservationList.tsx
│       │   ├── dashboard/
│       │   │   └── Dashboard.tsx
│       │   └── common/
│       │       ├── Button.tsx
│       │       ├── Input.tsx
│       │       ├── Modal.tsx
│       │       ├── Table.tsx
│       │       ├── Select.tsx
│       │       ├── Badge.tsx
│       │       ├── Alert.tsx
│       │       └── Layout.tsx
│       ├── hooks/
│       │   ├── useKeyboardShortcuts.ts
│       │   ├── useBarcodeScanner.ts
│       │   └── useApi.ts
│       └── styles/
│           ├── crt.css          ← Scanlines, glow, curvature
│           ├── global.css       ← Reset, base styles, fonts
│           └── variables.css    ← CSS custom properties (colors, spacing)
├── tests/
│   ├── setup.ts                 ← Test DB setup/teardown helpers
│   ├── server/
│   │   ├── services/
│   │   │   ├── tmdb.test.ts
│   │   │   ├── csv-import.test.ts
│   │   │   ├── rental.test.ts
│   │   │   ├── transaction.test.ts
│   │   │   └── barcode.test.ts
│   │   └── routes/
│   │       ├── titles.test.ts
│   │       ├── copies.test.ts
│   │       ├── customers.test.ts
│   │       ├── rentals.test.ts
│   │       ├── transactions.test.ts
│   │       ├── import.test.ts
│   │       └── search.test.ts
│   └── client/
│       ├── components/
│       │   ├── pos/
│       │   │   └── POSScreen.test.tsx
│       │   ├── import/
│       │   │   └── ImportWizard.test.tsx
│       │   └── customers/
│       │       └── CustomerSearch.test.tsx
│       └── hooks/
│           ├── useKeyboardShortcuts.test.ts
│           └── useBarcodeScanner.test.ts
└── scripts/
    └── setup.ts                 ← First-run setup (create DB, prompt for TMDb key)
```

---

## Phase 1: Foundation (Tasks 1–3)

### Task 1: Project Scaffold & Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.server.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `drizzle.config.ts`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `server/index.ts`
- Create: `server/app.ts`
- Create: `client/index.html`
- Create: `client/src/main.tsx`
- Create: `client/src/App.tsx`

**Step 1: Initialize project**

```bash
cd /Users/nervous-mini/Dev/CRTvideo
git init
```

**Step 2: Create package.json**

```json
{
  "name": "rerun",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite",
    "build": "vite build && tsc -p tsconfig.server.json",
    "start": "node dist/server/index.js",
    "test": "vitest",
    "test:run": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "setup": "tsx scripts/setup.ts"
  },
  "dependencies": {
    "hono": "^4",
    "@hono/node-server": "^1",
    "better-sqlite3": "^11",
    "drizzle-orm": "^0.39",
    "csv-parse": "^5",
    "nanoid": "^5",
    "dotenv": "^16"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^4",
    "concurrently": "^9",
    "drizzle-kit": "^0.30",
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^7",
    "tsx": "^4",
    "typescript": "^5",
    "vite": "^6",
    "vitest": "^3",
    "@testing-library/react": "^16",
    "@testing-library/jest-dom": "^6",
    "jsdom": "^25"
  }
}
```

**Step 3: Create TypeScript configs**

`tsconfig.json` — shared base config:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@server/*": ["./server/*"],
      "@client/*": ["./client/src/*"]
    }
  },
  "include": ["server/**/*", "client/src/**/*", "tests/**/*"]
}
```

`tsconfig.server.json` — server build config:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "jsx": "react-jsx"
  },
  "include": ["server/**/*"]
}
```

**Step 4: Create Vite config**

`vite.config.ts`:
```ts
// ABOUTME: Vite configuration for the reRun frontend
// ABOUTME: Proxies API calls to the Hono backend in development

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'client',
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@client': path.resolve(__dirname, 'client/src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:1987',
        changeOrigin: true,
      },
    },
  },
});
```

**Step 5: Create Vitest config**

`vitest.config.ts`:
```ts
// ABOUTME: Vitest configuration for reRun test suite
// ABOUTME: Handles both server (Node) and client (jsdom) test environments

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['tests/client/**', 'jsdom'],
    ],
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, 'server'),
      '@client': path.resolve(__dirname, 'client/src'),
    },
  },
});
```

**Step 6: Create Drizzle config**

`drizzle.config.ts`:
```ts
// ABOUTME: Drizzle Kit configuration for SQLite migrations
// ABOUTME: Points to schema definition and local SQLite database file

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/rerun.db',
  },
});
```

**Step 7: Create .env.example and .gitignore**

`.env.example`:
```
TMDB_API_KEY=your_tmdb_api_key_here
PORT=1987
DB_PATH=./data/rerun.db
```

`.gitignore`:
```
node_modules/
dist/
data/
.env
*.db
*.db-journal
*.db-wal
.DS_Store
```

**Step 8: Create minimal server entry point**

`server/index.ts`:
```ts
// ABOUTME: Entry point for the reRun server process
// ABOUTME: Starts Hono on port 1987, serves API and static frontend

import { serve } from '@hono/node-server';
import { app } from './app.js';
import 'dotenv/config';

const port = parseInt(process.env.PORT || '1987', 10);

serve({ fetch: app.fetch, port }, () => {
  console.log(`reRun is running on http://localhost:${port}`);
});
```

`server/app.ts`:
```ts
// ABOUTME: Hono application definition with all route mounts
// ABOUTME: Serves API routes under /api and static frontend in production

import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

const app = new Hono();

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok', name: 'reRun', version: '0.1.0' }));

// In production, serve the built frontend
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/client' }));
}

export { app };
```

**Step 9: Create minimal React app**

`client/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>reRun</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`client/src/main.tsx`:
```tsx
// ABOUTME: React app entry point for reRun
// ABOUTME: Mounts the root App component to the DOM

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`client/src/App.tsx`:
```tsx
// ABOUTME: Root React component with router setup
// ABOUTME: Defines top-level routes for all reRun screens

export function App() {
  return (
    <div>
      <h1>reRun</h1>
      <p>Video Rental POS System</p>
    </div>
  );
}
```

**Step 10: Create test setup**

`tests/setup.ts`:
```ts
// ABOUTME: Global test setup for Vitest
// ABOUTME: Creates in-memory SQLite database for each test run

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
```

**Step 11: Install dependencies and verify**

```bash
npm install
```

**Step 12: Write a smoke test**

`tests/server/routes/health.test.ts`:
```ts
// ABOUTME: Smoke test for the health check endpoint
// ABOUTME: Verifies the server starts and responds correctly

import { describe, it, expect } from 'vitest';
import { app } from '../../server/app.js';

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok', name: 'reRun', version: '0.1.0' });
  });
});
```

**Step 13: Run test to verify it passes**

```bash
npx vitest run tests/server/routes/health.test.ts
```
Expected: PASS

**Step 14: Commit**

```bash
git add -A
git commit -m "feat: scaffold reRun project with Hono, React, SQLite, Vite"
```

---

### Task 2: Database Schema & Migrations

**Files:**
- Create: `server/db/schema.ts`
- Create: `server/db/index.ts`
- Modify: `tests/setup.ts`
- Create: `tests/server/db/schema.test.ts`

**Step 1: Write the schema test**

`tests/server/db/schema.test.ts`:
```ts
// ABOUTME: Tests that all database tables can be created and accept data
// ABOUTME: Validates schema constraints, relationships, and defaults

import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb, migrateTestDb } from '../../setup.js';
import * as schema from '../../../server/db/schema.js';

describe('Database Schema', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  let sqlite: ReturnType<typeof createTestDb>['sqlite'];

  beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    sqlite = testDb.sqlite;
    migrateTestDb(sqlite);
  });

  describe('titles', () => {
    it('creates a title with all fields', () => {
      const result = db.insert(schema.titles).values({
        name: 'The Matrix',
        year: 1999,
        tmdbId: 603,
        genre: 'Action, Sci-Fi',
        runtimeMinutes: 136,
        synopsis: 'A computer hacker learns about the true nature of reality.',
        rating: 'R',
        cast: 'Keanu Reeves, Laurence Fishburne',
        coverUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      }).returning().get();

      expect(result.id).toBeDefined();
      expect(result.name).toBe('The Matrix');
      expect(result.year).toBe(1999);
    });

    it('requires name', () => {
      expect(() => {
        db.insert(schema.titles).values({ name: '' }).run();
      }).not.toThrow(); // empty string is allowed, NULL is not
    });
  });

  describe('copies', () => {
    it('creates a copy linked to a title', () => {
      const title = db.insert(schema.titles).values({
        name: 'The Matrix',
        year: 1999,
      }).returning().get();

      const copy = db.insert(schema.copies).values({
        titleId: title.id,
        barcode: 'VHS-MATRIX-001',
        format: 'VHS',
        condition: 'good',
        status: 'in',
      }).returning().get();

      expect(copy.titleId).toBe(title.id);
      expect(copy.status).toBe('in');
    });
  });

  describe('customers', () => {
    it('creates a customer with balance defaulting to 0', () => {
      const customer = db.insert(schema.customers).values({
        firstName: 'Neo',
        lastName: 'Anderson',
        email: 'neo@matrix.com',
        phone: '555-0199',
      }).returning().get();

      expect(customer.balance).toBe(0);
      expect(customer.active).toBe(1);
    });
  });

  describe('rentals', () => {
    it('creates a rental linking customer to copy', () => {
      const title = db.insert(schema.titles).values({ name: 'Aliens', year: 1986 }).returning().get();
      const copy = db.insert(schema.copies).values({
        titleId: title.id, barcode: 'DVD-ALIENS-001', format: 'DVD', condition: 'good', status: 'out',
      }).returning().get();
      const customer = db.insert(schema.customers).values({
        firstName: 'Ellen', lastName: 'Ripley', phone: '555-0142',
      }).returning().get();

      const rental = db.insert(schema.rentals).values({
        customerId: customer.id,
        copyId: copy.id,
        checkedOutAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
        status: 'out',
      }).returning().get();

      expect(rental.customerId).toBe(customer.id);
      expect(rental.copyId).toBe(copy.id);
      expect(rental.status).toBe('out');
    });
  });

  describe('transactions', () => {
    it('creates a transaction with items', () => {
      const customer = db.insert(schema.customers).values({
        firstName: 'John', lastName: 'Wick', phone: '555-0101',
      }).returning().get();

      const tx = db.insert(schema.transactions).values({
        customerId: customer.id,
        type: 'rental',
        subtotal: 499,
        tax: 40,
        total: 539,
        paymentMethod: 'cash',
        amountTendered: 600,
        changeGiven: 61,
      }).returning().get();

      const item = db.insert(schema.transactionItems).values({
        transactionId: tx.id,
        type: 'rental',
        description: 'The Matrix (VHS) - 3 day rental',
        amount: 499,
        tax: 40,
      }).returning().get();

      expect(item.transactionId).toBe(tx.id);
    });
  });

  describe('products', () => {
    it('creates a merchandise product', () => {
      const product = db.insert(schema.products).values({
        name: 'Popcorn',
        sku: 'SNACK-POP-001',
        price: 350,
        cost: 100,
        taxRate: 800,
        stockQty: 50,
        reorderLevel: 10,
        category: 'Snacks',
      }).returning().get();

      expect(product.price).toBe(350);
      expect(product.stockQty).toBe(50);
    });
  });

  describe('pricing_rules', () => {
    it('creates a pricing rule', () => {
      const rule = db.insert(schema.pricingRules).values({
        name: 'New Release - 1 Night',
        type: 'daily',
        rate: 499,
        durationDays: 1,
        lateFeePerDay: 199,
      }).returning().get();

      expect(rule.rate).toBe(499);
      expect(rule.lateFeePerDay).toBe(199);
    });
  });

  describe('reservations', () => {
    it('creates a reservation', () => {
      const title = db.insert(schema.titles).values({ name: 'Dune', year: 2021 }).returning().get();
      const customer = db.insert(schema.customers).values({
        firstName: 'Paul', lastName: 'Atreides', phone: '555-0000',
      }).returning().get();

      const reservation = db.insert(schema.reservations).values({
        customerId: customer.id,
        titleId: title.id,
        reservedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      }).returning().get();

      expect(reservation.fulfilled).toBe(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/server/db/schema.test.ts
```
Expected: FAIL — schema module doesn't exist yet

**Step 3: Implement the schema**

`server/db/schema.ts`:
```ts
// ABOUTME: Drizzle ORM schema definitions for all reRun database tables
// ABOUTME: Stores all amounts in cents (integer) to avoid floating point issues

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// --- Titles (movies/shows in the catalog) ---
export const titles = sqliteTable('titles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tmdbId: integer('tmdb_id'),
  name: text('name').notNull(),
  year: integer('year'),
  genre: text('genre'),
  runtimeMinutes: integer('runtime_minutes'),
  synopsis: text('synopsis'),
  rating: text('rating'),
  cast: text('cast'),
  coverUrl: text('cover_url'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// --- Copies (physical items that get rented) ---
export const copies = sqliteTable('copies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  titleId: integer('title_id').notNull().references(() => titles.id),
  barcode: text('barcode').notNull().unique(),
  format: text('format').notNull(), // VHS, DVD, Blu-ray
  condition: text('condition').notNull().default('good'), // good, fair, poor
  status: text('status').notNull().default('in'), // in, out, lost, retired
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// --- Customers ---
export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  birthday: text('birthday'),
  notes: text('notes'),
  balance: integer('balance').notNull().default(0), // cents, negative = owes money
  memberBarcode: text('member_barcode').unique(),
  active: integer('active').notNull().default(1), // 1 = active, 0 = inactive
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// --- Family members linked to a customer account ---
export const familyMembers = sqliteTable('family_members', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  relationship: text('relationship'),
});

// --- Rentals ---
export const rentals = sqliteTable('rentals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  copyId: integer('copy_id').notNull().references(() => copies.id),
  transactionId: integer('transaction_id').references(() => transactions.id),
  pricingRuleId: integer('pricing_rule_id').references(() => pricingRules.id),
  checkedOutAt: text('checked_out_at').notNull(),
  dueAt: text('due_at').notNull(),
  returnedAt: text('returned_at'),
  lateFee: integer('late_fee').default(0), // cents
  lateFeeStatus: text('late_fee_status'), // paid, balance, forgiven, partial
  status: text('status').notNull(), // out, returned, overdue, lost
});

// --- Transactions ---
export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').references(() => customers.id),
  type: text('type').notNull(), // rental, sale, return, mixed
  subtotal: integer('subtotal').notNull(), // cents
  tax: integer('tax').notNull().default(0), // cents
  total: integer('total').notNull(), // cents
  paymentMethod: text('payment_method').notNull(), // cash, credit, gift_cert, account
  amountTendered: integer('amount_tendered'), // cents (for cash)
  changeGiven: integer('change_given'), // cents (for cash)
  voided: integer('voided').notNull().default(0),
  voidReason: text('void_reason'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// --- Transaction line items ---
export const transactionItems = sqliteTable('transaction_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  transactionId: integer('transaction_id').notNull().references(() => transactions.id),
  type: text('type').notNull(), // rental, sale, return, late_fee, void
  copyId: integer('copy_id').references(() => copies.id),
  productId: integer('product_id').references(() => products.id),
  rentalId: integer('rental_id').references(() => rentals.id),
  description: text('description').notNull(),
  amount: integer('amount').notNull(), // cents
  tax: integer('tax').notNull().default(0), // cents
});

// --- Products (non-rental merchandise) ---
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sku: text('sku').unique(),
  price: integer('price').notNull(), // cents
  cost: integer('cost'), // cents
  taxRate: integer('tax_rate').notNull().default(0), // basis points (e.g., 800 = 8%)
  stockQty: integer('stock_qty').notNull().default(0),
  reorderLevel: integer('reorder_level').default(0),
  category: text('category'),
  active: integer('active').notNull().default(1),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// --- Reservations ---
export const reservations = sqliteTable('reservations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  titleId: integer('title_id').notNull().references(() => titles.id),
  reservedAt: text('reserved_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  fulfilled: integer('fulfilled').notNull().default(0),
  notified: integer('notified').notNull().default(0),
});

// --- Pricing Rules ---
export const pricingRules = sqliteTable('pricing_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull(), // daily, weekend, weekly, subscription
  rate: integer('rate').notNull(), // cents
  durationDays: integer('duration_days').notNull(),
  lateFeePerDay: integer('late_fee_per_day').notNull().default(0), // cents
  active: integer('active').notNull().default(1),
});

// --- Promotions ---
export const promotions = sqliteTable('promotions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull(), // multi_rent, discount, coupon
  rules: text('rules').notNull(), // JSON string
  startDate: text('start_date'),
  endDate: text('end_date'),
  active: integer('active').notNull().default(1),
});

// --- Prepaid Plans ---
export const prepaidPlans = sqliteTable('prepaid_plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  price: integer('price').notNull(), // cents
  creditValue: integer('credit_value'), // cents (for credit-style plans)
  rentalCount: integer('rental_count'), // for count-based plans
  durationDays: integer('duration_days'),
  active: integer('active').notNull().default(1),
});

// --- Customer Prepaid Balances ---
export const customerPrepaid = sqliteTable('customer_prepaid', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  planId: integer('plan_id').notNull().references(() => prepaidPlans.id),
  remainingCredit: integer('remaining_credit'), // cents
  remainingRentals: integer('remaining_rentals'),
  expiresAt: text('expires_at'),
  purchasedAt: text('purchased_at').notNull().$defaultFn(() => new Date().toISOString()),
});

// --- Alert Configs ---
export const alertConfigs = sqliteTable('alert_configs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(), // overdue, birthday, card_expired
  template: text('template').notNull(),
  enabled: integer('enabled').notNull().default(1),
});

// --- Store Settings (key-value config) ---
export const storeSettings = sqliteTable('store_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

**Step 4: Implement DB connection**

`server/db/index.ts`:
```ts
// ABOUTME: Database connection singleton for reRun
// ABOUTME: Creates SQLite database with WAL mode and foreign keys enabled

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DB_PATH || './data/rerun.db';

// Ensure data directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };
```

**Step 5: Update test setup with migration helper**

Update `tests/setup.ts` to include a `migrateTestDb` function that creates tables from the schema using raw SQL (since Drizzle Kit migrations are file-based). The test helper should read the schema and create tables in-memory:

```ts
// ABOUTME: Global test setup for Vitest
// ABOUTME: Creates in-memory SQLite database and applies schema for each test

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
  // Create all tables — order matters for foreign keys
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER,
      name TEXT NOT NULL,
      year INTEGER,
      genre TEXT,
      runtime_minutes INTEGER,
      synopsis TEXT,
      rating TEXT,
      cast_list TEXT,
      cover_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS copies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title_id INTEGER NOT NULL REFERENCES titles(id),
      barcode TEXT NOT NULL UNIQUE,
      format TEXT NOT NULL,
      condition TEXT NOT NULL DEFAULT 'good',
      status TEXT NOT NULL DEFAULT 'in',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      birthday TEXT,
      notes TEXT,
      balance INTEGER NOT NULL DEFAULT 0,
      member_barcode TEXT UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS family_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      relationship TEXT
    );

    CREATE TABLE IF NOT EXISTS pricing_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      rate INTEGER NOT NULL,
      duration_days INTEGER NOT NULL,
      late_fee_per_day INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      type TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      tax INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      payment_method TEXT NOT NULL,
      amount_tendered INTEGER,
      change_given INTEGER,
      voided INTEGER NOT NULL DEFAULT 0,
      void_reason TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rentals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      copy_id INTEGER NOT NULL REFERENCES copies(id),
      transaction_id INTEGER REFERENCES transactions(id),
      pricing_rule_id INTEGER REFERENCES pricing_rules(id),
      checked_out_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      returned_at TEXT,
      late_fee INTEGER DEFAULT 0,
      late_fee_status TEXT,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE,
      price INTEGER NOT NULL,
      cost INTEGER,
      tax_rate INTEGER NOT NULL DEFAULT 0,
      stock_qty INTEGER NOT NULL DEFAULT 0,
      reorder_level INTEGER DEFAULT 0,
      category TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL REFERENCES transactions(id),
      type TEXT NOT NULL,
      copy_id INTEGER REFERENCES copies(id),
      product_id INTEGER REFERENCES products(id),
      rental_id INTEGER REFERENCES rentals(id),
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      tax INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      title_id INTEGER NOT NULL REFERENCES titles(id),
      reserved_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      fulfilled INTEGER NOT NULL DEFAULT 0,
      notified INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      rules TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS prepaid_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      credit_value INTEGER,
      rental_count INTEGER,
      duration_days INTEGER,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS customer_prepaid (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      plan_id INTEGER NOT NULL REFERENCES prepaid_plans(id),
      remaining_credit INTEGER,
      remaining_rentals INTEGER,
      expires_at TEXT,
      purchased_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alert_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      template TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
```

**Note:** The schema.ts column `cast` is a reserved word in SQL. Rename to `cast` in the Drizzle schema but map to `cast_list` in the SQL column name: `cast: text('cast_list')`. Update the schema.ts accordingly.

**Step 6: Run tests**

```bash
npx vitest run tests/server/db/schema.test.ts
```
Expected: PASS

**Step 7: Generate Drizzle migrations for production**

```bash
npx drizzle-kit generate
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: add database schema with all core entities and test setup"
```

---

### Task 3: TMDb Client Service

**Files:**
- Create: `server/services/tmdb.ts`
- Create: `tests/server/services/tmdb.test.ts`

**Step 1: Write the failing tests**

`tests/server/services/tmdb.test.ts`:
```ts
// ABOUTME: Tests for the TMDb API client service
// ABOUTME: Validates search, detail fetching, and response parsing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TmdbClient } from '../../../server/services/tmdb.js';

// We test against the real TMDb API structure but mock fetch
// to avoid hitting rate limits in CI
const mockSearchResponse = {
  results: [
    {
      id: 603,
      title: 'The Matrix',
      release_date: '1999-03-30',
      overview: 'A computer hacker learns...',
      poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
      genre_ids: [28, 878],
      vote_average: 8.2,
    },
    {
      id: 604,
      title: 'The Matrix Reloaded',
      release_date: '2003-05-15',
      overview: 'Six months after the events...',
      poster_path: '/aA5qHS0FbSXO8PxEIwODY0MU0p0.jpg',
      genre_ids: [28, 878],
      vote_average: 6.7,
    },
  ],
  total_results: 2,
};

const mockDetailResponse = {
  id: 603,
  title: 'The Matrix',
  release_date: '1999-03-30',
  overview: 'A computer hacker learns about the true nature of reality.',
  poster_path: '/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
  runtime: 136,
  genres: [{ id: 28, name: 'Action' }, { id: 878, name: 'Science Fiction' }],
  vote_average: 8.2,
  credits: {
    cast: [
      { name: 'Keanu Reeves', character: 'Neo', order: 0 },
      { name: 'Laurence Fishburne', character: 'Morpheus', order: 1 },
      { name: 'Carrie-Anne Moss', character: 'Trinity', order: 2 },
    ],
  },
  release_dates: {
    results: [
      {
        iso_3166_1: 'US',
        release_dates: [{ certification: 'R', type: 3 }],
      },
    ],
  },
};

describe('TmdbClient', () => {
  let client: TmdbClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new TmdbClient('test-api-key', mockFetch);
  });

  describe('searchMovie', () => {
    it('searches by title and returns parsed results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      const results = await client.searchMovie('The Matrix');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('search/movie?query=The+Matrix'),
        expect.any(Object)
      );
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('The Matrix');
      expect(results[0].tmdbId).toBe(603);
      expect(results[0].year).toBe(1999);
      expect(results[0].posterUrl).toContain('f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg');
    });

    it('searches by title and year', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse,
      });

      await client.searchMovie('The Matrix', 1999);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('year=1999'),
        expect.any(Object)
      );
    });

    it('returns empty array on no results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [], total_results: 0 }),
      });

      const results = await client.searchMovie('aslkdjflaskdjf');
      expect(results).toHaveLength(0);
    });
  });

  describe('getMovieDetails', () => {
    it('fetches full details with credits and rating', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockDetailResponse,
      });

      const details = await client.getMovieDetails(603);

      expect(details.title).toBe('The Matrix');
      expect(details.runtimeMinutes).toBe(136);
      expect(details.genre).toBe('Action, Science Fiction');
      expect(details.cast).toContain('Keanu Reeves');
      expect(details.rating).toBe('R');
      expect(details.coverUrl).toContain('w500');
    });
  });

  describe('error handling', () => {
    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.searchMovie('test')).rejects.toThrow('TMDb API error: 401');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npx vitest run tests/server/services/tmdb.test.ts
```
Expected: FAIL — TmdbClient doesn't exist

**Step 3: Implement the TMDb client**

`server/services/tmdb.ts`:
```ts
// ABOUTME: TMDb API client for searching and fetching movie metadata
// ABOUTME: Used during CSV import to enrich titles with cover art, cast, genre, etc.

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

export interface TmdbSearchResult {
  tmdbId: number;
  title: string;
  year: number | null;
  overview: string;
  posterUrl: string | null;
  voteAverage: number;
}

export interface TmdbMovieDetails {
  tmdbId: number;
  title: string;
  year: number | null;
  synopsis: string;
  coverUrl: string | null;
  runtimeMinutes: number | null;
  genre: string;
  cast: string;
  rating: string | null;
  voteAverage: number;
}

type FetchFn = typeof globalThis.fetch;

export class TmdbClient {
  private apiKey: string;
  private fetchFn: FetchFn;

  constructor(apiKey: string, fetchFn?: FetchFn) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn || globalThis.fetch;
  }

  async searchMovie(query: string, year?: number): Promise<TmdbSearchResult[]> {
    const params = new URLSearchParams({
      query,
      api_key: this.apiKey,
    });
    if (year) params.set('year', String(year));

    const response = await this.fetchFn(
      `${TMDB_BASE_URL}/search/movie?${params}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results.map((r: any) => ({
      tmdbId: r.id,
      title: r.title,
      year: r.release_date ? parseInt(r.release_date.substring(0, 4), 10) : null,
      overview: r.overview,
      posterUrl: r.poster_path ? `${TMDB_IMAGE_BASE}${r.poster_path}` : null,
      voteAverage: r.vote_average,
    }));
  }

  async getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      append_to_response: 'credits,release_dates',
    });

    const response = await this.fetchFn(
      `${TMDB_BASE_URL}/movie/${tmdbId}?${params}`,
      { method: 'GET' }
    );

    if (!response.ok) {
      throw new Error(`TMDb API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract US rating from release_dates
    let rating: string | null = null;
    const usRelease = data.release_dates?.results?.find((r: any) => r.iso_3166_1 === 'US');
    if (usRelease) {
      const theatrical = usRelease.release_dates?.find((rd: any) => rd.certification);
      if (theatrical) rating = theatrical.certification;
    }

    // Top 5 cast members
    const castNames = (data.credits?.cast || [])
      .slice(0, 5)
      .map((c: any) => c.name)
      .join(', ');

    // Genre names
    const genres = (data.genres || []).map((g: any) => g.name).join(', ');

    return {
      tmdbId: data.id,
      title: data.title,
      year: data.release_date ? parseInt(data.release_date.substring(0, 4), 10) : null,
      synopsis: data.overview,
      coverUrl: data.poster_path ? `${TMDB_IMAGE_BASE}${data.poster_path}` : null,
      runtimeMinutes: data.runtime || null,
      genre: genres,
      cast: castNames,
      rating,
      voteAverage: data.vote_average,
    };
  }
}
```

**Step 4: Run tests**

```bash
npx vitest run tests/server/services/tmdb.test.ts
```
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/tmdb.ts tests/server/services/tmdb.test.ts
git commit -m "feat: add TMDb API client with search and detail fetching"
```

---

## Phase 2: Import Pipeline (Tasks 4–5)

### Task 4: CSV Parsing & Column Detection Service

**Files:**
- Create: `server/services/csv-import.ts`
- Create: `tests/server/services/csv-import.test.ts`
- Create: `tests/fixtures/` (test CSV files)

**Step 1: Write the failing tests**

`tests/server/services/csv-import.test.ts`:
```ts
// ABOUTME: Tests for CSV parsing and column auto-detection
// ABOUTME: Validates handling of various CSV formats and edge cases

import { describe, it, expect } from 'vitest';
import { parseCsv, detectColumns, type ColumnMapping } from '../../../server/services/csv-import.js';

const CSV_WITH_HEADERS = `Title,Year,Format,Quantity,Genre
The Matrix,1999,DVD,3,Action
Aliens,1986,VHS,2,Sci-Fi
The Shining,1980,Blu-ray,1,Horror`;

const CSV_DIFFERENT_HEADERS = `Movie Name,Release Year,Media Type,Copies,Category,Barcode
The Matrix,1999,DVD,3,Action,DVD-MTX-001
Aliens,1986,VHS,2,Sci-Fi,VHS-ALN-001`;

const CSV_MINIMAL = `title
The Matrix
Aliens
The Shining`;

const CSV_WITH_QUOTES = `"Title","Year","Format"
"The Good, the Bad and the Ugly",1966,"DVD"
"Alien",1979,"VHS"`;

describe('parseCsv', () => {
  it('parses standard CSV with headers', async () => {
    const result = await parseCsv(CSV_WITH_HEADERS);
    expect(result.headers).toEqual(['Title', 'Year', 'Format', 'Quantity', 'Genre']);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toEqual({
      Title: 'The Matrix', Year: '1999', Format: 'DVD', Quantity: '3', Genre: 'Action',
    });
  });

  it('handles quoted fields with commas', async () => {
    const result = await parseCsv(CSV_WITH_QUOTES);
    expect(result.rows[0].Title).toBe('The Good, the Bad and the Ugly');
  });

  it('handles minimal CSV with just titles', async () => {
    const result = await parseCsv(CSV_MINIMAL);
    expect(result.headers).toEqual(['title']);
    expect(result.rows).toHaveLength(3);
  });
});

describe('detectColumns', () => {
  it('auto-detects standard column names', () => {
    const headers = ['Title', 'Year', 'Format', 'Quantity', 'Genre'];
    const mapping = detectColumns(headers);
    expect(mapping.title).toBe('Title');
    expect(mapping.year).toBe('Year');
    expect(mapping.format).toBe('Format');
    expect(mapping.quantity).toBe('Quantity');
    expect(mapping.genre).toBe('Genre');
  });

  it('detects alternate column names', () => {
    const headers = ['Movie Name', 'Release Year', 'Media Type', 'Copies', 'Category', 'Barcode'];
    const mapping = detectColumns(headers);
    expect(mapping.title).toBe('Movie Name');
    expect(mapping.year).toBe('Release Year');
    expect(mapping.format).toBe('Media Type');
    expect(mapping.quantity).toBe('Copies');
    expect(mapping.genre).toBe('Category');
    expect(mapping.barcode).toBe('Barcode');
  });

  it('handles case insensitivity', () => {
    const headers = ['TITLE', 'YEAR', 'FORMAT'];
    const mapping = detectColumns(headers);
    expect(mapping.title).toBe('TITLE');
    expect(mapping.year).toBe('YEAR');
  });

  it('returns null for undetectable columns', () => {
    const headers = ['title'];
    const mapping = detectColumns(headers);
    expect(mapping.title).toBe('title');
    expect(mapping.year).toBeNull();
    expect(mapping.format).toBeNull();
  });
});
```

**Step 2: Run to verify failure, then implement**

`server/services/csv-import.ts`:
```ts
// ABOUTME: CSV parsing and column auto-detection for bulk title import
// ABOUTME: Handles various CSV formats and maps columns to reRun's data model

import { parse } from 'csv-parse/sync';

export interface ColumnMapping {
  title: string | null;
  year: string | null;
  format: string | null;
  quantity: string | null;
  genre: string | null;
  barcode: string | null;
  director: string | null;
}

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseCsv(csvContent: string): Promise<ParsedCsv> {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  });

  const headers = records.length > 0 ? Object.keys(records[0]) : [];
  return { headers, rows: records };
}

const COLUMN_ALIASES: Record<keyof ColumnMapping, string[]> = {
  title: ['title', 'movie', 'movie name', 'film', 'name', 'movie title', 'film name'],
  year: ['year', 'release year', 'release_year', 'yr', 'release date', 'date'],
  format: ['format', 'media', 'media type', 'type', 'medium'],
  quantity: ['quantity', 'qty', 'copies', 'count', 'num copies', 'number'],
  genre: ['genre', 'category', 'genres', 'type', 'categories'],
  barcode: ['barcode', 'upc', 'sku', 'code', 'bar code', 'isbn'],
  director: ['director', 'directed by', 'dir'],
};

export function detectColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    title: null,
    year: null,
    format: null,
    quantity: null,
    genre: null,
    barcode: null,
    director: null,
  };

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(normalized) && mapping[field as keyof ColumnMapping] === null) {
        mapping[field as keyof ColumnMapping] = header;
        break;
      }
    }
  }

  return mapping;
}
```

**Step 3: Run tests**

```bash
npx vitest run tests/server/services/csv-import.test.ts
```
Expected: PASS

**Step 4: Commit**

```bash
git add server/services/csv-import.ts tests/server/services/csv-import.test.ts
git commit -m "feat: add CSV parsing with auto column detection"
```

---

### Task 5: Barcode Generation Service

**Files:**
- Create: `server/services/barcode.ts`
- Create: `tests/server/services/barcode.test.ts`

**Step 1: Write tests, implement, verify**

The barcode service generates unique barcode strings for copies that don't have one. Format: `{FORMAT}-{TITLEID}-{SEQ}` (e.g., `DVD-00042-001`).

```ts
// tests/server/services/barcode.test.ts
// ABOUTME: Tests for barcode generation service
// ABOUTME: Validates unique barcode format and sequential numbering

import { describe, it, expect } from 'vitest';
import { generateBarcode, generateBarcodes } from '../../../server/services/barcode.js';

describe('generateBarcode', () => {
  it('generates a barcode from format and title ID', () => {
    const barcode = generateBarcode('DVD', 42, 1);
    expect(barcode).toBe('DVD-00042-001');
  });

  it('pads title ID and sequence', () => {
    const barcode = generateBarcode('VHS', 1, 1);
    expect(barcode).toBe('VHS-00001-001');
  });
});

describe('generateBarcodes', () => {
  it('generates sequential barcodes for multiple copies', () => {
    const barcodes = generateBarcodes('BLU', 99, 3);
    expect(barcodes).toEqual([
      'BLU-00099-001',
      'BLU-00099-002',
      'BLU-00099-003',
    ]);
  });
});
```

`server/services/barcode.ts`:
```ts
// ABOUTME: Barcode generation for rental copies
// ABOUTME: Creates deterministic barcodes in FORMAT-TITLEID-SEQ pattern

export function generateBarcode(format: string, titleId: number, sequence: number): string {
  const prefix = format.toUpperCase().substring(0, 3);
  const titlePad = String(titleId).padStart(5, '0');
  const seqPad = String(sequence).padStart(3, '0');
  return `${prefix}-${titlePad}-${seqPad}`;
}

export function generateBarcodes(format: string, titleId: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => generateBarcode(format, titleId, i + 1));
}
```

**Step 2: Run tests**

```bash
npx vitest run tests/server/services/barcode.test.ts
```
Expected: PASS

**Step 3: Commit**

```bash
git add server/services/barcode.ts tests/server/services/barcode.test.ts
git commit -m "feat: add barcode generation service"
```

---

## Phase 3: Core API (Tasks 6–10)

### Task 6: Titles & Copies API

**Files:**
- Create: `server/routes/titles.ts`
- Create: `server/routes/copies.ts`
- Modify: `server/app.ts` (mount routes)
- Create: `tests/server/routes/titles.test.ts`
- Create: `tests/server/routes/copies.test.ts`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/titles` | List titles (paginated, with copy counts) |
| GET | `/api/titles/:id` | Get title with all copies |
| POST | `/api/titles` | Create title (manual add) |
| PUT | `/api/titles/:id` | Update title |
| POST | `/api/titles/:id/copies` | Add copies to a title |
| PUT | `/api/copies/:id` | Update copy (status, condition) |
| GET | `/api/copies/:barcode` | Lookup copy by barcode |

**Testing pattern:** Use `createTestDb()` and `migrateTestDb()` from test setup. Create a test-specific Hono app that injects the test DB. Test against `app.request()`.

**Key implementation details:**
- All list endpoints support `?page=1&limit=20`
- Title list includes `availableCopies` count (copies with status = 'in')
- Barcode lookup is the primary way POS finds a copy (scanner input → GET copy → get title)
- POST `/api/titles` accepts optional TMDb enrichment (pass `tmdbId` to auto-fetch details)

**Step 1:** Write route tests covering CRUD + barcode lookup
**Step 2:** Run tests to verify failure
**Step 3:** Implement routes
**Step 4:** Run tests to verify pass
**Step 5:** Commit: `feat: add titles and copies API routes`

---

### Task 7: Customers API

**Files:**
- Create: `server/routes/customers.ts`
- Modify: `server/app.ts` (mount route)
- Create: `tests/server/routes/customers.test.ts`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/customers` | List customers (paginated) |
| GET | `/api/customers/:id` | Get customer with rental history |
| GET | `/api/customers/search?q=` | Search by name, phone, email, barcode |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| POST | `/api/customers/:id/family` | Add family member |
| DELETE | `/api/customers/:id/family/:familyId` | Remove family member |
| PUT | `/api/customers/:id/balance` | Adjust balance (credit/debit) |

**Key implementation details:**
- Search is fuzzy: `LIKE '%query%'` across first_name, last_name, phone, email, member_barcode
- Customer GET includes: active rentals, rental history (last 20), balance, family members
- Auto-generate `memberBarcode` on creation using nanoid
- Balance adjustments record the reason

**Step 1–5:** Same TDD pattern. Commit: `feat: add customers API with search and family members`

---

### Task 8: Products API

**Files:**
- Create: `server/routes/products.ts`
- Modify: `server/app.ts`
- Create: `tests/server/routes/products.test.ts`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List products |
| POST | `/api/products` | Create product |
| PUT | `/api/products/:id` | Update product |
| GET | `/api/products/low-stock` | Products at or below reorder level |

**Step 1–5:** TDD. Commit: `feat: add products API for merchandise`

---

### Task 9: Pricing Rules API

**Files:**
- Create: `server/routes/pricing.ts`
- Modify: `server/app.ts`
- Create: `tests/server/routes/pricing.test.ts`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/pricing` | List active pricing rules |
| POST | `/api/pricing` | Create pricing rule |
| PUT | `/api/pricing/:id` | Update pricing rule |
| DELETE | `/api/pricing/:id` | Deactivate pricing rule |

**Seed with defaults:**
- "New Release - 1 Night" ($4.99, 1 day, $1.99/day late)
- "New Release - 3 Night" ($5.99, 3 days, $1.99/day late)
- "Catalog - 3 Night" ($2.99, 3 days, $0.99/day late)
- "Catalog - 7 Night" ($3.99, 7 days, $0.99/day late)
- "Weekend Special" ($3.49, 3 days, $0.99/day late)

**Step 1–5:** TDD. Commit: `feat: add pricing rules API with default rates`

---

### Task 10: Search API

**Files:**
- Create: `server/routes/search.ts`
- Modify: `server/app.ts`
- Create: `tests/server/routes/search.test.ts`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search?q=&genre=&format=&available=` | Search titles with filters |

**Key implementation details:**
- Full-text search across `name`, `cast`, `synopsis`, `genre`
- Uses SQLite `LIKE` for MVP (can upgrade to FTS5 later if needed)
- Filters: `genre` (exact match), `format` (any copy has this format), `available` (boolean — has in-stock copies), `rating`, `year`
- Returns titles with `availableCopies` count
- Sort options: `name`, `year`, `popularity` (most rented)

**Step 1–5:** TDD. Commit: `feat: add search API with multi-field filtering`

---

## Phase 4: Transaction Engine (Tasks 11–13)

### Task 11: Transaction Service & API

**Files:**
- Create: `server/services/transaction.ts`
- Create: `server/routes/transactions.ts`
- Modify: `server/app.ts`
- Create: `tests/server/services/transaction.test.ts`
- Create: `tests/server/routes/transactions.test.ts`

**Service responsibilities:**
- Create transaction with line items (rentals, product sales, late fees)
- Calculate tax based on store settings (configurable tax rate in `store_settings`)
- Calculate change for cash payments
- Void a transaction (reverse all effects: restock products, un-rent copies, refund balance)
- Hold/recall: store in-progress transactions in memory (not DB) keyed by a hold ID

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transactions` | Create transaction |
| GET | `/api/transactions/:id` | Get transaction with items |
| POST | `/api/transactions/:id/void` | Void transaction |
| POST | `/api/transactions/hold` | Hold current transaction |
| GET | `/api/transactions/held` | List held transactions |
| POST | `/api/transactions/recall/:holdId` | Recall held transaction |

**Test cases to cover:**
- Create a rental transaction: copy status changes to 'out', rental record created
- Create a sale transaction: product stock decremented
- Mixed transaction: rentals + product sales on same ticket
- Cash payment with change calculation
- Void: copy status returns to 'in', product stock restored, customer balance adjusted
- Tax calculation: subtotal × tax rate
- Hold/recall round-trip

**Step 1–5:** TDD. Commit: `feat: add transaction engine with hold/recall and void`

---

### Task 12: Rental Service (Checkout/Return/Late Fees)

**Files:**
- Create: `server/services/rental.ts`
- Create: `server/routes/rentals.ts`
- Modify: `server/app.ts`
- Create: `tests/server/services/rental.test.ts`
- Create: `tests/server/routes/rentals.test.ts`

**Service responsibilities:**
- **Checkout:** validate copy is available, check for active reservations, check "previously rented" status, create rental record, update copy status
- **Return:** find active rental for copy, calculate late fee if overdue, update copy status to 'in', handle late fee payment (pay now, add to balance, forgive)
- **Late fee calculation:** `(days_overdue) × pricing_rule.late_fee_per_day`
- **Overdue detection:** query all rentals where `status = 'out'` and `due_at < now()`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/rentals/checkout` | Checkout copies to a customer |
| POST | `/api/rentals/return` | Return copies |
| GET | `/api/rentals/overdue` | List overdue rentals |
| GET | `/api/rentals/customer/:id` | Rental history for a customer |
| GET | `/api/rentals/active` | All currently rented copies |

**Test cases to cover:**
- Checkout: copy status changes, rental created with correct due date based on pricing rule
- Return on time: no late fee, copy status back to 'in'
- Return late: correct late fee calculated, options for handling fee
- Previously rented alert: returns true if customer has rented this title before
- Overdue query: only returns actually overdue rentals
- Cannot checkout a copy that is already rented out

**Step 1–5:** TDD. Commit: `feat: add rental service with checkout, return, and late fee calculation`

---

### Task 13: Reservations & Import API

**Files:**
- Create: `server/routes/reservations.ts`
- Create: `server/routes/import.ts`
- Modify: `server/app.ts`
- Create: `tests/server/routes/reservations.test.ts`
- Create: `tests/server/routes/import.test.ts`

**Reservation endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/reservations` | Create reservation |
| GET | `/api/reservations` | List active reservations |
| PUT | `/api/reservations/:id/fulfill` | Mark reservation fulfilled |
| DELETE | `/api/reservations/:id` | Cancel reservation |

**Import endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/import/parse` | Upload + parse CSV, return headers + preview rows |
| POST | `/api/import/match` | Send parsed rows with column mapping, batch TMDb match |
| POST | `/api/import/commit` | Commit matched titles to database |

**Import flow detail:**
1. `POST /api/import/parse` — accepts CSV file upload, returns `{ headers, rows, detectedMapping }`
2. `POST /api/import/match` — accepts `{ rows, mapping }`, searches TMDb for each row, returns `{ matches: [{ row, tmdbResults, bestMatch, confidence }] }`. Confidence: `exact` (single match, year matches), `likely` (top result looks right), `ambiguous` (multiple candidates), `none` (no results).
3. `POST /api/import/commit` — accepts `{ titles: [{ tmdbId?, name, year, format, quantity, ... }] }`, creates Title + Copy records. Returns count of created titles and copies.

**Step 1–5:** TDD. Commit: `feat: add reservations and CSV import API`

---

## Phase 5: Frontend Foundation (Tasks 14–16)

### Task 14: CRT Theme & CSS Foundation

**Files:**
- Create: `client/src/styles/variables.css`
- Create: `client/src/styles/global.css`
- Create: `client/src/styles/crt.css`
- Create: `client/src/components/crt/CRTScreen.tsx`
- Create: `client/src/components/crt/Scanlines.tsx`
- Create: `client/src/components/crt/GlowText.tsx`

**CSS Variables (`variables.css`):**
```css
:root {
  /* CRT Phosphor Colors */
  --crt-green: #33FF00;
  --crt-green-dim: #1a8c00;
  --crt-green-bright: #66FF33;
  --crt-amber: #FFB000;
  --crt-amber-dim: #996a00;
  --crt-red: #FF3333;
  --crt-cyan: #00FFFF;

  /* Backgrounds */
  --bg-primary: #0a0a0a;
  --bg-secondary: #111111;
  --bg-panel: #0d1a0d;
  --bg-input: #050a05;

  /* Text */
  --text-primary: #33FF00;
  --text-secondary: #1a8c00;
  --text-muted: #0d4600;
  --text-warning: #FFB000;
  --text-error: #FF3333;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;

  /* Font */
  --font-mono: 'JetBrains Mono', 'IBM Plex Mono', 'Fira Code', 'Courier New', monospace;
  --font-size-sm: 12px;
  --font-size-md: 14px;
  --font-size-lg: 18px;
  --font-size-xl: 24px;
  --font-size-xxl: 32px;

  /* Borders */
  --border-color: #1a4d00;
  --border-radius: 2px;

  /* Glow */
  --glow-green: 0 0 10px rgba(51, 255, 0, 0.3), 0 0 20px rgba(51, 255, 0, 0.1);
  --glow-amber: 0 0 10px rgba(255, 176, 0, 0.3), 0 0 20px rgba(255, 176, 0, 0.1);
}
```

**CRT effects (`crt.css`):**
- Scanline overlay (repeating-linear-gradient, 2px lines, subtle opacity)
- Screen curvature (very subtle border-radius + box-shadow on the outer container)
- Text glow (text-shadow matching the phosphor color)
- Optional flicker animation (CSS keyframes, toggleable via class)
- Screen edge vignette (radial-gradient overlay)

**CRTScreen component:** Wrapper that applies scanlines + curvature + vignette to its children.
**GlowText component:** Text with phosphor glow effect, supports green/amber/red variants.
**Scanlines component:** Pure CSS overlay element.

**No tests needed for pure visual components.** These are CSS-only effects.

**Step 1:** Create CSS files
**Step 2:** Create CRT components
**Step 3:** Verify visually by running `npm run dev:client` and loading the app
**Step 4:** Commit: `feat: add CRT theme with scanlines, glow, and retro typography`

---

### Task 15: Common UI Components

**Files:**
- Create: `client/src/components/common/Button.tsx`
- Create: `client/src/components/common/Input.tsx`
- Create: `client/src/components/common/Modal.tsx`
- Create: `client/src/components/common/Table.tsx`
- Create: `client/src/components/common/Select.tsx`
- Create: `client/src/components/common/Badge.tsx`
- Create: `client/src/components/common/Alert.tsx`

**Design principles:**
- All components use CRT theme variables
- Keyboard-accessible (tab order, enter to activate)
- Dense layout — minimize whitespace
- Monospace font everywhere
- Green phosphor text on dark backgrounds
- Amber for warnings, red for errors/destructive actions

**Button variants:** `primary` (green border + glow), `secondary` (dim green), `danger` (red), `ghost` (no border)
**Input:** Dark background, green text, green border on focus with glow, placeholder in dim green
**Modal:** Dark overlay, centered panel with CRT border styling, keyboard dismissable (Esc)
**Table:** Alternating row brightness (very subtle), green headers, horizontal lines only
**Badge:** Small pill for statuses — green (in stock), amber (rented), red (overdue/lost)

**No unit tests for simple presentational components.** Test them through integration tests on the screens that use them.

**Step 1:** Create all common components
**Step 2:** Verify visually
**Step 3:** Commit: `feat: add common UI components with CRT styling`

---

### Task 16: Layout, Routing & Navigation

**Files:**
- Create: `client/src/components/common/Layout.tsx`
- Modify: `client/src/App.tsx` (add router)
- Create: `client/src/api/client.ts`
- Create: `client/src/hooks/useApi.ts`

**Layout:**
- Full-screen dark background
- Top bar: reRun logo (ASCII art or retro text), current time, active alerts count
- Left sidebar: Navigation links with F-key hints (F1 POS, F2 Customers, F3 Returns, F4 Inventory, F5 Import, F6 Dashboard)
- Main content area: CRTScreen wrapper around page content
- Status bar (bottom): connection status, DB size, last backup time

**Routes:**
```
/            → Dashboard
/pos         → POS Screen
/customers   → Customer Search/Management
/inventory   → Inventory Browser
/import      → Import Wizard
/returns     → Return Screen
/settings    → Store Settings
```

**API Client (`client/src/api/client.ts`):**
Typed fetch wrapper with methods for every API endpoint. Example:
```ts
export const api = {
  titles: {
    list: (params?) => get('/api/titles', params),
    get: (id) => get(`/api/titles/${id}`),
    create: (data) => post('/api/titles', data),
    // ...
  },
  customers: { /* ... */ },
  rentals: { /* ... */ },
  // ...
};
```

**Step 1:** Create Layout component
**Step 2:** Set up react-router-dom with all routes (placeholder pages)
**Step 3:** Create API client
**Step 4:** Verify navigation works in browser
**Step 5:** Commit: `feat: add layout, routing, navigation, and API client`

---

## Phase 6: Feature Screens (Tasks 17–22)

### Task 17: Import Wizard Screen

**Files:**
- Create: `client/src/components/import/ImportWizard.tsx`
- Create: `client/src/components/import/FileUpload.tsx`
- Create: `client/src/components/import/ColumnMapper.tsx`
- Create: `client/src/components/import/MatchReview.tsx`
- Create: `client/src/components/import/ImportProgress.tsx`
- Create: `tests/client/components/import/ImportWizard.test.tsx`

**This is the highest-priority screen — the whole reason for building reRun.**

**Wizard steps:**
1. **Upload** — drag-and-drop or file picker for CSV. Show file name, size, row count preview.
2. **Column Mapping** — show detected mapping, let user reassign via dropdowns. Show 5-row preview with mapped columns highlighted.
3. **TMDb Matching** — progress bar as titles are matched. Show status: ✓ matched, ⚠ ambiguous, ✗ not found. Real-time updates via polling or SSE.
4. **Review** — table of all titles with TMDb match. Show cover art thumbnail, matched title, year, confidence. For ambiguous: dropdown to pick correct match or search manually. For not found: manual entry form.
5. **Commit** — progress bar as titles are written to DB. Summary: X titles created, Y copies created, Z titles need manual review.

**Test cases:**
- Wizard advances through steps correctly
- Column mapper shows detected columns
- Review screen displays match confidence badges
- Commit button is disabled until all required fields are resolved

**Step 1:** Write component test for wizard step progression
**Step 2:** Implement all wizard components
**Step 3:** Run tests
**Step 4:** Visual verification with dev server
**Step 5:** Commit: `feat: add import wizard with CSV upload, TMDb matching, and review`

---

### Task 18: Inventory Browser Screen

**Files:**
- Create: `client/src/components/inventory/InventoryBrowser.tsx`
- Create: `client/src/components/inventory/TitleCard.tsx`
- Create: `client/src/components/inventory/TitleDetail.tsx`
- Create: `client/src/components/inventory/TitleForm.tsx`

**Layout:**
- Filter sidebar (left): genre dropdown, format checkboxes, availability toggle, rating filter, search box
- Title grid (center): cards showing cover art, title, year, format badges, copy count badge (green/amber/red based on availability)
- Toggle between grid view and table view (list)
- Click title card → slide-in detail panel showing: full metadata, all copies with status, rental history for title

**Title Form:** Used for manual add. TMDb search field that shows suggestions as you type, pick a match to auto-fill all fields, then set format and quantity.

**Step 1–5:** TDD where testable, visual verification for layout. Commit: `feat: add inventory browser with filters, title cards, and detail view`

---

### Task 19: Customer Management Screen

**Files:**
- Create: `client/src/components/customers/CustomerSearch.tsx`
- Create: `client/src/components/customers/CustomerCard.tsx`
- Create: `client/src/components/customers/CustomerForm.tsx`
- Create: `tests/client/components/customers/CustomerSearch.test.tsx`

**Layout:**
- Search bar (top) — auto-search as you type, barcode scan triggers search
- Results list (left) — name, phone, balance, active rental count
- Customer detail (right) — full profile card:
  - Contact info, member barcode, birthday
  - Balance (highlighted if negative = owes money)
  - Active rentals with due dates (overdue highlighted in red)
  - Rental history (paginated)
  - Family members
  - Notes
  - Quick actions: new rental, adjust balance, edit profile

**CustomerForm:** Create/edit modal with all customer fields. Birthday picker. Auto-generates member barcode on create.

**Test cases:**
- Search triggers API call with debounce
- Customer card displays balance correctly (positive = credit, negative = owed)
- Active rentals sort overdue first

**Step 1–5:** TDD. Commit: `feat: add customer management with search, profile cards, and history`

---

### Task 20: POS / Checkout Screen

**Files:**
- Create: `client/src/components/pos/POSScreen.tsx`
- Create: `client/src/components/pos/TransactionPanel.tsx`
- Create: `client/src/components/pos/CustomerBar.tsx`
- Create: `client/src/components/pos/PaymentModal.tsx`
- Create: `client/src/components/pos/HeldTransactions.tsx`
- Create: `client/src/components/pos/Receipt.tsx`
- Create: `tests/client/components/pos/POSScreen.test.tsx`

**This is the primary screen clerks will use all day.**

**Layout:**
- **Customer bar (top):** shows selected customer name, balance, alerts (birthday, overdue items). Scan member barcode or search to select.
- **Scan input (always focused):** invisible text input that catches barcode scanner input. Auto-detects scans (fast input) vs manual typing.
- **Transaction panel (center):** list of line items being built. Each line: description, price, remove button. Running subtotal, tax, total at bottom.
- **Quick actions (right sidebar):**
  - Scan/Add Rental — scan copy barcode, select pricing rule, add to transaction
  - Add Product — search products, add to transaction
  - Add Late Fee — manually add late fee line item
  - Hold Transaction (F5)
  - Recall Held (shows count of held transactions)
  - Void Last Item
- **Payment bar (bottom):** total due, payment method selector, complete transaction button
- **Previously rented alert:** when scanning a copy, if customer has rented this title before, show amber alert

**Payment Modal:**
- Payment method: Cash, Credit Card, Gift Certificate, Account Balance
- For cash: amount tendered input, auto-calculate change
- For account: show current balance, confirm deduction
- Complete → print/email receipt → clear transaction → ready for next customer

**Receipt component:** printable receipt using `@media print` CSS. Store name, date, line items, totals, "Thank you" message. Trigger browser print dialog.

**Test cases:**
- Scanning a barcode adds a rental line item
- Multiple items accumulate in transaction
- Payment modal calculates correct change
- Void removes last item
- Hold stores and recall restores transaction state
- Previously rented alert shows when applicable

**Step 1–5:** TDD. Commit: `feat: add POS checkout screen with barcode scanning and payment`

---

### Task 21: Return Screen

**Files:**
- Create: `client/src/components/rentals/ReturnScreen.tsx`
- Create: `client/src/components/rentals/ReservationList.tsx`

**Layout:**
- Scan input (top): scan copy barcode to start return
- Return panel: shows copy info, customer who rented it, due date, days overdue (if any)
- Late fee section (if overdue): calculated fee, options — Pay Now, Add to Balance, Partial Payment, Forgive
- Batch return: scan multiple copies, review all, process as batch
- Reservation alert: if returned title has a pending reservation, show notification with customer name
- Complete → update copy status, close rental, handle late fee

**Step 1–5:** TDD. Commit: `feat: add return screen with late fee handling and reservation alerts`

---

### Task 22: Dashboard Screen

**Files:**
- Create: `client/src/components/dashboard/Dashboard.tsx`

**Layout (dense, information-rich, CRT aesthetic):**

```
┌─────────────────────────────────────────────────┐
│  ╔═══ TODAY'S ACTIVITY ═══╗  ╔═══ ALERTS ═══╗  │
│  ║ Rentals: 14            ║  ║ ▸ 3 overdue   ║  │
│  ║ Returns: 11            ║  ║ ▸ 2 birthdays ║  │
│  ║ Sales: $142.50         ║  ║ ▸ 1 low stock ║  │
│  ║ Late Fees: $12.00      ║  ╚═══════════════╝  │
│  ╚════════════════════════╝                      │
│  ╔═══ OVERDUE ITEMS ═══════════════════════════╗ │
│  ║ Customer      │ Title         │ Days Late   ║ │
│  ║ John Wick     │ The Matrix    │ 3 days      ║ │
│  ║ Ellen Ripley  │ Aliens        │ 1 day       ║ │
│  ╚═════════════════════════════════════════════╝ │
│  ╔═══ RESERVATIONS DUE ═══╗  ╔═══ TOP 5 ═══╗   │
│  ║ Paul A. → Dune (avail) ║  ║ 1. The Mat.. ║   │
│  ║ ...                    ║  ║ 2. Aliens    ║   │
│  ╚════════════════════════╝  ╚══════════════╝   │
└─────────────────────────────────────────────────┘
```

**Data sources:** aggregate queries from rentals, transactions, reservations, products tables.

**Step 1:** Implement dashboard with API calls for each section
**Step 2:** Visual verification
**Step 3:** Commit: `feat: add dashboard with activity summary, alerts, and overdue tracking`

---

## Phase 7: Polish & Deploy (Tasks 23–26)

### Task 23: Keyboard Shortcuts & Barcode Scanner Integration

**Files:**
- Create: `client/src/hooks/useKeyboardShortcuts.ts`
- Create: `client/src/hooks/useBarcodeScanner.ts`
- Modify: `client/src/App.tsx` (wire up global shortcuts)
- Create: `tests/client/hooks/useKeyboardShortcuts.test.ts`
- Create: `tests/client/hooks/useBarcodeScanner.test.ts`

**Keyboard shortcuts:**
- `F1` → Navigate to POS (new transaction)
- `F2` → Navigate to Customer Search (focus search input)
- `F3` → Navigate to Returns
- `F4` → Navigate to Inventory (focus search input)
- `F5` → Hold/recall transaction (when on POS screen)
- `Esc` → Close modal / cancel current action / go back

**Barcode scanner detection:**
- USB barcode scanners send characters very fast followed by Enter
- Detect: if characters arrive faster than ~50ms apart and end with Enter, it's a scan
- Capture scan globally regardless of which input is focused
- Route scanned value to appropriate handler: copy barcode → lookup copy, member barcode → lookup customer

**Test cases:**
- F-key navigation fires correct route changes
- Barcode scanner detection distinguishes scan from typing
- Esc closes open modals

**Step 1–5:** TDD. Commit: `feat: add keyboard shortcuts and barcode scanner detection`

---

### Task 24: Promotions, Alerts & Settings

**Files:**
- Create: `server/routes/promotions.ts`
- Create: `server/routes/alerts.ts`
- Create: `server/services/alert.ts`
- Modify: `server/app.ts`
- Create: `tests/server/services/alert.test.ts`
- Create: `tests/server/routes/alerts.test.ts`

**Promotion endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/promotions` | List active promotions |
| POST | `/api/promotions` | Create promotion |
| PUT | `/api/promotions/:id` | Update promotion |

**Alert service:**
- `getOverdueRentals()` — rentals where due_at < now and status = 'out'
- `getBirthdayAlerts()` — customers with birthday = today's month/day
- `getLowStockAlerts()` — products where stock_qty <= reorder_level
- Email sending for overdue notices (use nodemailer with configurable SMTP in store_settings)

**Alert endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/alerts` | Get all current alerts (overdue, birthday, low stock) |
| POST | `/api/alerts/send-overdue/:rentalId` | Send overdue email to customer |
| GET | `/api/alerts/configs` | Get alert configurations |
| PUT | `/api/alerts/configs/:id` | Update alert config (template, enabled) |

**Store Settings endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get all settings |
| PUT | `/api/settings/:key` | Update a setting |

**Default settings to seed:**
- `tax_rate`: `800` (8.00%, stored as basis points)
- `store_name`: `"reRun Video"`
- `store_address`: `""`
- `store_phone`: `""`
- `receipt_footer`: `"Thank you for choosing reRun!"`
- `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`: `""` (email config)

**Step 1–5:** TDD. Commit: `feat: add promotions, alerts, store settings, and email templates`

---

### Task 25: Backup/Restore & Export

**Files:**
- Create: `server/routes/backup.ts`
- Modify: `server/app.ts`
- Create: `tests/server/routes/backup.test.ts`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/backup` | Create backup (copies SQLite file to `data/backups/`) |
| GET | `/api/backup/list` | List available backups |
| POST | `/api/backup/restore/:filename` | Restore from backup |
| GET | `/api/export/:table` | Export table as CSV |
| GET | `/api/export/all` | Export all data as JSON |

**Backup implementation:**
- Copy `rerun.db` to `data/backups/rerun-YYYY-MM-DD-HHMMSS.db`
- List backups by reading the directory
- Restore: close DB connection, copy backup over main DB, reopen connection
- Store `last_backup_at` in store_settings

**Step 1–5:** TDD. Commit: `feat: add database backup, restore, and data export`

---

### Task 26: PM2 Setup, Build & Deployment

**Files:**
- Create: `ecosystem.config.cjs`
- Create: `scripts/setup.ts`
- Modify: `package.json` (verify scripts)

**PM2 config (`ecosystem.config.cjs`):**
```js
// ABOUTME: PM2 process manager configuration for reRun
// ABOUTME: Auto-starts the server on boot, restarts on crash

module.exports = {
  apps: [{
    name: 'rerun',
    script: 'dist/server/index.js',
    env: {
      NODE_ENV: 'production',
      PORT: 1987,
    },
    watch: false,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }],
};
```

**Setup script (`scripts/setup.ts`):**
1. Check Node.js version (require >= 18)
2. Create `data/` directory if missing
3. Prompt for TMDb API key (save to `.env`)
4. Run Drizzle migrations to create database
5. Seed default pricing rules and store settings
6. Print success message with URL

**Deployment steps (documented in script output):**
```
npm run build
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

**Step 1:** Create PM2 config
**Step 2:** Create setup script
**Step 3:** Test full build pipeline: `npm run build && NODE_ENV=production node dist/server/index.js`
**Step 4:** Verify production mode serves frontend + API on port 1987
**Step 5:** Commit: `feat: add PM2 config, setup script, and production build`

---

## Phase 8: End-to-End Testing (Task 27)

### Task 27: Integration & E2E Tests

**Files:**
- Create: `tests/e2e/import-flow.test.ts`
- Create: `tests/e2e/checkout-flow.test.ts`
- Create: `tests/e2e/return-flow.test.ts`

**Test 1: Import Flow**
1. Parse a test CSV
2. Detect columns
3. Match against TMDb (mocked)
4. Commit to database
5. Verify titles and copies exist
6. Verify TMDb metadata is stored

**Test 2: Checkout Flow**
1. Create customer
2. Create title with copies
3. Checkout a copy to the customer
4. Verify copy status = 'out'
5. Verify rental record exists
6. Verify transaction with correct totals

**Test 3: Return Flow**
1. Set up customer with overdue rental
2. Process return
3. Verify late fee calculated correctly
4. Verify copy status = 'in'
5. Verify customer balance updated

**Step 1:** Write all E2E tests
**Step 2:** Run full test suite: `npx vitest run`
**Step 3:** Fix any failures
**Step 4:** Commit: `test: add end-to-end tests for import, checkout, and return flows`

---

## Summary

| Phase | Tasks | What |
|-------|-------|------|
| 1: Foundation | 1–3 | Scaffold, DB schema, TMDb client |
| 2: Import Pipeline | 4–5 | CSV parsing, barcode generation |
| 3: Core API | 6–10 | Titles, customers, products, pricing, search |
| 4: Transaction Engine | 11–13 | Transactions, rentals, reservations, import API |
| 5: Frontend Foundation | 14–16 | CRT theme, common components, layout/routing |
| 6: Feature Screens | 17–22 | Import wizard, inventory, customers, POS, returns, dashboard |
| 7: Polish & Deploy | 23–26 | Keyboard shortcuts, promotions/alerts, backup, PM2 |
| 8: E2E Testing | 27 | Full integration tests for critical flows |

**Total: 27 tasks across 8 phases.**

**Critical path:** Tasks 1–5 (foundation + import) must be done first. After that, API tasks (6–13) and frontend tasks (14–16) can be parallelized. Feature screens (17–22) depend on both API and frontend foundation being complete.

**Every file starts with two ABOUTME comment lines.**
**Every feature follows TDD: write test → fail → implement → pass → commit.**
**All amounts stored in cents (integer) to avoid floating-point issues.**
**All dates stored as ISO 8601 strings in SQLite.**
