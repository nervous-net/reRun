# Family Member Rental Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Track which family member rents each item, add a POS picker for family member selection, and check the renter's age for R/NC-17 content.

**Architecture:** Add `familyMemberId` FK to rentals table, update the checkout route to accept and use it for age checks, add a family member picker to the POS after customer selection. The age check function itself doesn't change — we just pass the right person's birthday.

**Tech Stack:** Drizzle ORM (migration), Hono (routes), React (POS components), Vitest (tests)

---

### Task 1: Add familyMemberId column to rentals table

**Files:**
- Modify: `server/db/schema.ts:100-116` (rentals table)
- Modify: `drizzle/` (migration)

**Step 1: Add the column**

In `server/db/schema.ts`, add to the `rentals` table definition after `customerId`:

```typescript
familyMemberId: text('family_member_id').references(() => familyMembers.id),
```

**Step 2: Generate and apply migration**

Run: `npm run db:generate`
Then: `npx drizzle-kit push` (push works; migrate has a pre-existing journal issue)

**Step 3: Update test setup**

In `tests/setup.ts`, add `family_member_id TEXT` to the rentals CREATE TABLE statement.

**Step 4: Commit**

```bash
git add server/db/schema.ts drizzle/ tests/setup.ts
git commit -m "feat: add familyMemberId column to rentals table"
```

---

### Task 2: Update checkout service to accept familyMemberId

**Files:**
- Modify: `server/services/rental.ts:16-20,29-83` (CheckoutInput interface and checkoutCopy function)
- Modify: `tests/server/services/rental.test.ts` or `tests/e2e/checkout-flow.test.ts`

**Step 1: Write the failing test**

Add to the checkout test file:

```typescript
it('stores familyMemberId on the rental when provided', async () => {
  // Seed a family member for the test customer
  const familyMemberId = nanoid();
  await db.insert(familyMembers).values({
    id: familyMemberId,
    customerId: customer.id,
    firstName: 'Junior',
    lastName: 'Test',
    relationship: 'child',
    birthday: '2015-06-15',
    active: 1,
  });

  const rental = await checkoutCopy(db, {
    customerId: customer.id,
    copyId: copy.id,
    pricingRuleId: rule.id,
    familyMemberId,
  });

  expect(rental.familyMemberId).toBe(familyMemberId);
});

it('sets familyMemberId to null when not provided', async () => {
  const rental = await checkoutCopy(db, {
    customerId: customer.id,
    copyId: copy.id,
    pricingRuleId: rule.id,
  });

  expect(rental.familyMemberId).toBeNull();
});
```

**Step 2: Run to verify tests fail**

Run: `npx vitest run tests/e2e/checkout-flow.test.ts`

**Step 3: Update CheckoutInput and checkoutCopy**

In `server/services/rental.ts`:

Add `familyMemberId?: string` to the `CheckoutInput` interface.

In `checkoutCopy`, include `familyMemberId: input.familyMemberId ?? null` in the rental insert values.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/e2e/checkout-flow.test.ts`

**Step 5: Commit**

```bash
git add server/services/rental.ts tests/e2e/checkout-flow.test.ts
git commit -m "feat: accept familyMemberId in checkout service"
```

---

### Task 3: Update checkout route to use family member birthday for age check

**Files:**
- Modify: `server/routes/rentals.ts:20-66` (checkout endpoint)
- Modify: `tests/server/routes/rentals.test.ts` or create if needed

**Step 1: Write the failing tests**

Create or add to rental route tests:

```typescript
it('checks family member birthday for age restriction when familyMemberId provided', async () => {
  // Seed: adult customer, minor family member, R-rated title, copy
  // POST /rentals/checkout with familyMemberId of the minor
  // Expect: { ageRestriction: { ... } } response
});

it('allows checkout when family member is adult for R-rated title', async () => {
  // Seed: adult customer, adult family member, R-rated title, copy
  // POST /rentals/checkout with familyMemberId of the adult
  // Expect: 201 rental created
});

