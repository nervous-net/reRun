# Return by Title Search + Persistent Return Queue

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow clerks to return videos by searching for movie names (not just barcode scanning), and show today's processed returns persistently.

**Architecture:** Add title search to the return screen's input (auto-detect barcode vs text), a two-step modal (pick title → pick numbered copy), a new server endpoint for today's returns, and a persistent "Today's Returns" section on the return screen.

**Tech Stack:** Hono (server), React 19 (client), Drizzle ORM + better-sqlite3, Vitest

---

## Chunk 1: Server — Returned-Today Endpoint + Rented Copies by Title

### Task 1: Add `getReturnedToday` service function

**Files:**
- Modify: `server/services/rental.ts` (add new export after `getActiveRentals` ~line 289)
- Test: `tests/server/services/rental.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/server/services/rental.test.ts`, add a new describe block:

```typescript
describe('getReturnedToday', () => {
  it('returns rentals returned today with title and customer info', async () => {
    // Seed customer, title, copy, pricing rule
    const customerId = await seedCustomer(db);
    const { copyId, titleId } = await seedTitleAndCopy(db, { titleName: 'Clerks' });
    const ruleId = await seedPricingRule(db);

    // Checkout and return
    await checkoutCopy(db, { customerId, copyId, pricingRuleId: ruleId });
    const returned = await returnCopy(db, { copyId, lateFeeAction: 'pay' });

    const results = await getReturnedToday(db);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      copyId,
      status: 'returned',
      titleName: 'Clerks',
      customerFirstName: 'Dante',
    });
    expect(results[0].returnedAt).toBeDefined();
    expect(results[0].copyBarcode).toBeDefined();
  });

  it('excludes rentals returned on previous days', async () => {
    const customerId = await seedCustomer(db);
    const { copyId } = await seedTitleAndCopy(db);
    const ruleId = await seedPricingRule(db);

    await checkoutCopy(db, { customerId, copyId, pricingRuleId: ruleId });
    await returnCopy(db, { copyId, lateFeeAction: 'pay' });

    // Backdate the returnedAt to yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    await db.update(rentals).set({ returnedAt: yesterday }).where(eq(rentals.copyId, copyId));

    const results = await getReturnedToday(db);
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/services/rental.test.ts -t "getReturnedToday"`
Expected: FAIL — `getReturnedToday` is not defined

- [ ] **Step 3: Write minimal implementation**

In `server/services/rental.ts`, add after `getActiveRentals`:

```typescript
export async function getReturnedToday(db: any) {
  const now = getNow(db);
  // Build today's date boundaries in ISO format
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const results = await db
    .select({
      id: rentals.id,
      customerId: rentals.customerId,
      copyId: rentals.copyId,
      checkedOutAt: rentals.checkedOutAt,
      dueAt: rentals.dueAt,
      returnedAt: rentals.returnedAt,
      lateFee: rentals.lateFee,
      lateFeeStatus: rentals.lateFeeStatus,
      status: rentals.status,
      titleName: titles.name,
      copyBarcode: copies.barcode,
      copyFormat: copies.format,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      familyMemberFirstName: familyMembers.firstName,
      familyMemberLastName: familyMembers.lastName,
      familyMemberRelationship: familyMembers.relationship,
    })
    .from(rentals)
    .innerJoin(copies, eq(rentals.copyId, copies.id))
    .innerJoin(titles, eq(copies.titleId, titles.id))
    .innerJoin(customers, eq(rentals.customerId, customers.id))
    .leftJoin(familyMembers, eq(rentals.familyMemberId, familyMembers.id))
    .where(
      and(
        eq(rentals.status, 'returned'),
        gte(rentals.returnedAt, todayStart.toISOString()),
        lt(rentals.returnedAt, tomorrowStart.toISOString()),
      )
    );

  return results;
}
```

