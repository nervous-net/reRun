# Family Members & Minor Rental Checks Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add edit/delete for family members, birthdate field, family name search, minor rental age checks with parent approval, and fix POS customer pre-fill from customer page.

**Architecture:** Schema-first approach — add `birthday` and `active` columns to `family_members` in one migration, then build features in dependency order. Backend changes follow existing route→service pattern. Minor check happens at checkout time in the rental route, returning a warning the frontend displays as a confirmation dialog.

**Tech Stack:** Drizzle ORM (SQLite), Hono routes, React (no framework), Vitest

---

### Task 1: Schema Migration — Add birthday and active to family_members

**Files:**
- Modify: `server/db/schema.ts:58-66`
- Modify: `tests/setup.ts:62-68`

**Step 1: Update Drizzle schema**

In `server/db/schema.ts`, update the `familyMembers` table definition:

```typescript
export const familyMembers = sqliteTable('family_members', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull().references(() => customers.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  relationship: text('relationship'),
  birthday: text('birthday'),
  active: integer('active').default(1),
}, (table) => [
  index('family_members_customer_id_idx').on(table.customerId),
]);
```

**Step 2: Update test setup SQL**

In `tests/setup.ts`, update the `family_members` CREATE TABLE to add the new columns:

```sql
CREATE TABLE IF NOT EXISTS family_members (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relationship TEXT,
  birthday TEXT,
  active INTEGER DEFAULT 1
);
```

**Step 3: Generate Drizzle migration**

Run: `npx drizzle-kit generate`

This creates a new SQL migration file in `drizzle/`.

**Step 4: Push schema to dev database**

Run: `npx drizzle-kit push`

**Step 5: Verify existing tests still pass**

Run: `npm test`
Expected: All tests pass (schema change is additive, no breaking changes)

**Step 6: Commit**

```bash
git add server/db/schema.ts tests/setup.ts drizzle/
git commit -m "feat: add birthday and active columns to family_members table"
```

---

### Task 2: Backend — Edit family member endpoint (PUT)

**Files:**
- Modify: `server/routes/customers.ts:219-240` (add PUT route before existing DELETE)
- Test: `tests/server/routes/customers.test.ts`

**Step 1: Write failing tests for PUT /:id/family/:familyId**

Add to `tests/server/routes/customers.test.ts`:

