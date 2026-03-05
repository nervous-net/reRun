# Lightspeed Reference Codes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace PaymentModal with a reference code system so employees can tie reRun transactions to Lightspeed POS.

**Architecture:** Add a `referenceCode` column to transactions, generate a short `RN-XXXX` code at checkout, display it prominently, and make it searchable. The checkout flow keeps everything up to payment, then swaps the PaymentModal for a confirmation + code display.

**Tech Stack:** Drizzle ORM (schema migration), nanoid (code generation), React (UI components), Vitest (tests)

---

### Task 1: Add referenceCode column to schema

**Files:**
- Modify: `server/db/schema.ts:82-96` (transactions table)
- Modify: `drizzle/` (migration will be generated)

**Step 1: Add the column to the schema**

In `server/db/schema.ts`, add `referenceCode` to the `transactions` table definition, after the `notes` column:

```typescript
referenceCode: text('reference_code').unique(),
```

**Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: New migration file in `drizzle/` adding `reference_code` column

**Step 3: Apply the migration**

Run: `npm run db:migrate`
Expected: Column added to SQLite database

**Step 4: Commit**

```bash
git add server/db/schema.ts drizzle/
git commit -m "feat: add referenceCode column to transactions table"
```

---

### Task 2: Reference code generation service

**Files:**
- Create: `server/services/reference-code.ts`
- Create: `tests/server/services/reference-code.test.ts`

**Step 1: Write the failing tests**

Create `tests/server/services/reference-code.test.ts`:

```typescript
// ABOUTME: Tests for Lightspeed reference code generation
// ABOUTME: Validates format, uniqueness, and retry-on-collision behavior

import { describe, it, expect } from 'vitest';
import { generateReferenceCode } from '../../server/services/reference-code.js';

describe('generateReferenceCode', () => {
  it('returns a code matching RN-XXXX format', () => {
    const code = generateReferenceCode();
    expect(code).toMatch(/^RN-[0-9A-HJ-NP-Z]{4}$/);
  });

  it('generates unique codes across multiple calls', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateReferenceCode()));
    expect(codes.size).toBe(100);
  });

  it('excludes ambiguous characters I and O', () => {
    const codes = Array.from({ length: 200 }, () => generateReferenceCode());
    for (const code of codes) {
      const suffix = code.slice(3);
      expect(suffix).not.toMatch(/[IO]/);
    }
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/services/reference-code.test.ts`
Expected: FAIL with "cannot find module"

**Step 3: Write the implementation**

Create `server/services/reference-code.ts`:

```typescript
// ABOUTME: Generates short reference codes for tying reRun transactions to Lightspeed
// ABOUTME: Format is RN- followed by 4 uppercase alphanumeric characters (no I or O)

import { customAlphabet } from 'nanoid';

const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generate = customAlphabet(ALPHABET, 4);

export function generateReferenceCode(): string {
  return `RN-${generate()}`;
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/services/reference-code.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add server/services/reference-code.ts tests/server/services/reference-code.test.ts
git commit -m "feat: add reference code generation service"
```

---

### Task 3: Integrate reference code into transaction creation

**Files:**
- Modify: `server/services/transaction.ts:100-190` (createTransaction function)
- Modify: `tests/server/services/transaction.test.ts` (add reference code assertions)

**Step 1: Write the failing test**

Add to the existing test file `tests/server/services/transaction.test.ts`, inside the `createTransaction` describe block:

```typescript
it('generates a reference code on the transaction', async () => {
  // Use existing test setup pattern to create customer, copy, pricing rule, etc.
  // Then create a transaction and assert:
  const result = await createTransaction(db, {
    customerId: customer.id,
    items: [{ type: 'rental', description: 'Test Movie (DVD)', amount: 500, copyId: copy.id, pricingRuleId: rule.id }],
  });
  expect(result.referenceCode).toMatch(/^RN-[0-9A-HJ-NP-Z]{4}$/);
});
```

Adapt this to match the exact test setup pattern already used in the file (seed customer, copy, pricing rule in `beforeEach`).

**Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/services/transaction.test.ts`
Expected: FAIL - `referenceCode` is undefined on result

**Step 3: Update createTransaction to generate and store the reference code**

In `server/services/transaction.ts`, at the top add:

```typescript
import { generateReferenceCode } from './reference-code.js';
```

Inside `createTransaction`, after generating the transaction ID with `nanoid()`, add:

```typescript
const referenceCode = generateReferenceCode();
```

Include `referenceCode` in the insert values object for the `transactions` table.

Include `referenceCode` in the returned object.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/services/transaction.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add server/services/transaction.ts tests/server/services/transaction.test.ts
git commit -m "feat: generate reference code on transaction creation"
```

---

### Task 4: Return reference code from transaction API endpoints