Add `gte` to the drizzle-orm imports at the top of the file (alongside existing `eq, and, lt`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/services/rental.test.ts -t "getReturnedToday"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/rental.ts tests/server/services/rental.test.ts
git commit -m "feat: add getReturnedToday service function"
```

---

### Task 2: Add `getRentedCopiesForTitle` service function

Returns currently-rented copies for a given title, with customer info and numbered ordering. Used by the copy-selection modal.

**Files:**
- Modify: `server/services/rental.ts`
- Test: `tests/server/services/rental.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
describe('getRentedCopiesForTitle', () => {
  it('returns rented-out copies for a title with customer info', async () => {
    const customerId = await seedCustomer(db, { firstName: 'Randal', lastName: 'Graves' });
    const titleId = nanoid();
    await db.insert(titles).values({ id: titleId, name: 'Jaws', year: 1975 });

    // Create 2 copies, rent out 1
    const copy1Id = nanoid();
    const copy2Id = nanoid();
    await db.insert(copies).values([
      { id: copy1Id, titleId, barcode: 'BC-001', format: 'DVD', status: 'out' },
      { id: copy2Id, titleId, barcode: 'BC-002', format: 'Blu-ray', status: 'in' },
    ]);
    const ruleId = await seedPricingRule(db);
    await checkoutCopy(db, { customerId, copyId: copy1Id, pricingRuleId: ruleId });

    const results = await getRentedCopiesForTitle(db, titleId);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      copyId: copy1Id,
      barcode: 'BC-001',
      format: 'DVD',
      customerFirstName: 'Randal',
      customerLastName: 'Graves',
    });
    expect(results[0].dueAt).toBeDefined();
  });

  it('returns empty array when no copies are rented', async () => {
    const titleId = nanoid();
    await db.insert(titles).values({ id: titleId, name: 'Clerks II', year: 2006 });
    const copyId = nanoid();
    await db.insert(copies).values({ id: copyId, titleId, barcode: 'BC-003', format: 'DVD', status: 'in' });

    const results = await getRentedCopiesForTitle(db, titleId);
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/services/rental.test.ts -t "getRentedCopiesForTitle"`
Expected: FAIL — function not defined

- [ ] **Step 3: Write minimal implementation**

In `server/services/rental.ts`:

```typescript
export async function getRentedCopiesForTitle(db: any, titleId: string) {
  const results = await db
    .select({
      rentalId: rentals.id,
      copyId: copies.id,
      barcode: copies.barcode,
      format: copies.format,
      checkedOutAt: rentals.checkedOutAt,
      dueAt: rentals.dueAt,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      familyMemberFirstName: familyMembers.firstName,
      familyMemberLastName: familyMembers.lastName,
      familyMemberRelationship: familyMembers.relationship,
    })
    .from(rentals)
    .innerJoin(copies, eq(rentals.copyId, copies.id))
    .innerJoin(customers, eq(rentals.customerId, customers.id))
    .leftJoin(familyMembers, eq(rentals.familyMemberId, familyMembers.id))
    .where(
      and(
        eq(copies.titleId, titleId),
        eq(rentals.status, 'out'),
      )
    );

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/services/rental.test.ts -t "getRentedCopiesForTitle"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/services/rental.ts tests/server/services/rental.test.ts
git commit -m "feat: add getRentedCopiesForTitle service function"
```

---

### Task 3: Add route endpoints

Two new routes: `GET /api/rentals/returned-today` and `GET /api/rentals/title/:titleId/rented-copies`.

**Files:**
- Modify: `server/routes/rentals.ts` (add routes before `return routes;` ~line 122)
- Test: `tests/server/routes/rentals.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/server/routes/rentals.test.ts`, add:

```typescript
describe('GET /api/rentals/returned-today', () => {
  it('returns 200 with today returned rentals', async () => {
    const { app, db } = buildApp();
    const customerId = await seedCustomer(db);
    const { copyId } = await seedTitleAndCopy(db);
    const ruleId = await seedPricingRule(db);

    // Checkout then return via API
    await app.request('/api/rentals/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, copyId, pricingRuleId: ruleId }),
    });
    await app.request('/api/rentals/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copyId }),
    });

    const res = await app.request('/api/rentals/returned-today');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].titleName).toBeDefined();
    expect(body.data[0].copyBarcode).toBeDefined();
  });
});

