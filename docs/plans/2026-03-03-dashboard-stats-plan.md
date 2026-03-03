# Dashboard Stats Endpoint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up the dashboard's "TODAY'S ACTIVITY" panel with live data from a new `GET /api/dashboard/stats` endpoint.

**Architecture:** New service (`server/services/dashboard.ts`) handles SQL aggregation queries. New route (`server/routes/dashboard.ts`) exposes the endpoint. Frontend adds `api.dashboard.stats()` and integrates into existing `loadDashboard` cycle.

**Tech Stack:** Drizzle ORM + SQLite, Hono routes, React frontend with fetch API client.

---

### Task 1: Dashboard Service — Failing Tests

**Files:**
- Create: `tests/server/services/dashboard.test.ts`

**Step 1: Write failing tests for `getTodayStats`**

The service function will query today's rentals, returns, revenue, and late fees. Write tests that seed known data and verify the aggregation.

```typescript
// ABOUTME: Tests for the dashboard stats service (today's activity aggregations)
// ABOUTME: Validates rental count, return count, revenue sum, and late fee sum queries

import { describe, it, expect } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { nanoid } from 'nanoid';
import {
  customers,
  titles,
  copies,
  rentals,
  pricingRules,
  transactions,
} from '../../../server/db/schema.js';
import { getTodayStats } from '../../../server/services/dashboard.js';

function buildDb() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  return { db, sqlite };
}

async function seedCustomer(db: any) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: 'Test',
    lastName: 'Customer',
    memberBarcode: `MBR-${nanoid(8)}`,
    balance: 0,
  });
  return id;
}

async function seedTitleAndCopy(db: any) {
  const titleId = nanoid();
  await db.insert(titles).values({ id: titleId, name: 'Test Movie', year: 2024 });
  const copyId = nanoid();
  await db.insert(copies).values({
    id: copyId,
    titleId,
    barcode: `BC-${nanoid(6)}`,
    format: 'VHS',
    status: 'in',
  });
  return { titleId, copyId };
}

async function seedPricingRule(db: any) {
  const id = nanoid();
  await db.insert(pricingRules).values({
    id,
    name: '7-Day Rental',
    type: 'rental',
    rate: 399,
    durationDays: 7,
    lateFeePerDay: 100,
    active: 1,
  });
  return id;
}

describe('Dashboard Service', () => {
  describe('getTodayStats', () => {
    it('returns zeros when no activity exists', async () => {
      const { db } = buildDb();
      const stats = await getTodayStats(db);
      expect(stats).toEqual({
        rentalsToday: 0,
        returnsToday: 0,
        revenueCents: 0,
        lateFeesCollectedCents: 0,
      });
    });

    it('counts rental transactions created today', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      // Rental transaction created today
      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.rentalsToday).toBe(1);
    });

    it('excludes voided transactions from rental count', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 1,
        voidReason: 'mistake',
        createdAt: new Date().toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.rentalsToday).toBe(0);
    });

    it('excludes transactions from previous days', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: yesterday.toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.rentalsToday).toBe(0);
    });

    it('counts rentals returned today', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        status: 'returned',
      });

      const stats = await getTodayStats(db);
      expect(stats.returnsToday).toBe(1);
    });

    it('sums revenue from non-voided transactions today', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 32,
        total: 431,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'sale',
        subtotal: 199,
        tax: 16,
        total: 215,
        paymentMethod: 'card',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.revenueCents).toBe(431 + 215);
    });

    it('excludes voided transactions from revenue', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 0,
        total: 399,
        paymentMethod: 'cash',
        voided: 1,
        voidReason: 'oops',
        createdAt: new Date().toISOString(),
      });

      const stats = await getTodayStats(db);
      expect(stats.revenueCents).toBe(399);
    });

    it('sums late fees with paid status for rentals returned today', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);
      const { copyId } = await seedTitleAndCopy(db);
      const pricingRuleId = await seedPricingRule(db);

      // Paid late fee - returned today
      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        lateFee: 700,
        lateFeeStatus: 'paid',
        status: 'returned',
      });

      const stats = await getTodayStats(db);
      expect(stats.lateFeesCollectedCents).toBe(700);
    });

    it('excludes late fees with balance or forgiven status', async () => {
      const { db } = buildDb();
      const customerId = await seedCustomer(db);
      const pricingRuleId = await seedPricingRule(db);

      // Need two separate copies
      const titleId = nanoid();
      await db.insert(titles).values({ id: titleId, name: 'Test', year: 2024 });
      const copyId1 = nanoid();
      const copyId2 = nanoid();
      await db.insert(copies).values({
        id: copyId1,
        titleId,
        barcode: `BC-${nanoid(6)}`,
        format: 'VHS',
        status: 'in',
      });
      await db.insert(copies).values({
        id: copyId2,
        titleId,
        barcode: `BC-${nanoid(6)}`,
        format: 'DVD',
        status: 'in',
      });

      // Balance late fee
      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId: copyId1,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        lateFee: 700,
        lateFeeStatus: 'balance',
        status: 'returned',
      });

      // Forgiven late fee
      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId: copyId2,
        pricingRuleId,
        checkedOutAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        lateFee: 500,
        lateFeeStatus: 'forgiven',
        status: 'returned',
      });

      const stats = await getTodayStats(db);
      expect(stats.lateFeesCollectedCents).toBe(0);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/services/dashboard.test.ts`