```typescript
describe('PUT /api/customers/:id/family/:familyId', () => {
  it('updates a family member name and relationship', async () => {
    // Create customer
    const custRes = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Doc', lastName: 'Brown' }),
    });
    const cust = await custRes.json();

    // Add family member
    const famRes = await app.request(`/api/customers/${cust.id}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Clara', lastName: 'Clayton', relationship: 'friend' }),
    });
    const fam = await famRes.json();

    // Update family member
    const updateRes = await app.request(`/api/customers/${cust.id}/family/${fam.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastName: 'Brown', relationship: 'spouse', birthday: '1855-01-15' }),
    });

    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.lastName).toBe('Brown');
    expect(updated.relationship).toBe('spouse');
    expect(updated.birthday).toBe('1855-01-15');
    expect(updated.firstName).toBe('Clara'); // unchanged
  });

  it('returns 404 if family member not found', async () => {
    const custRes = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Biff', lastName: 'Tannen' }),
    });
    const cust = await custRes.json();

    const res = await app.request(`/api/customers/${cust.id}/family/nonexistent`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Griff' }),
    });

    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/server/routes/customers.test.ts`
Expected: FAIL — 404 because PUT route doesn't exist yet

**Step 3: Implement PUT route**

Add to `server/routes/customers.ts` before the DELETE route (before line 219):

```typescript
  // PUT /:id/family/:familyId — update family member
  routes.put('/:id/family/:familyId', async (c) => {
    const customerId = c.req.param('id');
    const familyId = c.req.param('familyId');
    const body = await c.req.json();

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, familyId))
      .all();

    if (!member || member.customerId !== customerId) {
      return c.json({ error: 'Family member not found' }, 404);
    }

    const updates: Record<string, any> = {};
    const allowedFields = ['firstName', 'lastName', 'relationship', 'birthday'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    await db
      .update(familyMembers)
      .set(updates)
      .where(eq(familyMembers.id, familyId))
      .run();

    const [updated] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, familyId))
      .all();

    return c.json(updated);
  });
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/server/routes/customers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/customers.ts tests/server/routes/customers.test.ts
git commit -m "feat: add PUT endpoint to edit family members"
```

---

### Task 3: Backend — Soft delete family members

**Files:**
- Modify: `server/routes/customers.ts` (modify DELETE route, modify GET /:id, modify POST /:id/family count)
- Test: `tests/server/routes/customers.test.ts`

**Step 1: Write failing tests for soft delete**

Add to `tests/server/routes/customers.test.ts`:

```typescript
describe('DELETE /api/customers/:id/family/:familyId (soft delete)', () => {
  it('soft deletes a family member by setting active to 0', async () => {
    const custRes = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'George', lastName: 'McFly' }),
    });
    const cust = await custRes.json();

    const famRes = await app.request(`/api/customers/${cust.id}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Lorraine', lastName: 'McFly', relationship: 'spouse' }),
    });
    const fam = await famRes.json();

    // Delete
    const delRes = await app.request(`/api/customers/${cust.id}/family/${fam.id}`, {
      method: 'DELETE',
    });
    expect(delRes.status).toBe(200);

    // GET customer should NOT include soft-deleted member
    const getRes = await app.request(`/api/customers/${cust.id}`);
    const customer = await getRes.json();
    expect(customer.familyMembers).toHaveLength(0);
  });

  it('does not count soft-deleted members toward family member limit', async () => {
    // Insert max_family_members setting = 1
    sqlite.exec("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('max_family_members', '1')");

    const custRes = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'George', lastName: 'McFly' }),
    });
    const cust = await custRes.json();

    // Add first family member
    const fam1Res = await app.request(`/api/customers/${cust.id}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Lorraine', lastName: 'McFly' }),
    });
    const fam1 = await fam1Res.json();

    // Soft delete first
    await app.request(`/api/customers/${cust.id}/family/${fam1.id}`, { method: 'DELETE' });

    // Should be able to add another (deleted one doesn't count)
    const fam2Res = await app.request(`/api/customers/${cust.id}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Dave', lastName: 'McFly' }),
    });
    expect(fam2Res.status).toBe(201);

    // Cleanup
    sqlite.exec("DELETE FROM store_settings WHERE key = 'max_family_members'");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/server/routes/customers.test.ts`
Expected: FAIL — current DELETE does hard delete, GET doesn't filter by active

**Step 3: Implement soft delete changes**

In `server/routes/customers.ts`:

**3a.** Change the DELETE route to soft delete (update instead of delete):

```typescript
  // DELETE /:id/family/:familyId — soft delete family member
  routes.delete('/:id/family/:familyId', async (c) => {
    const familyId = c.req.param('familyId');
    const customerId = c.req.param('id');

    const [member] = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, familyId))
      .all();

    if (!member || member.customerId !== customerId) {
      return c.json({ error: 'Family member not found' }, 404);
    }

    await db
      .update(familyMembers)
      .set({ active: 0 })
      .where(eq(familyMembers.id, familyId))
      .run();

    return c.json({ success: true });
  });
```

**3b.** Update GET /:id to filter family members by active=1:

```typescript
    const family = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.customerId, id), eq(familyMembers.active, 1)))
      .all();
