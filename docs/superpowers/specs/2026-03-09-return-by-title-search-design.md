# Return by Title Search + Persistent Return Queue

**Date:** 2026-03-09
**Status:** Approved

## Problem

Returns currently require scanning a copy's barcode. Clerks need the ability to search by movie name and select which copy to return. Additionally, the return queue disappears on page navigation — clerks want to see today's returns throughout the day.

## Design

### Dual-Purpose Input

The return screen's existing scan input becomes dual-purpose:

1. If input matches a copy barcode → existing barcode lookup flow (no change)
2. If no barcode match → treat as title search via `GET /api/search?q=...`

No UI changes to the input. Detection is automatic.

### Title Search Results → Copy Selection

When title search returns results, a two-step selection flow:

**Step 1: Title list**
- Modal/panel showing matching titles (name, year, format info)
- Clerk clicks a title to drill in

**Step 2: Rented-out copies for that title**
- Shows only copies with status `'out'` (currently rented)
- Each copy has a clear numbered indicator: **1**, **2**, **3**
- Each row displays: number, barcode, format, customer name, due date, overdue status
- Clicking a numbered copy adds it directly to the return queue (same behavior as barcode scan)

### Persistent Return Queue (Today's Returns)

Replace in-memory storage for processed returns with a server query.

**New endpoint:** `GET /api/rentals/returned-today`
- Queries rentals where `returnedAt` falls on today's date
- Returns rental + copy + title + customer data

**Return screen layout (two sections):**
- **Pending returns** (top): Items scanned but not yet processed. In-memory state, same as today.
- **Today's returns** (bottom): Already processed returns pulled from DB. Persists across refreshes and navigation. Resets naturally at midnight via date filter.

## Key Files

### Server
- `server/routes/rentals.ts` — new returned-today endpoint
- `server/services/rental.ts` — new query function
- `server/routes/search.ts` — may need to support searching without `available` filter

### Client
- `client/src/components/rentals/ReturnScreen.tsx` — dual-purpose input, title search modal, copy selection, today's returns section
- `client/src/api/client.ts` — new API method for returned-today

### Tests
- Unit tests for returned-today service query
- Unit tests for barcode-vs-search detection logic
- Integration tests for the new endpoint
- E2e tests for the full search → select → return flow