Expected: FAIL — cannot resolve `../../../server/services/dashboard.js`

**Step 3: Commit failing tests**

```bash
git add tests/server/services/dashboard.test.ts
git commit -m "test: add failing tests for dashboard stats service"
```

---

### Task 2: Dashboard Service — Implementation

**Files:**
- Create: `server/services/dashboard.ts`

**Step 1: Implement `getTodayStats`**

```typescript
// ABOUTME: Dashboard stats service for today's activity aggregations
// ABOUTME: Queries rental count, return count, revenue, and collected late fees for the current day

import { sql, eq, and, gte } from 'drizzle-orm';
import { transactions, rentals } from '../db/schema.js';

export interface TodayStats {
  rentalsToday: number;
  returnsToday: number;
  revenueCents: number;
  lateFeesCollectedCents: number;
}

export async function getTodayStats(db: any): Promise<TodayStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Count rental transactions today (non-voided)
  const [rentalCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.type, 'rental'),
        eq(transactions.voided, 0),
        gte(transactions.createdAt, todayIso)
      )
    );

  // Count returns today
  const [returnCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(rentals)
    .where(
      and(
        eq(rentals.status, 'returned'),
        gte(rentals.returnedAt, todayIso)
      )
    );

  // Sum revenue today (non-voided)
  const [revenue] = await db
    .select({ total: sql<number>`coalesce(sum(${transactions.total}), 0)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.voided, 0),
        gte(transactions.createdAt, todayIso)
      )
    );

  // Sum late fees collected today (paid status, returned today)
  const [lateFees] = await db
    .select({ total: sql<number>`coalesce(sum(${rentals.lateFee}), 0)` })
    .from(rentals)
    .where(
      and(
        eq(rentals.lateFeeStatus, 'paid'),
        gte(rentals.returnedAt, todayIso)
      )
    );

  return {
    rentalsToday: rentalCount.count,
    returnsToday: returnCount.count,
    revenueCents: revenue.total,
    lateFeesCollectedCents: lateFees.total,
  };
}
```

**Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/server/services/dashboard.test.ts`
Expected: All 8 tests PASS

**Step 3: Commit**

```bash
git add server/services/dashboard.ts
git commit -m "feat: implement dashboard stats service"
```

---

### Task 3: Dashboard Route — Failing Tests

**Files:**
- Create: `tests/server/routes/dashboard.test.ts`

**Step 1: Write failing tests for `GET /api/dashboard/stats`**

