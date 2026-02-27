# Customer Requirements Gap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close every gap between the customer's must-have requirements and the current reRun implementation before store launch on March 14, 2026.

**Architecture:** All changes extend the existing Hono + Drizzle + React stack. New schema columns use SQLite migrations. Equipment rentals reuse the existing copies/rentals model with a new `equipment` table. Email notifications use Nodemailer with configurable SMTP. No new external services except SMTP.

**Tech Stack:** Drizzle ORM (SQLite), Hono, React 19, Nodemailer, Vitest

---

## Gap Summary

| # | Gap | Effort | Priority |
|---|-----|--------|----------|
| 1 | Director field missing from titles | Small | P0 |
| 2 | Family member birthday + age-based rating restriction | Small | P0 |
| 3 | Rentable equipment (DVD/VHS players) | Medium | P0 |
| 4 | Search by director | Small | P0 |
| 5 | 4-night rental + noon return cutoff | Small | P1 |
| 6 | Default $0.25/day late fee pricing rule | Small | P1 |
| 7 | Credit card storage (tokenized) | Medium | P1 |
| 8 | Overdue email notifications | Medium | P2 |

---

## Task 1: Add Director Field to Titles

The `titles` table has no `director` column. The CSV import parses it but discards it. TMDb enrichment doesn't populate it either.

**Files:**
- Modify: `server/db/schema.ts:8-21` (add director column)
- Modify: `server/routes/titles.ts:72-83` (accept director in create)
- Modify: `server/routes/titles.ts:111-114` (accept director in update)
- Modify: `server/routes/titles.ts:25-34` (include director in list query)
- Modify: `server/routes/import.ts:80-93` (save director on commit)
- Modify: `server/routes/search.ts` (add director to text search)
- Modify: `server/services/tmdb.ts` (extract director from credits)
- Test: `tests/server/routes/titles.test.ts`
- Test: `tests/server/routes/import.test.ts`
- Test: `tests/server/routes/search.test.ts`
- Test: `tests/server/services/tmdb.test.ts`
- Migration: `drizzle/` (new migration via `npm run db:generate`)

**Step 1: Write failing test for director in title creation**

```typescript
// In tests/server/routes/titles.test.ts
it('stores and returns director field', async () => {
  const res = await app.request('/api/titles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alien', year: 1979, director: 'Ridley Scott' }),
  });
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.director).toBe('Ridley Scott');
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/routes/titles.test.ts -t "stores and returns director"`
Expected: FAIL — director field not in schema

**Step 3: Add director column to schema**

In `server/db/schema.ts`, add after `coverUrl`:
```typescript
director: text('director'),
```

**Step 4: Generate and apply migration**

Run: `npm run db:generate && npm run db:migrate`

**Step 5: Update title routes to handle director**

In `server/routes/titles.ts`:
- Add `director: body.director ?? null` to POST values object (line ~82)
- Add `'director'` to `updatableFields` array (line ~112)
- Add `t.director` to the raw SQL SELECT in GET / (line ~29)

**Step 6: Update import commit to save director**

In `server/routes/import.ts` `/commit` handler, add to the insert values:
```typescript
director: item.director ?? null,
```

**Step 7: Update search to include director**

In `server/routes/search.ts`, add `director` to the text search fields alongside `name`, `cast_list`, `synopsis`, `genre`.

**Step 8: Update TMDb client to extract director**

In `server/services/tmdb.ts`, `getMovieDetails` method:
```typescript
// After the cast extraction block
const directorEntry = (data.credits?.crew || [])
  .find((c: any) => c.job === 'Director');
const director = directorEntry ? directorEntry.name : null;
```
Add `director` to `TmdbMovieDetails` interface and return object.

**Step 9: Update import match to populate director from TMDb**

In `server/routes/import.ts` `/match` TMDb enrichment block, add:
```typescript
director: item.director || details.director || '',
```

**Step 10: Write tests for director in search and import**

```typescript
// search test: verify director is searchable
// import test: verify director survives the parse→match→commit pipeline
// tmdb test: verify director extracted from credits.crew
```

**Step 11: Run all tests, verify pass**

Run: `npx vitest run`

**Step 12: Commit**

```bash
git add -A && git commit -m "feat: add director field to titles with search and TMDb support"
```

---

## Task 2: Family Member Birthdays + Age-Based Rating Restrictions

Family members can check out videos but there's no birthday field to enforce rating restrictions. The customer wants to know what rating a family member can check out based on age.