```

Add `and` to the imports from `drizzle-orm`.

**3c.** Update POST /:id/family count check to only count active members:

```typescript
    const [memberCount] = await db.select({ count: count() }).from(familyMembers).where(and(eq(familyMembers.customerId, customerId), eq(familyMembers.active, 1)));
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/server/routes/customers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/customers.ts tests/server/routes/customers.test.ts
git commit -m "feat: soft delete family members instead of hard delete"
```

---

### Task 4: Backend — Add birthday to family member creation

**Files:**
- Modify: `server/routes/customers.ts` (POST /:id/family route)
- Test: `tests/server/routes/customers.test.ts`

**Step 1: Write failing test**

Add to `tests/server/routes/customers.test.ts`:

```typescript
describe('POST /api/customers/:id/family (with birthday)', () => {
  it('creates a family member with birthday', async () => {
    const custRes = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Emmett', lastName: 'Brown' }),
    });
    const cust = await custRes.json();

    const res = await app.request(`/api/customers/${cust.id}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Jules',
        lastName: 'Brown',
        relationship: 'child',
        birthday: '2015-06-15',
      }),
    });

    expect(res.status).toBe(201);
    const member = await res.json();
    expect(member.birthday).toBe('2015-06-15');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/routes/customers.test.ts`
Expected: FAIL — birthday not included in insert values

**Step 3: Add birthday to the POST handler**

In `server/routes/customers.ts`, update the `newMember` object in POST /:id/family:

```typescript
    const newMember = {
      id,
      customerId,
      firstName: body.firstName,
      lastName: body.lastName,
      relationship: body.relationship || null,
      birthday: body.birthday || null,
    };
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/routes/customers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/customers.ts tests/server/routes/customers.test.ts
git commit -m "feat: accept birthday field when creating family members"
```

---

### Task 5: Backend — Search customers by family member name

**Files:**
- Modify: `server/routes/customers.ts` (GET /search route)
- Test: `tests/server/routes/customers.test.ts`

**Step 1: Write failing test**

Add to the existing `GET /api/customers/search` describe block in `tests/server/routes/customers.test.ts`:

```typescript
  it('finds customers by family member name', async () => {
    // Create customer
    const custRes = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'George', lastName: 'McFly' }),
    });
    const cust = await custRes.json();

    // Add family member with distinctive name
    await app.request(`/api/customers/${cust.id}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Lorraine', lastName: 'Baines' }),
    });

    // Search by family member's first name
    const res = await app.request('/api/customers/search?q=Lorraine');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(1);
    expect(body.data[0].id).toBe(cust.id);
  });

  it('does not find customers by inactive family member name', async () => {
    const custRes = await app.request('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Biff', lastName: 'Tannen' }),
    });
    const cust = await custRes.json();

    // Add and soft-delete family member
    const famRes = await app.request(`/api/customers/${cust.id}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName: 'Gertrude', lastName: 'Tannen' }),
    });
    const fam = await famRes.json();
    await app.request(`/api/customers/${cust.id}/family/${fam.id}`, { method: 'DELETE' });

    // Search by deleted family member name should not return customer
    const res = await app.request('/api/customers/search?q=Gertrude');
    const body = await res.json();
    expect(body.data.length).toBe(0);
  });
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/server/routes/customers.test.ts`
Expected: FAIL — search only checks customer fields, not family members

**Step 3: Update search route to include family member names**

Replace the GET /search handler in `server/routes/customers.ts`:

```typescript
  routes.get('/search', async (c) => {
    const q = c.req.query('q');
    if (!q) {
      return c.json({ error: 'Query parameter "q" is required' }, 400);
    }

    const pattern = `%${q}%`;

    // Search customers by their own fields
    const customerResults = await db
      .select()
      .from(customers)
      .where(
        or(
          like(customers.firstName, pattern),
          like(customers.lastName, pattern),
          like(customers.phone, pattern),
          like(customers.email, pattern),
          like(customers.memberBarcode, pattern),
        )
      )
      .all();

    // Search by family member name (active only)
    const familyMatches = await db
      .select({ customerId: familyMembers.customerId })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.active, 1),
          or(
            like(familyMembers.firstName, pattern),
            like(familyMembers.lastName, pattern),
          )
        )
      )
      .all();

    // Merge results, deduplicating by customer ID
    const resultIds = new Set(customerResults.map((c: any) => c.id));
    const familyCustomerIds = familyMatches
      .map((m: any) => m.customerId)
      .filter((id: string) => !resultIds.has(id));

    let combinedResults = [...customerResults];

    if (familyCustomerIds.length > 0) {
      const familyCustomers = await db
        .select()
        .from(customers)
        .where(or(...familyCustomerIds.map((id: string) => eq(customers.id, id))))
        .all();
      combinedResults = [...combinedResults, ...familyCustomers];
    }

    return c.json({ data: combinedResults });
  });
```

Add `and` to imports if not already there (should be from Task 3).

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/server/routes/customers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/customers.ts tests/server/routes/customers.test.ts
git commit -m "feat: customer search includes family member names"
```

---

### Task 6: Backend — Minor age check on rental checkout

**Files:**
- Create: `server/services/age-check.ts`
- Modify: `server/routes/rentals.ts`
- Test: `tests/server/services/age-check.test.ts`
- Test: `tests/server/routes/rentals.test.ts`

**Step 1: Write failing test for age check utility**

Create `tests/server/services/age-check.test.ts`:

```typescript
// ABOUTME: Tests for age check utility used during rental checkout
// ABOUTME: Validates minor detection and rating restriction logic

import { describe, it, expect } from 'vitest';
import { isMinor, checkAgeRestriction } from '../../../server/services/age-check.js';

describe('isMinor', () => {
  it('returns true for someone under 18', () => {
    const today = new Date('2026-03-04');
    expect(isMinor('2010-06-15', today)).toBe(true);
  });

  it('returns false for someone 18 or older', () => {
    const today = new Date('2026-03-04');
    expect(isMinor('2008-03-04', today)).toBe(false);
  });

  it('returns false for someone turning 18 today', () => {
    const today = new Date('2026-03-04');
    expect(isMinor('2008-03-04', today)).toBe(false);
  });

  it('returns true for someone turning 18 tomorrow', () => {
    const today = new Date('2026-03-04');
    expect(isMinor('2008-03-05', today)).toBe(true);
  });

  it('returns null if no birthday provided', () => {
    expect(isMinor(null)).toBeNull();
    expect(isMinor(undefined)).toBeNull();
  });
});

describe('checkAgeRestriction', () => {
  it('returns warning for minor renting R-rated title', () => {
    const result = checkAgeRestriction('2012-01-01', 'R');
    expect(result).not.toBeNull();
    expect(result!.rating).toBe('R');
    expect(result!.requiresApproval).toBe(true);
  });

  it('returns warning for minor renting NC-17 title', () => {
    const result = checkAgeRestriction('2012-01-01', 'NC-17');
    expect(result).not.toBeNull();
    expect(result!.rating).toBe('NC-17');
  });

  it('returns null for adult renting R-rated title', () => {
    const result = checkAgeRestriction('1990-01-01', 'R');
    expect(result).toBeNull();
  });

  it('returns null for minor renting PG title', () => {
    const result = checkAgeRestriction('2012-01-01', 'PG');
    expect(result).toBeNull();
  });

  it('returns null when no birthday on file', () => {
    const result = checkAgeRestriction(null, 'R');
    expect(result).toBeNull();
  });

  it('returns null when no rating on title', () => {
    const result = checkAgeRestriction('2012-01-01', null);
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/server/services/age-check.test.ts`
Expected: FAIL — module not found

**Step 3: Implement age check utility**

Create `server/services/age-check.ts`:

```typescript
// ABOUTME: Age verification utility for rental checkout
// ABOUTME: Checks if a customer or family member is a minor renting age-restricted content

const RESTRICTED_RATINGS = ['R', 'NC-17'];

export interface AgeRestrictionWarning {
  rating: string;
  requiresApproval: boolean;
  message: string;
}

export function isMinor(birthday: string | null | undefined, today?: Date): boolean | null {
  if (!birthday) return null;

  const now = today ?? new Date();
  const birth = new Date(birthday);
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }

  return age < 18;
}

export function checkAgeRestriction(
  birthday: string | null | undefined,
  rating: string | null | undefined,
): AgeRestrictionWarning | null {
  if (!birthday || !rating) return null;
  if (!RESTRICTED_RATINGS.includes(rating)) return null;

  const minor = isMinor(birthday);
  if (!minor) return null;

  return {
    rating,
    requiresApproval: true,
    message: `Customer is under 18. ${rating}-rated content requires parent/guardian approval.`,
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/server/services/age-check.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/age-check.ts tests/server/services/age-check.test.ts
git commit -m "feat: add age check utility for rental restrictions"
```

---

### Task 7: Backend — Wire age check into checkout route

**Files:**
- Modify: `server/routes/rentals.ts`
- Test: `tests/server/routes/rentals.test.ts`

**Step 1: Write failing tests for age check in checkout**

Add to `tests/server/routes/rentals.test.ts`:

```typescript
  describe('age restriction check', () => {
    it('returns ageRestriction warning when minor rents R-rated title', async () => {
      // Create minor customer (born 2015)
      const minorCustomer = {
        id: nanoid(),
        firstName: 'Kid',
        lastName: 'McFly',
        memberBarcode: nanoid(10),
        birthday: '2015-06-15',
      };
      await db.insert(customers).values(minorCustomer).run();

      // Create R-rated title and copy
      const titleId = nanoid();
      await db.insert(titles).values({
        id: titleId,
        name: 'Die Hard',
        year: 1988,
        rating: 'R',
      }).run();
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: 'DH-001',
        format: 'DVD',
        status: 'in',
      }).run();

      // Create pricing rule
      const ruleId = nanoid();
      await db.insert(pricingRules).values({
        id: ruleId,
        name: '2-Day',
        type: 'rental',
        rate: 399,
        durationDays: 2,
      }).run();

      // Checkout without approval — should get warning
      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: minorCustomer.id,
          copyId,
          pricingRuleId: ruleId,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ageRestriction).toBeDefined();
      expect(body.ageRestriction.requiresApproval).toBe(true);
      expect(body.ageRestriction.rating).toBe('R');
    });

    it('allows checkout when parentApproved flag is set', async () => {
      const minorCustomer = {
        id: nanoid(),
        firstName: 'Kid2',
        lastName: 'McFly',
        memberBarcode: nanoid(10),
        birthday: '2015-06-15',
      };
      await db.insert(customers).values(minorCustomer).run();

      const titleId = nanoid();
      await db.insert(titles).values({
        id: titleId,
        name: 'Terminator 2',
        year: 1991,
        rating: 'R',
      }).run();
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: 'T2-001',
        format: 'DVD',
        status: 'in',
      }).run();

      const ruleId = nanoid();
      await db.insert(pricingRules).values({
        id: ruleId,
        name: '2-Day',
        type: 'rental',
        rate: 399,
        durationDays: 2,
      }).run();

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: minorCustomer.id,
          copyId,
          pricingRuleId: ruleId,
          parentApproved: true,
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.status).toBe('out');
    });

    it('does not warn for adult renting R-rated title', async () => {
      const adultCustomer = {
        id: nanoid(),
        firstName: 'Adult',
        lastName: 'McFly',
        memberBarcode: nanoid(10),
        birthday: '1990-01-01',
      };
      await db.insert(customers).values(adultCustomer).run();

      const titleId = nanoid();
      await db.insert(titles).values({
        id: titleId,
        name: 'Aliens',
        year: 1986,
        rating: 'R',
      }).run();
      const copyId = nanoid();
      await db.insert(copies).values({
        id: copyId,
        titleId,
        barcode: 'AL-001',
        format: 'DVD',
        status: 'in',
      }).run();

      const ruleId = nanoid();
      await db.insert(pricingRules).values({
        id: ruleId,
        name: '2-Day',
        type: 'rental',
        rate: 399,
        durationDays: 2,
      }).run();

      const res = await app.request('/api/rentals/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: adultCustomer.id,
          copyId,
          pricingRuleId: ruleId,
        }),
      });

      expect(res.status).toBe(201);
    });
  });