describe('GET /api/rentals/title/:titleId/rented-copies', () => {
  it('returns 200 with rented copies for a title', async () => {
    const { app, db } = buildApp();
    const customerId = await seedCustomer(db);
    const { copyId, titleId } = await seedTitleAndCopy(db);
    const ruleId = await seedPricingRule(db);

    await app.request('/api/rentals/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, copyId, pricingRuleId: ruleId }),
    });

    const res = await app.request(`/api/rentals/title/${titleId}/rented-copies`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].barcode).toBeDefined();
    expect(body.data[0].customerFirstName).toBeDefined();
  });

  it('returns empty data for title with no rented copies', async () => {
    const { app, db } = buildApp();
    const { titleId } = await seedTitleAndCopy(db);

    const res = await app.request(`/api/rentals/title/${titleId}/rented-copies`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/routes/rentals.test.ts -t "returned-today|rented-copies"`
Expected: FAIL — 404 not found

- [ ] **Step 3: Write minimal implementation**

In `server/routes/rentals.ts`, add the import:

```typescript
import {
  checkoutCopy,
  returnCopy,
  getOverdueRentals,
  getCustomerRentals,
  getActiveRentals,
  getReturnedToday,
  getRentedCopiesForTitle,
} from '../services/rental.js';
```

Add routes before `return routes;`:

```typescript
  // GET /returned-today — rentals returned today
  routes.get('/returned-today', async (c) => {
    const data = await getReturnedToday(db);
    return c.json({ data });
  });

  // GET /title/:titleId/rented-copies — currently rented copies for a title
  routes.get('/title/:titleId/rented-copies', async (c) => {
    const titleId = c.req.param('titleId');
    const data = await getRentedCopiesForTitle(db, titleId);
    return c.json({ data });
  });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/routes/rentals.test.ts -t "returned-today|rented-copies"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/routes/rentals.ts tests/server/routes/rentals.test.ts
git commit -m "feat: add returned-today and rented-copies-by-title endpoints"
```

---

## Chunk 2: Client — API Methods + Title Search Modal + Copy Selection

### Task 4: Add API client methods

**Files:**
- Modify: `client/src/api/client.ts` (~lines 101-107, rentals section)

- [ ] **Step 1: Add new methods to the rentals API object**

In `client/src/api/client.ts`, update the `rentals` block:

```typescript
  rentals: {
    checkout: (data: any) => post<any>('/api/rentals/checkout', data),
    return: (data: any) => post<any>('/api/rentals/return', data),
    overdue: () => get<any>('/api/rentals/overdue'),
    active: () => get<any>('/api/rentals/active'),
    customer: (id: string) => get<any>(`/api/rentals/customer/${id}`),
    returnedToday: () => get<any>('/api/rentals/returned-today'),
    rentedCopiesForTitle: (titleId: string) => get<any>(`/api/rentals/title/${titleId}/rented-copies`),
  },
```

- [ ] **Step 2: Commit**

```bash
git add client/src/api/client.ts
git commit -m "feat: add returnedToday and rentedCopiesForTitle API methods"
```

---

### Task 5: Add title search modal with copy selection to ReturnScreen

This is the main UI task. The return screen input becomes dual-purpose: barcode lookup first, title search on failure. A modal shows matching titles, then a second view shows numbered rented copies.

**Files:**
- Modify: `client/src/components/rentals/ReturnScreen.tsx`

**Important context for the implementer:**
- The existing `handleScan` function (line 106) does barcode lookup via `api.copies.lookupBarcode(barcode)`
- If that 404s (copy not found), we fall through to title search via `api.search.query({ q: barcode })`
- The existing search API is at `api.search.query()` and returns `{ titles: [...], total }` (see `server/routes/search.ts`)
- Each title result has: `id`, `name`, `year`, `genre`, `rating`, `coverUrl`, `availableCopies`, `totalCopies`, `formats`
- The `api.rentals.rentedCopiesForTitle(titleId)` endpoint returns `{ data: [...] }` with each item having: `rentalId`, `copyId`, `barcode`, `format`, `checkedOutAt`, `dueAt`, `customerFirstName`, `customerLastName`, `familyMemberFirstName`, `familyMemberLastName`, `familyMemberRelationship`

- [ ] **Step 1: Add state for title search modal**

Add new state variables after the existing state declarations (~line 93):

```typescript
const [searchResults, setSearchResults] = useState<any[] | null>(null);
const [selectedTitleCopies, setSelectedTitleCopies] = useState<any[] | null>(null);
const [selectedTitleName, setSelectedTitleName] = useState<string>('');
const [searchLoading, setSearchLoading] = useState(false);
```

- [ ] **Step 2: Modify handleScan to fall through to title search**

Replace the `catch` block in `handleScan` (line 179). Instead of showing a "Copy not found" error, attempt a title search:

```typescript
    } catch (err: any) {
      // Barcode lookup failed — try as title search
      try {
        const searchData = await api.search.query({ q: barcode });
        const titleResults = searchData.titles ?? [];
        if (titleResults.length === 0) {
          setScanError(`No results found for "${barcode}"`);
        } else {
          setSearchResults(titleResults);
        }
      } catch {
        setScanError('Copy not found and search failed');
      }
    } finally {
```

- [ ] **Step 3: Add function to handle title selection (load rented copies)**

After the `handleScan` callback:

```typescript
  const handleTitleSelect = useCallback(async (titleId: string, titleName: string) => {
    setSearchLoading(true);
    try {
      const data = await api.rentals.rentedCopiesForTitle(titleId);
      const copies = data.data ?? [];
      if (copies.length === 0) {
        setScanError(`No rented copies found for "${titleName}"`);
        setSearchResults(null);
      } else {
        setSelectedTitleName(titleName);
        setSelectedTitleCopies(copies);
      }
    } catch {
      setScanError('Failed to load rented copies');
      setSearchResults(null);
    } finally {
      setSearchLoading(false);
    }
  }, []);
```

- [ ] **Step 4: Add function to handle copy selection (add to return queue)**

```typescript
  const handleCopySelect = useCallback(async (copy: any) => {
    // Check if already in queue
    if (returnQueue.some((item) => item.copy.barcode === copy.barcode)) {
      setScanError(`${copy.barcode} is already in the return queue`);
      setSelectedTitleCopies(null);
      setSearchResults(null);
      return;
    }

    // Build the queue item from the rented copy data
    let customerName = `${copy.customerFirstName ?? ''} ${copy.customerLastName ?? ''}`.trim() || 'Unknown Customer';
    if (copy.familyMemberFirstName) {
      const fmName = `${copy.familyMemberFirstName} ${copy.familyMemberLastName ?? ''}`.trim();
      const fmLabel = copy.familyMemberRelationship
        ? `${fmName} (${copy.familyMemberRelationship})`
        : fmName;
      customerName = `${customerName} — ${fmLabel}`;
    }

    const { daysOverdue } = calculateOverdue(copy.dueAt);
    const estimatedFeePerDay = 100;
    const lateFee = daysOverdue > 0 ? daysOverdue * estimatedFeePerDay : 0;

    const queueItem: ReturnQueueItem = {
      copy: {
        id: copy.copyId,
        titleId: '', // not needed for return processing
        barcode: copy.barcode,
        format: copy.format,
        condition: '',
        status: 'out',
        title: { id: '', name: selectedTitleName, year: 0, genre: null, rating: null },
      },
      rental: {
        id: copy.rentalId,
        customerId: '',
        copyId: copy.copyId,
        checkedOutAt: copy.checkedOutAt,
        dueAt: copy.dueAt,
        status: 'out',
      },
      customerName,
      daysOverdue,
      lateFee,
      lateFeeAction: daysOverdue > 0 ? 'pay' : null,
    };

    setReturnQueue((prev) => [...prev, queueItem]);
    setSelectedTitleCopies(null);
    setSearchResults(null);
  }, [returnQueue, selectedTitleName]);
```

- [ ] **Step 5: Add title search results modal**

Add after the existing confirmation modals (after the Process All Returns modal, ~line 447):

```tsx
      {/* Title Search Results Modal */}
      <Modal
        isOpen={searchResults !== null && selectedTitleCopies === null}
        onClose={() => setSearchResults(null)}
        title="Search Results"
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {searchResults?.map((title: any) => (
            <div
              key={title.id}
              onClick={() => handleTitleSelect(title.id, title.name)}
              style={{
                padding: '8px 12px',
                borderBottom: '1px solid var(--border-color)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--accent-02)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
            >
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'bold' }}>
                {title.name} ({title.year})
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                {title.genre ?? 'No genre'} · {title.formats?.join(', ') ?? ''}
              </div>
            </div>
          ))}
          {searchLoading && (
            <div style={{ padding: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Loading...
            </div>
          )}
        </div>
      </Modal>
```

- [ ] **Step 6: Add copy selection modal with numbered indicators**

Add after the title search modal:

```tsx
      {/* Copy Selection Modal */}
      <Modal
        isOpen={selectedTitleCopies !== null}
        onClose={() => { setSelectedTitleCopies(null); setSearchResults(null); }}
        title={`Return: ${selectedTitleName}`}
      >
        <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)', fontSize: 'var(--font-size-sm)' }}>
          Select which copy to return:
        </div>
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {selectedTitleCopies?.map((copy: any, index: number) => {
            let custName = `${copy.customerFirstName ?? ''} ${copy.customerLastName ?? ''}`.trim();
            if (copy.familyMemberFirstName) {
              const fmName = `${copy.familyMemberFirstName} ${copy.familyMemberLastName ?? ''}`.trim();
              custName += ` — ${fmName}`;
            }
            const { daysOverdue } = calculateOverdue(copy.dueAt);

            return (
              <div
                key={copy.copyId}
                onClick={() => handleCopySelect(copy)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-md)',
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--accent-02)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
              >
                {/* Numbered indicator */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--crt-green)',
                  color: 'var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: 'var(--font-size-lg)',
                  flexShrink: 0,
                }}>
                  {index + 1}
                </div>

                {/* Copy details */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}>{copy.barcode}</span>
                    <Badge variant="info">{copy.format}</Badge>
                  </div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {custName} · Due: {formatDate(copy.dueAt)}
                    {daysOverdue > 0 && (
                      <span style={{ color: 'var(--crt-red)', marginLeft: 'var(--space-sm)' }}>
                        {daysOverdue} day{daysOverdue !== 1 ? 's' : ''} overdue
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
```

- [ ] **Step 7: Update scan input placeholder**

Change the Input placeholder (~line 273) from:
```
"Scan copy barcode to return..."
```
to:
```
"Scan barcode or search by title..."
```

And update the empty state text (~line 423) from:
```
"Scan a copy barcode to start processing returns"
```
to:
```
"Scan a barcode or search by title to start processing returns"
```

- [ ] **Step 8: Commit**

```bash
git add client/src/components/rentals/ReturnScreen.tsx
git commit -m "feat: add title search with copy selection to return screen"
```

---

### Task 6: Add Today's Returns section

**Files:**
- Modify: `client/src/components/rentals/ReturnScreen.tsx`

- [ ] **Step 1: Add state and data fetching for today's returns**

Add state after the existing declarations:

```typescript
const [todaysReturns, setTodaysReturns] = useState<any[]>([]);
```

Add a fetch function and load on mount + after processing:

```typescript
  const loadTodaysReturns = useCallback(async () => {
    try {
      const data = await api.rentals.returnedToday();
      setTodaysReturns(data.data ?? []);
    } catch {
      // Non-critical — silently fail
    }
  }, []);

  useEffect(() => {
    loadTodaysReturns();
  }, [loadTodaysReturns]);
```

- [ ] **Step 2: Call loadTodaysReturns after processing returns**

In `processAllReturns`, after `setReturnQueue([])` (~line 251), add:

```typescript
    await loadTodaysReturns();
```

- [ ] **Step 3: Add Today's Returns section to the JSX**

Add after the return queue section and before the empty state (~line 417):

```tsx
      {/* Today's Returns */}
      {todaysReturns.length > 0 && (
        <div style={styles.queueSection}>
          <div style={styles.queueHeader}>
            <span style={styles.queueLabel}>
              Today's Returns — {todaysReturns.length} item{todaysReturns.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={styles.queueList}>
            {todaysReturns.map((item: any, index: number) => {
              let customerName = `${item.customerFirstName ?? ''} ${item.customerLastName ?? ''}`.trim();
              if (item.familyMemberFirstName) {
                const fmName = `${item.familyMemberFirstName} ${item.familyMemberLastName ?? ''}`.trim();
                customerName += ` — ${fmName}`;
              }
              return (
                <div
                  key={item.id}
                  style={{
                    ...styles.queueRow,
                    backgroundColor: index % 2 === 1 ? 'var(--accent-02)' : 'transparent',
                  }}
                >
                  <div style={styles.queueRowMain}>
                    <div style={styles.titleInfo}>
                      <span style={styles.titleName}>{item.titleName}</span>
                      <div style={styles.copyMeta}>
                        <Badge variant="info">{item.copyFormat}</Badge>
                        <span style={styles.barcode}>{item.copyBarcode}</span>
                      </div>
                    </div>
                    <div style={styles.rentalInfo}>
                      <span style={styles.customerName}>{customerName}</span>
                      <span style={styles.dueDate}>
                        Returned: {formatDate(item.returnedAt)}
                      </span>
                    </div>
                    <div style={styles.overdueInfo}>
                      {item.lateFee > 0 ? (
                        <>
                          <span style={styles.lateFeeAmount}>
                            {formatCents(item.lateFee)} late fee
                          </span>
                          <Badge variant={item.lateFeeStatus === 'forgiven' ? 'info' : 'success'}>
                            {item.lateFeeStatus}
                          </Badge>
                        </>
                      ) : (
                        <Badge variant="success">On Time</Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Update empty state condition**

Change the empty state condition (~line 420) from:
```typescript
{returnQueue.length === 0 && !results && (
```
to:
```typescript
{returnQueue.length === 0 && !results && todaysReturns.length === 0 && (
```

- [ ] **Step 5: Commit**

```bash
git add client/src/components/rentals/ReturnScreen.tsx
git commit -m "feat: add persistent Today's Returns section to return screen"
```

---

## Chunk 3: E2E Tests

### Task 7: Add E2E tests for the new return flows

**Files:**
- Create: `tests/e2e/return-by-title.test.ts`

This tests the full flow at the service layer: title search → get rented copies → return → verify in today's returns.

- [ ] **Step 1: Write the test file**

```typescript
// ABOUTME: E2E tests for return-by-title-search flow
// ABOUTME: Covers title search fallback, copy selection, and today's returns persistence

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, migrateTestDb } from '../setup.js';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import {
  checkoutCopy,
  returnCopy,
  getReturnedToday,
  getRentedCopiesForTitle,
} from '../../server/services/rental.js';
import {
  customers,
  titles,
  copies,
  pricingRules,
  rentals,
} from '../../server/db/schema.js';

let db: any;
let sqlite: any;

beforeEach(() => {
  const testDb = createTestDb();
  db = testDb.db;
  sqlite = testDb.sqlite;
  migrateTestDb(sqlite);
});

async function seedCustomer(db: any, overrides: Record<string, any> = {}) {
  const id = nanoid();
  await db.insert(customers).values({
    id,
    firstName: overrides.firstName ?? 'Dante',
    lastName: overrides.lastName ?? 'Hicks',
    memberBarcode: overrides.memberBarcode ?? `MBR-${nanoid(8)}`,
    balance: overrides.balance ?? 0,
  });
  return id;
}

async function seedPricingRule(db: any) {
  const id = nanoid();
  await db.insert(pricingRules).values({
    id,
    name: '3-Day Rental',
    rate: 399,
    durationDays: 3,
    lateFeePerDay: 100,
  });
  return id;
}

describe('return by title search flow', () => {
  it('gets rented copies for a title, returns one, and it appears in today returns', async () => {
    const customerId = await seedCustomer(db);
    const ruleId = await seedPricingRule(db);

    // Create title with 2 copies
    const titleId = nanoid();
    await db.insert(titles).values({ id: titleId, name: 'Clerks', year: 1994 });
    const copy1Id = nanoid();
    const copy2Id = nanoid();
    await db.insert(copies).values([
      { id: copy1Id, titleId, barcode: 'BC-CLERKS-1', format: 'DVD', status: 'in' },
      { id: copy2Id, titleId, barcode: 'BC-CLERKS-2', format: 'Blu-ray', status: 'in' },
    ]);

    // Checkout both copies to different customers
    const customer2Id = await seedCustomer(db, { firstName: 'Randal', lastName: 'Graves' });
    await checkoutCopy(db, { customerId, copyId: copy1Id, pricingRuleId: ruleId });
    await checkoutCopy(db, { customerId: customer2Id, copyId: copy2Id, pricingRuleId: ruleId });

    // Get rented copies for the title
    const rentedCopies = await getRentedCopiesForTitle(db, titleId);
    expect(rentedCopies).toHaveLength(2);

    // Return copy 1 (as if clerk selected it from the numbered list)
    const returned = await returnCopy(db, { copyId: copy1Id, lateFeeAction: 'pay' });
    expect(returned.status).toBe('returned');

    // Verify only copy 2 is still rented
    const remainingCopies = await getRentedCopiesForTitle(db, titleId);
    expect(remainingCopies).toHaveLength(1);
    expect(remainingCopies[0].copyId).toBe(copy2Id);

    // Verify returned copy appears in today's returns
    const todayReturns = await getReturnedToday(db);
    expect(todayReturns).toHaveLength(1);
    expect(todayReturns[0].titleName).toBe('Clerks');
    expect(todayReturns[0].copyBarcode).toBe('BC-CLERKS-1');
  });

  it('getRentedCopiesForTitle returns copies ordered with customer details', async () => {
    const ruleId = await seedPricingRule(db);
    const titleId = nanoid();
    await db.insert(titles).values({ id: titleId, name: 'Mallrats', year: 1995 });

    const copyId = nanoid();
    await db.insert(copies).values({ id: copyId, titleId, barcode: 'BC-MALL-1', format: 'DVD', status: 'in' });

    const customerId = await seedCustomer(db, { firstName: 'Brodie', lastName: 'Bruce' });
    await checkoutCopy(db, { customerId, copyId, pricingRuleId: ruleId });

    const results = await getRentedCopiesForTitle(db, titleId);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      copyId,
      barcode: 'BC-MALL-1',
      format: 'DVD',
      customerFirstName: 'Brodie',
      customerLastName: 'Bruce',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx vitest run tests/e2e/return-by-title.test.ts`
Expected: PASS (these use the already-implemented service functions)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/return-by-title.test.ts
git commit -m "test: add e2e tests for return-by-title-search flow"
```

---

### Task 8: Run full test suite and verify nothing is broken

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All existing tests pass + all new tests pass

- [ ] **Step 2: Fix any failures if needed**

- [ ] **Step 3: Final commit if any fixes were needed**