**Files:**
- Modify: `server/db/schema.ts:52-58` (add birthday to family_members)
- Modify: `server/routes/customers.ts` (accept birthday in family CRUD)
- Create: `server/services/rating-restriction.ts` (age→allowed ratings logic)
- Modify: `server/services/rental.ts` (enforce rating check on checkout)
- Test: `tests/server/services/rating-restriction.test.ts`
- Test: `tests/server/routes/customers.test.ts`
- Test: `tests/server/routes/rentals.test.ts`
- Migration: new migration

**Step 1: Write failing test for rating restriction service**

```typescript
// tests/server/services/rating-restriction.test.ts
import { getAllowedRatings, getAgeFromBirthday } from '../../server/services/rating-restriction';

describe('rating restrictions', () => {
  it('allows all ratings for age 18+', () => {
    expect(getAllowedRatings(18)).toEqual(['G', 'PG', 'PG-13', 'R', 'NC-17']);
  });
  it('restricts R and NC-17 for age 13-16', () => {
    expect(getAllowedRatings(15)).toEqual(['G', 'PG', 'PG-13']);
  });
  it('restricts PG-13, R, NC-17 for under 13', () => {
    expect(getAllowedRatings(10)).toEqual(['G', 'PG']);
  });
  it('calculates age from birthday string', () => {
    // Use a fixed reference date for testing
    const age = getAgeFromBirthday('2010-06-15', new Date('2026-02-27'));
    expect(age).toBe(15);
  });
});
```

**Step 2: Implement rating restriction service**

```typescript
// server/services/rating-restriction.ts
const RATING_AGE_MAP: Record<string, number> = {
  'G': 0,
  'PG': 0,
  'PG-13': 13,
  'R': 17,
  'NC-17': 18,
};

const ALL_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];

export function getAgeFromBirthday(birthday: string, now: Date = new Date()): number {
  const birth = new Date(birthday);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function getAllowedRatings(age: number): string[] {
  return ALL_RATINGS.filter((r) => age >= RATING_AGE_MAP[r]);
}

export function canRentRating(birthday: string | null, rating: string | null): { allowed: boolean; reason?: string } {
  if (!birthday || !rating) return { allowed: true }; // No restriction if data missing
  const age = getAgeFromBirthday(birthday);
  const allowed = getAllowedRatings(age);
  if (allowed.includes(rating.toUpperCase())) return { allowed: true };
  return { allowed: false, reason: `Age ${age} cannot rent ${rating}-rated titles` };
}
```

**Step 3: Add birthday column to family_members schema**

```typescript
birthday: text('birthday'),
```

**Step 4: Update customer routes to accept birthday for family members**

In the POST `/:id/family` handler, add `birthday: body.birthday ?? null` to insert values.

**Step 5: Integrate rating check into rental checkout**

In `server/services/rental.ts` checkout function, before creating the rental:
- Look up the renting person (customer or family member)
- Get their birthday
- Get the title's rating (via copy → title join)
- Call `canRentRating(birthday, rating)`
- Return 403 with reason if not allowed

**Step 6: Write integration test for checkout rejection**

```typescript
// A 10-year-old family member tries to rent an R-rated movie → 403
```

**Step 7: Run all tests, verify pass**

**Step 8: Commit**

```bash
git commit -m "feat: family member birthdays with age-based rating restrictions"
```

---

## Task 3: Rentable Equipment (DVD/VHS Players)

The customer wants to rent out DVD and VHS players alongside movies. Equipment needs its own catalog, tracking, and rental flow.

**Files:**
- Modify: `server/db/schema.ts` (add `equipment` table)
- Create: `server/routes/equipment.ts` (CRUD + rental endpoints)
- Modify: `server/app.ts` (mount equipment routes)
- Modify: `server/db/schema.ts:88-101` (add optional equipmentId to rentals)
- Modify: `server/services/rental.ts` (support equipment checkout/return)
- Modify: `client/src/api/client.ts` (add equipment API methods)
- Test: `tests/server/routes/equipment.test.ts`
- Migration: new migration

**Design:** Equipment reuses the `rentals` table. A rental row either has a `copyId` (movie) or an `equipmentId` (player), never both. Equipment has its own pricing rules, barcode, format type, and condition tracking.

**Step 1: Write failing test for equipment CRUD**

```typescript
describe('Equipment routes', () => {
  it('creates equipment with type, barcode, and condition', async () => {
    const res = await app.request('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'VHS Player',
        brand: 'Sony',
        model: 'SLV-N750',
        barcode: 'EQ-VHS-001',
        condition: 'good',
        rentalRate: 499, // $4.99/rental
        lateFeePerDay: 199, // $1.99/day
        durationDays: 7,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.type).toBe('VHS Player');
    expect(body.barcode).toBe('EQ-VHS-001');
  });

  it('lists all equipment with status', async () => { /* ... */ });
  it('checks out equipment to a customer', async () => { /* ... */ });
  it('returns equipment and calculates late fees', async () => { /* ... */ });
});
```