```

Note: you'll need to add `customers`, `titles`, `copies`, `pricingRules` to the schema imports in the test file, and `nanoid` if not already imported.

**Step 2: Run tests to verify they fail**

Run: `npm test -- tests/server/routes/rentals.test.ts`
Expected: FAIL — no ageRestriction in response

**Step 3: Wire age check into checkout route**

Modify `server/routes/rentals.ts`:

Add imports:
```typescript
import { customers, copies, titles } from '../db/schema.js';
import { checkAgeRestriction } from '../services/age-check.js';
```

Update the POST /checkout handler — after the rental limit check but before calling `checkoutCopy`, add age restriction check:

```typescript
    // Age restriction check
    const [copy] = await db.select().from(copies).where(eq(copies.id, body.copyId));
    if (copy) {
      const [title] = await db.select().from(titles).where(eq(titles.id, copy.titleId));
      if (title) {
        const [cust] = await db.select().from(customers).where(eq(customers.id, body.customerId));
        const warning = cust ? checkAgeRestriction(cust.birthday, title.rating) : null;

        if (warning && !body.parentApproved) {
          return c.json({ ageRestriction: warning }, 200);
        }
      }
    }
```

The key design: if there's a restriction and `parentApproved` is not set, return 200 with an `ageRestriction` object instead of creating the rental. The frontend will display the warning and re-submit with `parentApproved: true`.

**Step 4: Run tests to verify they pass**

Run: `npm test -- tests/server/routes/rentals.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/routes/rentals.ts tests/server/routes/rentals.test.ts
git commit -m "feat: check customer age for R/NC-17 rentals at checkout"
```

---

### Task 8: Frontend — Fix POS customer pre-fill from customer page

**Files:**
- Modify: `client/src/components/customers/CustomerCard.tsx:278`

**Step 1: Update the "New Rental" button to pass customerId**

Change line 278 from:
```typescript
<Button variant="primary" onClick={() => navigate('/pos')}>
```
to:
```typescript
<Button variant="primary" onClick={() => navigate(`/pos?customerId=${customer.id}`)}>
```

The POS already reads `customerId` from query params at `POSScreen.tsx:89-98`, so this is the only change needed.

**Step 2: Verify manually or run existing tests**

Run: `npm test`
Expected: PASS (no tests break)

**Step 3: Commit**

```bash
git add client/src/components/customers/CustomerCard.tsx
git commit -m "fix: pass customerId to POS when clicking New Rental from customer page"
```

---

### Task 9: Frontend — Edit and delete family members in CustomerCard

**Files:**
- Modify: `client/src/components/customers/CustomerCard.tsx`
- Modify: `client/src/api/client.ts`

**Step 1: Add updateFamily API method**

In `client/src/api/client.ts`, add to the `customers` object:

```typescript
    updateFamily: (id: string, familyId: string, data: any) => put<any>(`/api/customers/${id}/family/${familyId}`, data),