```typescript
// ABOUTME: Tests for the dashboard API route (today's activity stats endpoint)
// ABOUTME: Validates HTTP response shape and correct values from seeded data

import { describe, it, expect } from 'vitest';
import { createTestDb, migrateTestDb } from '../../setup.js';
import { createDashboardRoutes } from '../../../server/routes/dashboard.js';
import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import {
  customers,
  transactions,
  titles,
  copies,
  rentals,
  pricingRules,
} from '../../../server/db/schema.js';

function buildApp() {
  const { db, sqlite } = createTestDb();
  migrateTestDb(sqlite);
  const routes = createDashboardRoutes(db);
  const app = new Hono();
  app.route('/api/dashboard', routes);
  return { app, db, sqlite };
}

async function seedCustomer(db: any) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: 'Test',
    lastName: 'Customer',
    memberBarcode: `MBR-${nanoid(8)}`,
    balance: 0,
  });
  return id;
}

describe('Dashboard API', () => {
  describe('GET /api/dashboard/stats', () => {
    it('returns 200 with stats shape', async () => {
      const { app } = buildApp();
      const res = await app.request('/api/dashboard/stats');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('rentalsToday');
      expect(body).toHaveProperty('returnsToday');
      expect(body).toHaveProperty('revenueCents');
      expect(body).toHaveProperty('lateFeesCollectedCents');
    });

    it('returns zeros when no activity exists', async () => {
      const { app } = buildApp();
      const res = await app.request('/api/dashboard/stats');
      const body = await res.json();

      expect(body.rentalsToday).toBe(0);
      expect(body.returnsToday).toBe(0);
      expect(body.revenueCents).toBe(0);
      expect(body.lateFeesCollectedCents).toBe(0);
    });

    it('returns correct counts with seeded data', async () => {
      const { app, db } = buildApp();
      const customerId = await seedCustomer(db);

      // Create a rental transaction today
      await db.insert(transactions).values({
        id: nanoid(),
        customerId,
        type: 'rental',
        subtotal: 399,
        tax: 32,
        total: 431,
        paymentMethod: 'cash',
        voided: 0,
        createdAt: new Date().toISOString(),
      });

      // Create a return today
      const titleId = nanoid();
      await db.insert(titles).values({ id: titleId, name: 'Test', year: 2024 });
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: `BC-${nanoid(6)}`,
        format: 'VHS',
        status: 'in',
      });
      const prId = nanoid();
      await db.insert(pricingRules).values({
        id: prId,
        name: '7-Day',
        type: 'rental',
        rate: 399,
        durationDays: 7,
        lateFeePerDay: 100,
        active: 1,
      });
      await db.insert(rentals).values({
        id: nanoid(),
        customerId,
        copyId,
        pricingRuleId: prId,
        checkedOutAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        dueAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        returnedAt: new Date().toISOString(),
        lateFee: 100,
        lateFeeStatus: 'paid',
        status: 'returned',
      });

      const res = await app.request('/api/dashboard/stats');
      const body = await res.json();

      expect(body.rentalsToday).toBe(1);
      expect(body.returnsToday).toBe(1);
      expect(body.revenueCents).toBe(431);
      expect(body.lateFeesCollectedCents).toBe(100);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/routes/dashboard.test.ts`
Expected: FAIL — cannot resolve `../../../server/routes/dashboard.js`

**Step 3: Commit failing tests**

```bash
git add tests/server/routes/dashboard.test.ts
git commit -m "test: add failing tests for dashboard stats route"
```

---

### Task 4: Dashboard Route — Implementation

**Files:**
- Create: `server/routes/dashboard.ts`
- Modify: `server/app.ts:19-49` (add import and route mount)

**Step 1: Create the route handler**

```typescript
// ABOUTME: Dashboard API routes for today's activity stats
// ABOUTME: Provides aggregated daily metrics for the dashboard panel

import { Hono } from 'hono';
import { getTodayStats } from '../services/dashboard.js';

export function createDashboardRoutes(db: any) {
  const routes = new Hono();

  // GET /stats — get today's activity aggregations
  routes.get('/stats', async (c) => {
    const stats = await getTodayStats(db);
    return c.json(stats);
  });

  return routes;
}
```