**Step 2: Define equipment schema**

```typescript
export const equipment = sqliteTable('equipment', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // 'VHS Player', 'DVD Player', 'Blu-ray Player'
  brand: text('brand'),
  model: text('model'),
  barcode: text('barcode').notNull().unique(),
  condition: text('condition').default('good'),
  status: text('status').default('in'), // 'in', 'out'
  rentalRate: integer('rental_rate').notNull(), // cents
  lateFeePerDay: integer('late_fee_per_day').default(0),
  durationDays: integer('duration_days').default(7),
  notes: text('notes'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});
```

**Step 3: Add equipmentId to rentals table**

```typescript
equipmentId: text('equipment_id').references(() => equipment.id),
```

A rental has either `copyId` (movie) or `equipmentId` (player), not both.

**Step 4: Create equipment routes**

Standard CRUD: `GET /`, `POST /`, `PUT /:id`, plus:
- `POST /checkout` — checkout equipment to customer (creates rental)
- `POST /return` — return equipment (same late fee logic as movies)
- `GET /barcode/:barcode` — lookup by barcode (for scanner)

**Step 5: Update rental service to support equipment**

The checkout and return functions need to handle `equipmentId` alongside `copyId`. Late fee calculation is the same — just reads from equipment row instead of pricing rule.

**Step 6: Wire up routes in app.ts**

```typescript
import { createEquipmentRoutes } from './routes/equipment.js';
app.route('/api/equipment', createEquipmentRoutes(db));
```

**Step 7: Add to API client**

```typescript
equipment: {
  list: () => get<any>('/api/equipment'),
  get: (id: string) => get<any>(`/api/equipment/${id}`),
  create: (data: any) => post<any>('/api/equipment', data),
  update: (id: string, data: any) => put<any>(`/api/equipment/${id}`, data),
  checkout: (data: any) => post<any>('/api/equipment/checkout', data),
  return: (data: any) => post<any>('/api/equipment/return', data),
  lookupBarcode: (barcode: string) => get<any>(`/api/equipment/barcode/${barcode}`),
},
```

**Step 8: Run tests, verify pass**

**Step 9: Commit**

```bash
git commit -m "feat: rentable equipment (DVD/VHS players) with checkout and return"
```

---

## Task 4: Search by Director

Currently search queries `name`, `cast_list`, `synopsis`, `genre`. Director needs to be added once Task 1 is complete.

**Covered in Task 1 Step 7.** No separate task needed.

---

## Task 5: 4-Night Rental + Noon Return Cutoff

The customer's rental policy: 4 nights, return by noon of the 5th day. Currently due dates are calculated as full 24-hour blocks with no time-of-day enforcement.

**Files:**
- Modify: `server/services/rental.ts` (due date = checkout date + N days at 12:00 noon)
- Modify: `scripts/setup.ts` (seed a 4-night pricing rule)
- Test: `tests/server/services/rental.test.ts`

**Step 1: Write failing test for noon cutoff**

```typescript
it('sets due date to noon on the Nth day after checkout', () => {
  // Checked out Feb 27 at 6pm, 4-night rental
  // Due: March 3 at 12:00 PM (noon)
  const checkoutTime = new Date('2026-02-27T18:00:00');
  const dueDate = calculateDueDate(checkoutTime, 4);
  expect(dueDate.getHours()).toBe(12);
  expect(dueDate.getMinutes()).toBe(0);
  expect(dueDate.getDate()).toBe(3); // Feb 27 + 4 days = Mar 3
});
```

**Step 2: Update due date calculation**

In `server/services/rental.ts`, change from:
```typescript
const dueDate = new Date(now.getTime() + rule.durationDays * 24 * 60 * 60 * 1000);
```
To:
```typescript
const dueDate = new Date(now);
dueDate.setDate(dueDate.getDate() + rule.durationDays);
dueDate.setHours(12, 0, 0, 0); // Noon cutoff
```

**Step 3: Seed a 4-night pricing rule**

In `scripts/setup.ts`, add to default pricing rules:
```typescript
{ name: '4-Night Standard', type: 'standard', rate: 399, durationDays: 4, lateFeePerDay: 25 }
// $3.99 rental, 4 nights, $0.25/day late fee
```

**Step 4: Run tests, verify pass**

**Step 5: Commit**

```bash
git commit -m "feat: noon return cutoff for rental due dates"
```

---

## Task 6: Default $0.25/Day Late Fee Pricing Rule

The seeded pricing rules have $0.99-$1.99 late fees. Customer wants $0.25/day.