it('uses primary customer birthday when no familyMemberId', async () => {
  // Current behavior — minor customer, R-rated title
  // Expect: ageRestriction warning (unchanged behavior)
});
```

**Step 2: Run to verify they fail**

**Step 3: Update the checkout route**

In `server/routes/rentals.ts`, the age check section (lines 42-54):

```typescript
// Age restriction check
const [copy] = await db.select().from(copies).where(eq(copies.id, body.copyId));
if (copy) {
  const [title] = await db.select().from(titles).where(eq(titles.id, copy.titleId));
  if (title) {
    let birthdayToCheck: string | null = null;

    if (body.familyMemberId) {
      const [fm] = await db.select().from(familyMembers)
        .where(eq(familyMembers.id, body.familyMemberId));
      birthdayToCheck = fm?.birthday ?? null;
    } else {
      const [cust] = await db.select().from(customers)
        .where(eq(customers.id, body.customerId));
      birthdayToCheck = cust?.birthday ?? null;
    }

    const warning = checkAgeRestriction(birthdayToCheck, title.rating);
    if (warning && !body.parentApproved) {
      return c.json({ ageRestriction: warning }, 200);
    }
  }
}
```

Add `familyMembers` to imports from `../db/schema.js`.

Pass `familyMemberId` through to `checkoutCopy`:

```typescript
const rental = await checkoutCopy(db, {
  customerId: body.customerId,
  copyId: body.copyId,
  pricingRuleId: body.pricingRuleId,
  familyMemberId: body.familyMemberId,
});
```

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add server/routes/rentals.ts tests/server/routes/rentals.test.ts
git commit -m "feat: check family member age for R/NC-17 rentals"
```

---

### Task 4: Add family member fetch to API client

**Files:**
- Modify: `client/src/api/client.ts:52-62` (customers API)

**Step 1: Add getFamily method**

Check if a method to fetch family members for a customer already exists. If not, add:

```typescript
getFamily: (customerId: string) => get<any>(`/api/customers/${customerId}/family`),
```

Also check that the server has a `GET /api/customers/:id/family` endpoint. If not, add one that returns active family members for a customer.

**Step 2: Update rentals.checkout in API client**

The `rentals.checkout` call already sends arbitrary data — no change needed since we'll just include `familyMemberId` in the body from the POS.

**Step 3: Commit**

```bash
git add client/src/api/client.ts server/routes/customers.ts
git commit -m "feat: add family member fetch endpoint and API client method"
```

---

### Task 5: Create FamilyMemberPicker component

**Files:**
- Create: `client/src/components/pos/FamilyMemberPicker.tsx`
- Create: `tests/client/components/pos/FamilyMemberPicker.test.tsx`

**Step 1: Write the failing tests**

```typescript
// ABOUTME: Tests for the family member picker shown at POS after customer selection
// ABOUTME: Validates display of members, selection callback, and account holder option

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FamilyMemberPicker } from '../../client/src/components/pos/FamilyMemberPicker';

describe('FamilyMemberPicker', () => {
  const members = [
    { id: 'fm1', firstName: 'Junior', lastName: 'Smith', relationship: 'son', birthday: '2012-05-15' },
    { id: 'fm2', firstName: 'Sally', lastName: 'Smith', relationship: 'daughter', birthday: '2008-11-20' },
  ];

  it('shows account holder option plus all family members', () => {
    render(<FamilyMemberPicker
      customerName="John Smith"
      familyMembers={members}
      onSelect={vi.fn()}
    />);
    expect(screen.getByText(/John Smith/)).toBeTruthy();
    expect(screen.getByText(/Account Holder/)).toBeTruthy();
    expect(screen.getByText(/Junior/)).toBeTruthy();
    expect(screen.getByText(/Sally/)).toBeTruthy();
  });

  it('shows relationship for family members', () => {
    render(<FamilyMemberPicker
      customerName="John Smith"
      familyMembers={members}
      onSelect={vi.fn()}
    />);
    expect(screen.getByText(/son/)).toBeTruthy();
    expect(screen.getByText(/daughter/)).toBeTruthy();
  });

  it('calls onSelect with null when account holder chosen', () => {
    const onSelect = vi.fn();
    render(<FamilyMemberPicker
      customerName="John Smith"
      familyMembers={members}
      onSelect={onSelect}
    />);
    fireEvent.click(screen.getByText(/Account Holder/));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('calls onSelect with family member when chosen', () => {
    const onSelect = vi.fn();
    render(<FamilyMemberPicker
      customerName="John Smith"
      familyMembers={members}
      onSelect={onSelect}
    />);
    fireEvent.click(screen.getByText(/Junior/));
    expect(onSelect).toHaveBeenCalledWith(members[0]);
  });
});
```

**Step 2: Run to verify they fail**

Run: `npx vitest run tests/client/components/pos/FamilyMemberPicker.test.tsx`

**Step 3: Implement FamilyMemberPicker**