**Files:**
- Modify: `server/routes/transactions.ts:47-85` (create and get endpoints)
- Modify: `tests/server/routes/transactions.test.ts`

**Step 1: Write the failing test**

Add to `tests/server/routes/transactions.test.ts`:

```typescript
it('POST /transactions returns a referenceCode', async () => {
  // Use existing test pattern to create transaction via HTTP
  const res = await app.request('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: customer.id,
      items: [{ type: 'rental', description: 'Test', amount: 500, copyId: copy.id, pricingRuleId: rule.id }],
    }),
  });
  const data = await res.json();
  expect(data.referenceCode).toMatch(/^RN-[0-9A-HJ-NP-Z]{4}$/);
});

it('GET /transactions/:id includes referenceCode', async () => {
  // Create a transaction first, then fetch it
  const createRes = await app.request('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: customer.id,
      items: [{ type: 'rental', description: 'Test', amount: 500, copyId: copy.id, pricingRuleId: rule.id }],
    }),
  });
  const created = await createRes.json();

  const res = await app.request(`/api/transactions/${created.id}`);
  const data = await res.json();
  expect(data.referenceCode).toBe(created.referenceCode);
});
```

Adapt to match the existing test setup and seeding patterns in the file.

**Step 2: Run to verify they fail**

Run: `npx vitest run tests/server/routes/transactions.test.ts`
Expected: FAIL - referenceCode missing from responses

**Step 3: Update route handlers**

The routes likely just pass through whatever `createTransaction` returns, so the POST endpoint may already work once Task 3 is done. For the GET endpoint, ensure the select query includes `referenceCode` in the returned columns.

Check `server/routes/transactions.ts` GET handler (around line 66-85) and verify `referenceCode` is included in the select/response.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/routes/transactions.test.ts`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add server/routes/transactions.ts tests/server/routes/transactions.test.ts
git commit -m "feat: return referenceCode from transaction API endpoints"
```

---

### Task 5: Add reference code search endpoint

**Files:**
- Modify: `server/routes/transactions.ts` (add search-by-reference-code)
- Modify: `tests/server/routes/transactions.test.ts`
- Modify: `client/src/api/client.ts:78-85` (add search method)

**Step 1: Write the failing test**

Add to `tests/server/routes/transactions.test.ts`:

```typescript
it('GET /transactions?referenceCode=RN-XXXX returns matching transaction', async () => {
  // Create a transaction, capture its referenceCode
  const createRes = await app.request('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId: customer.id,
      items: [{ type: 'rental', description: 'Test', amount: 500, copyId: copy.id, pricingRuleId: rule.id }],
    }),
  });
  const created = await createRes.json();

  const res = await app.request(`/api/transactions?referenceCode=${created.referenceCode}`);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.length).toBe(1);
  expect(data[0].id).toBe(created.id);
});

it('GET /transactions?referenceCode=RN-ZZZZ returns empty for no match', async () => {
  const res = await app.request('/api/transactions?referenceCode=RN-ZZZZ');
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.length).toBe(0);
});
```

**Step 2: Run to verify they fail**

Run: `npx vitest run tests/server/routes/transactions.test.ts`
Expected: FAIL

**Step 3: Add the search handler**

In `server/routes/transactions.ts`, add a GET handler that checks for a `referenceCode` query param. If present, filter transactions by case-insensitive match on `referenceCode` using `sql\`UPPER(reference_code) = UPPER(${value})\``. Return the matching transactions with their items.

If no `referenceCode` query param, fall through to existing list behavior (or return recent transactions).

**Step 4: Update the API client**

In `client/src/api/client.ts`, add to the `transactions` object:

```typescript
search: (referenceCode: string) => get<any>(`/api/transactions?referenceCode=${encodeURIComponent(referenceCode)}`),
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/server/routes/transactions.test.ts`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add server/routes/transactions.ts tests/server/routes/transactions.test.ts client/src/api/client.ts
git commit -m "feat: add reference code search for transaction reconciliation"
```

---

### Task 6: Replace PaymentModal with ConfirmationModal

**Files:**
- Create: `client/src/components/pos/ConfirmationModal.tsx`
- Create: `tests/client/components/pos/ConfirmationModal.test.tsx`
- Modify: `client/src/components/pos/POSScreen.tsx` (swap PaymentModal for ConfirmationModal)

**Step 1: Write the failing test**

Create `tests/client/components/pos/ConfirmationModal.test.tsx`:

```typescript
// ABOUTME: Tests for the rental confirmation modal
// ABOUTME: Validates line items display, total, and completion callback

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationModal } from '../../client/src/components/pos/ConfirmationModal';