**Step 2: Mount in app.ts**

Add import after line 19 (after alerts import):
```typescript
import { createDashboardRoutes } from './routes/dashboard.js';
```

Add route mount after line 48 (after alerts mount):
```typescript
app.route('/api/dashboard', createDashboardRoutes(db));
```

**Step 3: Run route tests to verify they pass**

Run: `npx vitest run tests/server/routes/dashboard.test.ts`
Expected: All 3 tests PASS

**Step 4: Run service tests to confirm nothing broke**

Run: `npx vitest run tests/server/services/dashboard.test.ts`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add server/routes/dashboard.ts server/app.ts
git commit -m "feat: add dashboard stats route at GET /api/dashboard/stats"
```

---

### Task 5: Frontend — Wire Dashboard to Stats Endpoint

**Files:**
- Modify: `client/src/api/client.ts:40-123` (add dashboard namespace)
- Modify: `client/src/components/dashboard/Dashboard.tsx:194-309` (wire stats data)

**Step 1: Add `api.dashboard.stats()` to client**

In `client/src/api/client.ts`, add after the `settings` namespace (before the closing `};` of the `api` object):

```typescript
  dashboard: {
    stats: () => get<any>('/api/dashboard/stats'),
  },
```

**Step 2: Add state and fetch logic in Dashboard.tsx**

Add a new state variable after the `errors` state (around line 201):
```typescript
const [todayStats, setTodayStats] = useState<{
  rentalsToday: number;
  returnsToday: number;
  revenueCents: number;
  lateFeesCollectedCents: number;
} | null>(null);
```

Add `api.dashboard.stats()` to the `Promise.allSettled` call in `loadDashboard` (line 207). Update the destructuring to include it:
```typescript
const [overdueResult, lowStockResult, reservationsResult, titlesResult, customersResult, statsResult] =
  await Promise.allSettled([
    api.rentals.overdue(),
    api.products.lowStock(),
    api.reservations.list(),
    api.titles.list({ limit: '1' }),
    api.customers.list({ limit: '1' }),
    api.dashboard.stats(),
  ]);
```

Add handler after the `customersResult` handler (after line 248):
```typescript
if (statsResult.status === 'fulfilled') {
  setTodayStats(statsResult.value);
} else {
  errs.push('dashboard stats');
}
```

**Step 3: Replace the hardcoded TODAY'S ACTIVITY panel (lines 281-309)**

Replace the entire panel body content with dynamic values:

```tsx
<div style={panelBodyStyle}>
  <div style={statRowStyle}>
    <span style={statLabelStyle}>Rentals today</span>
    <span style={statValueStyle}>{todayStats ? todayStats.rentalsToday : '—'}</span>
  </div>
  <div style={statRowStyle}>
    <span style={statLabelStyle}>Returns today</span>
    <span style={statValueStyle}>{todayStats ? todayStats.returnsToday : '—'}</span>
  </div>
  <div style={statRowStyle}>
    <span style={statLabelStyle}>Revenue</span>
    <span style={statValueStyle}>
      {todayStats ? formatCurrency(todayStats.revenueCents) : '—'}
    </span>
  </div>
  <div style={statRowStyle}>
    <span style={statLabelStyle}>Late fees collected</span>
    <span style={statValueStyle}>
      {todayStats ? formatCurrency(todayStats.lateFeesCollectedCents) : '—'}
    </span>
  </div>
</div>
```

This removes the TODO comment and the "Awaiting dashboard stats endpoint" message. The `formatCurrency` helper already exists at line 188.

**Step 4: Verify the app builds**

Run: `npx tsc --noEmit` (or whatever the project's type-check command is)
Expected: No errors

**Step 5: Commit**

```bash
git add client/src/api/client.ts client/src/components/dashboard/Dashboard.tsx
git commit -m "feat: wire dashboard Today's Activity panel to stats endpoint"
```

---

### Task 6: Run Full Test Suite

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass, including new dashboard service and route tests

**Step 2: If any tests fail, fix them before proceeding**

**Step 3: Commit any fixes if needed**