Create `client/src/components/pos/FamilyMemberPicker.tsx`:

A simple list/modal showing:
- "Who is renting?" heading
- "John Smith (Account Holder)" — clickable, calls `onSelect(null)`
- "Junior Smith (son)" — clickable, calls `onSelect(member)`
- "Sally Smith (daughter)" — clickable, calls `onSelect(member)`

Props:
```typescript
interface FamilyMemberPickerProps {
  customerName: string;
  familyMembers: Array<{ id: string; firstName: string; lastName: string; relationship: string; birthday: string }>;
  onSelect: (member: FamilyMember | null) => void;  // null = account holder
}
```

Match existing CRT aesthetic styling. Use Modal component from `../common/Modal`.

**Step 4: Run tests to verify they pass**

**Step 5: Commit**

```bash
git add client/src/components/pos/FamilyMemberPicker.tsx tests/client/components/pos/FamilyMemberPicker.test.tsx
git commit -m "feat: add FamilyMemberPicker component for POS"
```

---

### Task 6: Wire FamilyMemberPicker into POSScreen

**Files:**
- Modify: `client/src/components/pos/POSScreen.tsx`
- Modify: `client/src/components/pos/CustomerBar.tsx`

**Step 1: Read both files fully**

Understand:
- How `customer` state is set (line 36 in POSScreen)
- How `handleScan` works for member barcodes (lines 179-185)
- How CustomerBar displays customer info (lines 88-123)

**Step 2: Add family member state and picker to POSScreen**

Add state:
```typescript
const [familyMembers, setFamilyMembers] = useState<any[]>([]);
const [selectedFamilyMember, setSelectedFamilyMember] = useState<any | null>(null);
const [showFamilyPicker, setShowFamilyPicker] = useState(false);
```

After customer is set (in `handleScan` and CustomerBar's `onCustomerSelect`):
1. Fetch family members: `api.customers.getFamily(customer.id)`
2. If family members exist → show FamilyMemberPicker (`setShowFamilyPicker(true)`)
3. If no family members → proceed as normal (picker doesn't show)

When family member is selected:
- `setSelectedFamilyMember(member)` (or null for account holder)
- `setShowFamilyPicker(false)`

**Step 3: Pass familyMemberId to checkout**

In `handleConfirmCheckout`, include `familyMemberId: selectedFamilyMember?.id` in the `api.rentals.checkout()` call.

**Step 4: Show selected renter in CustomerBar**

Pass the selected family member to CustomerBar. Display their name alongside or instead of the primary customer name. For example: "Junior Smith (son) on John Smith's account"

**Step 5: Reset family member state on clear**

When customer is cleared or transaction completes (onDone), reset `selectedFamilyMember` and `familyMembers` to null/empty.

**Step 6: Handle family member search auto-select**

When a customer search returns results via a family member name match, auto-select that family member. This may require the search API to return which family member matched. Check the current search response format and adapt.

**Step 7: Test manually**

1. Select a customer with family members → picker appears
2. Select a family member → name shows in customer bar
3. Checkout R-rated title with minor family member → age warning
4. Checkout R-rated title with adult family member → no warning
5. Select customer with no family members → no picker

**Step 8: Commit**

```bash
git add client/src/components/pos/POSScreen.tsx client/src/components/pos/CustomerBar.tsx
git commit -m "feat: wire family member selection into POS checkout flow"
```

---

### Task 7: Show family member in rental history

**Files:**
- Modify: `server/services/rental.ts` (getCustomerRentals, getActiveRentals)
- Modify: any component displaying rental history

**Step 1: Update rental queries to join familyMembers**

In `getCustomerRentals` and `getActiveRentals`, left join on `familyMembers` table to include `firstName`, `lastName`, `relationship` of the family member (if set).

Return the family member info alongside each rental record.

**Step 2: Update rental history display**

In any component that shows rental records, display the family member name when `familyMemberId` is set. Format: "Junior (son)" or similar.

**Step 3: Commit**

```bash
git add server/services/rental.ts <frontend files>
git commit -m "feat: show family member name in rental history"
```

---

### Task 8: End-to-end verification

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 2: Manual smoke test**

1. Customer with family members → picker appears → select member → checkout
2. Minor family member + R-rated → age warning shown
3. Adult family member + R-rated → no warning
4. Customer with no family members → no picker, normal flow
5. Rental history shows who rented
6. Return flow unaffected
7. Search by family member name → auto-selects

**Step 3: Commit any fixes**