describe('ConfirmationModal', () => {
  const defaultProps = {
    items: [
      { type: 'rental' as const, description: 'Die Hard (DVD) - 3 Day', amount: 500 },
      { type: 'rental' as const, description: 'Aliens (VHS) - 1 Day', amount: 300 },
    ],
    total: 800,
    tax: 64,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it('displays line items with descriptions and amounts', () => {
    render(<ConfirmationModal {...defaultProps} />);
    expect(screen.getByText('Die Hard (DVD) - 3 Day')).toBeTruthy();
    expect(screen.getByText('Aliens (VHS) - 1 Day')).toBeTruthy();
  });

  it('displays the total amount to ring up in Lightspeed', () => {
    render(<ConfirmationModal {...defaultProps} />);
    expect(screen.getByText(/8\.64/)).toBeTruthy();
  });

  it('calls onConfirm when Complete Rental is clicked', () => {
    render(<ConfirmationModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Complete Rental'));
    expect(defaultProps.onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', () => {
    render(<ConfirmationModal {...defaultProps} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });
});
```

Adapt the import paths and test patterns to match the existing test conventions in `tests/client/`.

**Step 2: Run to verify they fail**

Run: `npx vitest run tests/client/components/pos/ConfirmationModal.test.tsx`
Expected: FAIL - module not found

**Step 3: Implement ConfirmationModal**

Create `client/src/components/pos/ConfirmationModal.tsx`:

```typescript
// ABOUTME: Confirmation modal shown before completing a rental checkout
// ABOUTME: Displays line items and total for employee to ring up in Lightspeed

import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { LineItem } from './TransactionPanel';

interface ConfirmationModalProps {
  items: LineItem[];
  total: number;
  tax: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationModal({ items, total, tax, onConfirm, onCancel }: ConfirmationModalProps) {
  return (
    <Modal title="Confirm Rental" onClose={onCancel}>
      <div style={{ marginBottom: '1rem' }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
            <span>{item.description}</span>
            <span>${(item.amount / 100).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Tax</span>
          <span>${(tax / 100).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.2rem' }}>
          <span>Ring up in Lightspeed</span>
          <span>${((total + tax) / 100).toFixed(2)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} variant="secondary">Cancel</Button>
        <Button onClick={onConfirm}>Complete Rental</Button>
      </div>
    </Modal>
  );
}
```

Adapt styling to match existing component patterns (check Modal, Button usage in PaymentModal.tsx for reference).

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/client/components/pos/ConfirmationModal.test.tsx`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add client/src/components/pos/ConfirmationModal.tsx tests/client/components/pos/ConfirmationModal.test.tsx
git commit -m "feat: add ConfirmationModal for rental checkout"
```

---

### Task 7: Create ReferenceCodeScreen component

**Files:**
- Create: `client/src/components/pos/ReferenceCodeScreen.tsx`
- Create: `tests/client/components/pos/ReferenceCodeScreen.test.tsx`

**Step 1: Write the failing test**

Create `tests/client/components/pos/ReferenceCodeScreen.test.tsx`:

```typescript
// ABOUTME: Tests for the reference code display shown after checkout
// ABOUTME: Validates the code is displayed prominently and Done button works

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReferenceCodeScreen } from '../../client/src/components/pos/ReferenceCodeScreen';

describe('ReferenceCodeScreen', () => {
  it('displays the reference code prominently', () => {
    render(<ReferenceCodeScreen referenceCode="RN-7X3K" total={864} onDone={vi.fn()} />);
    expect(screen.getByText('RN-7X3K')).toBeTruthy();
  });

  it('displays the total that was rung up', () => {
    render(<ReferenceCodeScreen referenceCode="RN-7X3K" total={864} onDone={vi.fn()} />);
    expect(screen.getByText(/8\.64/)).toBeTruthy();
  });

  it('calls onDone when Done is clicked', () => {
    const onDone = vi.fn();
    render(<ReferenceCodeScreen referenceCode="RN-7X3K" total={864} onDone={onDone} />);
    fireEvent.click(screen.getByText('Done'));
    expect(onDone).toHaveBeenCalled();
  });

  it('displays instruction text about entering code in Lightspeed', () => {
    render(<ReferenceCodeScreen referenceCode="RN-7X3K" total={864} onDone={vi.fn()} />);
    expect(screen.getByText(/Lightspeed/i)).toBeTruthy();
  });
});
```

**Step 2: Run to verify they fail**

Run: `npx vitest run tests/client/components/pos/ReferenceCodeScreen.test.tsx`
Expected: FAIL - module not found

**Step 3: Implement ReferenceCodeScreen**

Create `client/src/components/pos/ReferenceCodeScreen.tsx`:

```typescript
// ABOUTME: Displays the reference code after a rental checkout is completed
// ABOUTME: Employee enters this code into Lightspeed to tie the two transactions together

import { Button } from '../common/Button';

interface ReferenceCodeScreenProps {
  referenceCode: string;
  total: number;
  onDone: () => void;
}

export function ReferenceCodeScreen({ referenceCode, total, onDone }: ReferenceCodeScreenProps) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>Rental Complete</h2>
      <p style={{ marginBottom: '2rem', opacity: 0.7 }}>Enter this code in Lightspeed</p>
      <div style={{
        fontSize: '3rem',
        fontWeight: 'bold',
        fontFamily: 'monospace',
        letterSpacing: '0.2em',
        padding: '1.5rem',
        border: '2px solid var(--color-primary)',
        borderRadius: '8px',
        marginBottom: '1.5rem',
        userSelect: 'all',
      }}>
        {referenceCode}
      </div>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
        Total: ${(total / 100).toFixed(2)}
      </p>
      <Button onClick={onDone}>Done</Button>
    </div>
  );
}
```

Match styling to the CRT aesthetic used throughout the app.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/client/components/pos/ReferenceCodeScreen.test.tsx`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add client/src/components/pos/ReferenceCodeScreen.tsx tests/client/components/pos/ReferenceCodeScreen.test.tsx
git commit -m "feat: add ReferenceCodeScreen for Lightspeed handoff"
```

---

### Task 8: Wire up POSScreen to use new checkout flow

**Files:**
- Modify: `client/src/components/pos/POSScreen.tsx`

**Step 1: Understand the current flow**

Read `client/src/components/pos/POSScreen.tsx` fully. Identify:
- Where PaymentModal is rendered and triggered
- Where Receipt is rendered
- The state variables controlling modal visibility
- The checkout/payment handler functions

**Step 2: Replace PaymentModal with ConfirmationModal + ReferenceCodeScreen**

In `POSScreen.tsx`:

1. Remove `PaymentModal` and `Receipt` imports
2. Add imports for `ConfirmationModal` and `ReferenceCodeScreen`
3. Replace `showPayment` state with `showConfirmation` state
4. Add `referenceCode` state (string | null)
5. Add `completedTotal` state (number | null) to pass to ReferenceCodeScreen

Update the flow:
- "Checkout" button sets `showConfirmation = true`
- ConfirmationModal's `onConfirm` calls the checkout API (rental creation + transaction creation), stores the returned `referenceCode`, sets `showConfirmation = false`, shows ReferenceCodeScreen
- ReferenceCodeScreen's `onDone` resets all POS state (clear items, customer, reference code)

The rental checkout calls (`api.rentals.checkout`) stay the same. The transaction creation call (`api.transactions.create`) stays the same but no longer sends `paymentMethod`/`amountTendered`. The response now includes `referenceCode`.

**Step 3: Test manually**

Run the dev server and walk through:
1. Select a customer
2. Scan a copy
3. Select pricing rule
4. Click checkout → ConfirmationModal appears with items and total
5. Click "Complete Rental" → reference code displays
6. Click "Done" → POS resets

**Step 4: Commit**

```bash
git add client/src/components/pos/POSScreen.tsx
git commit -m "feat: replace PaymentModal with ConfirmationModal + ReferenceCodeScreen"
```

---

### Task 9: Display reference code in transaction history

**Files:**
- Modify: whichever component displays transaction history/details (check Dashboard or any transaction list view)
- Add reference code column to transaction list display
- Show reference code on transaction detail view

**Step 1: Identify transaction display components**

Search for components that render transaction data. Check Dashboard, any transaction history page, and the customer rental history view.

**Step 2: Add referenceCode to displayed columns**

Add the `RN-XXXX` code as a visible column in any transaction list. For transaction detail views, display it prominently.

**Step 3: Test manually**

Create a transaction, then verify the reference code appears in all relevant views.

**Step 4: Commit**

```bash
git add <changed files>
git commit -m "feat: display reference code in transaction history views"
```

---

### Task 10: Clean up unused components

**Files:**
- Delete or mark unused: `client/src/components/pos/PaymentModal.tsx`
- Delete or mark unused: `client/src/components/pos/Receipt.tsx`

**Step 1: Verify PaymentModal and Receipt are no longer imported anywhere**

Search the codebase for imports of PaymentModal and Receipt. If nothing references them, delete the files and their tests.

**Step 2: Run the full test suite**

Run: `npx vitest run`
Expected: ALL PASS (no broken imports)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused PaymentModal and Receipt components"
```

---

### Task 11: End-to-end verification

**Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: ALL PASS

**Step 2: Manual smoke test**

Walk through the complete flow:
1. Start fresh → scan customer → scan copy → select pricing → checkout
2. Confirm modal shows correct items and total
3. Complete rental → reference code displayed
4. Enter code reference in search → finds the transaction
5. Check transaction detail → reference code visible
6. Return flow still works as before

**Step 3: Commit any fixes**

If anything needed fixing during smoke test, commit those fixes.