```

**Step 2: Update FamilyMember interface**

In `client/src/components/customers/CustomerCard.tsx`, update the `FamilyMember` interface:

```typescript
interface FamilyMember {
  id: string;
  firstName: string;
  lastName: string;
  relationship: string | null;
  birthday: string | null;
}
```

**Step 3: Add edit/delete state and handlers**

Add state variables:
```typescript
  const [editingFamily, setEditingFamily] = useState<FamilyMember | null>(null);
  const [editFamilyFirst, setEditFamilyFirst] = useState('');
  const [editFamilyLast, setEditFamilyLast] = useState('');
  const [editFamilyRelation, setEditFamilyRelation] = useState('');
  const [editFamilyBirthday, setEditFamilyBirthday] = useState('');
```

Add handlers:
```typescript
  async function handleEditFamily() {
    if (!customer || !editingFamily) return;
    try {
      await api.customers.updateFamily(customer.id, editingFamily.id, {
        firstName: editFamilyFirst,
        lastName: editFamilyLast,
        relationship: editFamilyRelation || null,
        birthday: editFamilyBirthday || null,
      });
      setEditingFamily(null);
      loadCustomer();
    } catch {
      // Error handling
    }
  }

  async function handleDeleteFamily(familyId: string) {
    if (!customer) return;
    try {
      await api.customers.removeFamily(customer.id, familyId);
      loadCustomer();
    } catch {
      // Error handling
    }
  }

  function startEditFamily(fm: FamilyMember) {
    setEditingFamily(fm);
    setEditFamilyFirst(fm.firstName);
    setEditFamilyLast(fm.lastName);
    setEditFamilyRelation(fm.relationship || '');
    setEditFamilyBirthday(fm.birthday || '');
  }