**Files:**
- Modify: `scripts/setup.ts` (update default pricing rules)

**Step 1: Update seeded late fee values**

Change all `lateFeePerDay` values to `25` (= $0.25 in cents) in `scripts/setup.ts`.

This is a seed data change. Existing databases keep their current values. New installs get the customer's rate.

**Step 2: Commit**

```bash
git commit -m "fix: default late fee to $0.25/day per customer requirement"
```

---

## Task 7: Credit Card Storage (Tokenized)

The customer wants credit card info stored for members. Raw card numbers must never touch our database.

**Files:**
- Modify: `server/db/schema.ts:34-49` (add payment fields to customers)
- Create: `server/services/payment.ts` (Stripe/Square token management)
- Modify: `server/routes/customers.ts` (card endpoints)
- Test: `tests/server/routes/customers.test.ts`
- Test: `tests/server/services/payment.test.ts`
- Migration: new migration

**Design Decision Needed:** Which payment processor? Options:
- **Stripe** — most common, good API, requires internet
- **Square** — designed for POS, has hardware readers, good offline support
- **Simple "card on file" reference** — just store last 4 digits + expiry for manual processing (no automated charging)

> **Dylan:** This needs your input. A full Stripe/Square integration is a meaningful lift and the store is local-first. A simpler approach: store `cardLast4`, `cardExpiry`, `cardBrand` on the customer — enough for the clerk to reference, no PCI scope. Automated charging can come later. Your call.

**Step 1 (assuming simple approach): Add card reference fields**

```typescript
// In customers table
cardLast4: text('card_last4'),
cardExpiry: text('card_expiry'),
cardBrand: text('card_brand'), // 'visa', 'mastercard', etc.
```

**Step 2: Update customer routes**

Accept and return card fields on create/update. Validate that `cardLast4` is exactly 4 digits if provided.

**Step 3: Run tests, commit**

```bash
git commit -m "feat: card-on-file reference fields for customer accounts"
```

---

## Task 8: Overdue Email Notifications

The system detects overdue rentals but doesn't send email. This wires up actual email delivery.

**Files:**
- Create: `server/services/email.ts` (Nodemailer SMTP transport)
- Create: `server/services/overdue-notifier.ts` (query overdue → send emails)
- Modify: `server/index.ts` (schedule periodic overdue check)
- Test: `tests/server/services/email.test.ts`
- Test: `tests/server/services/overdue-notifier.test.ts`
- Config: `.env.example` (add SMTP vars)

**Design:** A timer runs every hour (configurable). It queries overdue rentals, checks if the customer has email, and sends a notification. Each rental only gets one notification (tracked by a `notifiedAt` field on the rental).

**Step 1: Write failing test for email service**

```typescript
it('sends an overdue notification email', async () => {
  const sent = await sendOverdueEmail({
    to: 'customer@example.com',
    customerName: 'Wayne Campbell',
    titles: [{ name: "Wayne's World", dueAt: '2026-02-25', daysOverdue: 2 }],
    storeName: 'Way Cool Video',
    storePhone: '555-1234',
  });
  expect(sent).toBe(true);
});
```

**Step 2: Implement email service with Nodemailer**

```typescript
// server/services/email.ts
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
```

**Step 3: Implement overdue notifier**

- Query `rentals` where `status = 'out'` AND `dueAt < now` AND `notifiedAt IS NULL`
- Join to customer for email
- Group by customer (one email per customer listing all overdue titles)
- Send email, set `notifiedAt` on rental

**Step 4: Add `notifiedAt` column to rentals**

```typescript
notifiedAt: text('notified_at'),
```

**Step 5: Add periodic check in server startup**

```typescript
// In server/index.ts, after server starts
const OVERDUE_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
setInterval(() => checkAndNotifyOverdue(db), OVERDUE_CHECK_INTERVAL);
```

**Step 6: Add SMTP config to .env.example**

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@waycoolvideoaz.com
```

**Step 7: Run tests, commit**

```bash
git commit -m "feat: overdue email notifications with hourly check"
```

---

## Execution Order

Tasks should be executed in this order due to dependencies:

1. **Task 1** (director field) — foundation, unblocks search
2. **Task 2** (family birthdays + rating restrictions) — standalone
3. **Task 5** (noon cutoff) — standalone, quick
4. **Task 6** (late fee default) — standalone, trivial
5. **Task 3** (equipment rentals) — largest task, no deps
6. **Task 7** (credit card) — needs design decision first
7. **Task 8** (email notifications) — needs SMTP credentials

Tasks 1, 2, 5, 6 are all quick wins (< 30 min each). Task 3 is the biggest lift (~2 hrs). Tasks 7 and 8 need external decisions/credentials before starting.