```

**Step 4: Update family member list display**

Replace the family member list section to add edit/delete buttons and show birthday + age:

```tsx
{customer.familyMembers.map((fm) => (
  <div key={fm.id} style={styles.familyItem}>
    <div>
      <span style={styles.fieldValue}>{fm.firstName} {fm.lastName}</span>
      {fm.relationship && (
        <span style={styles.fieldLabel}> — {fm.relationship}</span>
      )}
      {fm.birthday && (
        <span style={styles.fieldLabel}> — {fm.birthday}</span>
      )}
    </div>
    <div style={{ display: 'flex', gap: '4px' }}>
      <Button variant="ghost" onClick={() => startEditFamily(fm)}>Edit</Button>
      <Button variant="ghost" onClick={() => handleDeleteFamily(fm.id)}>Remove</Button>
    </div>
  </div>
))}
```

**Step 5: Add edit family member modal**

Add modal after the existing add family member modal:

```tsx
      {/* Edit family member modal */}
      <Modal
        isOpen={!!editingFamily}
        onClose={() => setEditingFamily(null)}
        title="Edit Family Member"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingFamily(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleEditFamily}
              disabled={!editFamilyFirst.trim() || !editFamilyLast.trim()}
            >
              Save
            </Button>
          </>
        }
      >
        <div style={styles.formFields}>
          <Input
            label="First Name"
            value={editFamilyFirst}
            onChange={(e) => setEditFamilyFirst(e.target.value)}
            required
          />
          <Input
            label="Last Name"
            value={editFamilyLast}
            onChange={(e) => setEditFamilyLast(e.target.value)}
            required
          />
          <Input
            label="Relationship"
            value={editFamilyRelation}
            onChange={(e) => setEditFamilyRelation(e.target.value)}
            placeholder="e.g. Spouse, Child"
          />
          <Input
            label="Birthday"
            type="date"
            value={editFamilyBirthday}
            onChange={(e) => setEditFamilyBirthday(e.target.value)}
          />
        </div>
      </Modal>
```

**Step 6: Update the add family member modal to include birthday field**

Add a birthday Input to the existing add family member modal, and add state:
```typescript
  const [familyBirthday, setFamilyBirthday] = useState('');
```

Add to the modal form:
```tsx
          <Input
            label="Birthday"
            type="date"
            value={familyBirthday}
            onChange={(e) => setFamilyBirthday(e.target.value)}
          />
```

Update `handleAddFamily` to include birthday in the API call.

**Step 7: Run tests**

Run: `npm test`
Expected: PASS

**Step 8: Commit**

```bash
git add client/src/components/customers/CustomerCard.tsx client/src/api/client.ts
git commit -m "feat: add edit/delete for family members with birthday field"
```

---

### Task 10: Frontend — Age restriction warning dialog on POS checkout

**Files:**
- Modify: `client/src/components/pos/PaymentModal.tsx`

**Step 1: Add age restriction state and UI**

Add state:
```typescript
  const [ageWarning, setAgeWarning] = useState<{ rating: string; message: string } | null>(null);
  const [parentApproved, setParentApproved] = useState(false);
```

**Step 2: Update checkout logic in PaymentModal**

In the checkout loop (where `api.rentals.checkout()` is called for each rental item), check for the `ageRestriction` response:

```typescript
    for (const item of rentalItems) {
      const result = await api.rentals.checkout({
        customerId: customer.id,
        copyId: item.copyId,
        pricingRuleId: item.pricingRuleId,
        parentApproved,
      });

      // If age restriction warning returned, show dialog and stop
      if (result.ageRestriction) {
        setAgeWarning(result.ageRestriction);
        return; // Don't proceed until approved
      }
    }
```

**Step 3: Add warning dialog UI**

Add a warning section to the modal that appears when `ageWarning` is set:

```tsx
{ageWarning && (
  <div style={{
    backgroundColor: 'var(--bg-secondary)',
    border: '2px solid var(--crt-amber)',
    padding: 'var(--space-md)',
    marginBottom: 'var(--space-md)',
    borderRadius: 'var(--border-radius)',
  }}>
    <div style={{ color: 'var(--crt-amber)', fontWeight: 'bold', marginBottom: 'var(--space-sm)' }}>
      AGE RESTRICTION WARNING
    </div>
    <div style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-sm)' }}>
      {ageWarning.message}
    </div>
    <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={parentApproved}
        onChange={(e) => setParentApproved(e.target.checked)}
      />
      <span style={{ color: 'var(--text-primary)' }}>Parent/guardian has approved this rental</span>
    </label>
  </div>
)}
```

When parentApproved changes to true, the complete button should re-attempt checkout with `parentApproved: true`.

**Step 4: Run tests**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/components/pos/PaymentModal.tsx
git commit -m "feat: show age restriction warning dialog for minor renting R/NC-17"
```

---

### Task 11: Final verification

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Start dev server and manually verify**

Run: `npm run dev`

Manual verification checklist:
- [ ] Create customer with birthday
- [ ] Add family member with birthday
- [ ] Edit family member (name, relationship, birthday)
- [ ] Remove family member (verify soft delete — member disappears from UI)
- [ ] Search for customer by family member name
- [ ] Navigate from customer page to POS — customer pre-filled
- [ ] Rent R-rated movie to minor — warning dialog appears
- [ ] Check "parent approved" and complete — rental succeeds
- [ ] Rent R-rated movie to adult — no warning

**Step 3: Commit any fixes needed**
