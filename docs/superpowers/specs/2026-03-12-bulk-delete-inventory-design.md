# Bulk Delete & Nuke Inventory

**Date:** 2026-03-12
**Status:** Draft
**Purpose:** Enable bulk hard-deletion of titles and a full inventory wipe for cleaning up bad imports.

---

## Problem

When titles are imported incorrectly (wrong batch, bad data), the only option is deleting them one at a time via TitleDetail. For large bad imports, this is tedious and error-prone. There's also no way to fully reset inventory when starting fresh.

## Solution

Two features:

1. **Bulk delete in InventoryBrowser** — select mode with checkboxes, page-level select-all, hard-delete selected titles
2. **Nuke inventory in Settings** — "Danger Zone" section that wipes all inventory data after creating a backup

Both operations perform **hard deletes** (row removal), not soft-delete (`active=0`). This intentionally diverges from the existing single-title `DELETE /api/titles/:id` which performs a soft-delete. Hard-delete is appropriate here because the use case is cleaning up data that should never have existed.

---

## Foreign Key Considerations

Foreign keys are enforced (`PRAGMA foreign_keys = ON`). The delete order must respect FK constraints:

**Tables referencing inventory data:**
- `transaction_items` → references `copies.id`, `rentals.id`
- `rentals` → references `copies.id`
- `reservations` → references `titles.id`
- `copies` → references `titles.id`

**Required delete order:** `transaction_items` → `rentals` → `reservations` → `copies` → `titles`

**Transactions table:** `transactions` rows are kept as financial records. They don't have FKs pointing to deleted tables (the FK direction is `transaction_items → transactions`, not the reverse), so orphaned transaction rows are safe. Deleting financial records during an inventory wipe would be a separate, more dangerous operation.

---

## Feature 1: Bulk Delete in InventoryBrowser

### UI Behavior

- **Select mode toggle:** A "Select" button in the InventoryBrowser toolbar. Clicking it enters select mode; clicking "Cancel" exits.
- **Checkboxes:** Each title card (grid view) or row (list view) shows a checkbox in select mode.
- **Sticky action bar:** Appears at the bottom of the browser when in select mode. Contains:
  - Checkbox: "Select All on Page" (toggles all visible titles)
  - Text: "{N} selected"
  - Button: "Delete Selected" (danger style, disabled when 0 selected)
- **Confirm dialog:** Clicking "Delete Selected" shows: *"Permanently delete {N} titles and all their copies? This cannot be undone."* with Cancel and Delete buttons.
- **Active rental handling:** Titles with active rentals (`status='out'`) are skipped. After the operation, a result message shows: *"Deleted {X} titles. Skipped {Y} titles with active rentals."*
- **Post-delete:** Exits select mode, refreshes the inventory list.

### API Endpoint

Uses POST (not DELETE) because the existing `del()` API client helper doesn't support request bodies, and DELETE-with-body is poorly supported by some proxies. This matches the existing pattern where `POST /api/transactions/:id/void` is used for destructive operations with payloads.

```
POST /api/titles/bulk-delete
Content-Type: application/json

Body: { "ids": ["title-id-1", "title-id-2", ...] }

Response 200:
{
  "deleted": ["title-id-1", "title-id-3"],
  "skipped": [
    { "id": "title-id-2", "name": "Some Movie", "reason": "active rental" }
  ]
}
```

Server-side limit: max 500 IDs per request. Returns 400 if exceeded.

### Backend Logic

1. Receive array of title IDs. Validate non-empty and ≤ 500.
2. Validate IDs exist.
3. For each title, check for active rentals (rentals where `status='out'` and copy belongs to title).
4. Titles with active rentals go into `skipped` array.
5. For remaining titles, in a single transaction respecting FK order:
   - Delete `transaction_items` referencing copies/rentals of these titles
   - Delete `rentals` referencing copies of these titles
   - Delete `reservations` referencing these titles
   - Delete `copies` by `titleId`
   - Delete `titles`
6. Return `deleted` and `skipped` arrays.

---

## Feature 2: Nuke Inventory in Settings

### UI Behavior

- **Location:** New "Danger Zone" section at the bottom of the Settings page, with a red border. Implemented as a separate `DangerZone.tsx` component to avoid bloating `SettingsPage.tsx` (already 1000+ lines).
- **Button:** "Clear All Inventory" (danger style).
- **Flow when clicked:**
  1. Dialog shows inventory count: *"This will permanently delete {X} titles, {Y} copies, and all associated rentals, reservations, and transaction records."*
  2. Auto-triggers a database backup. Shows: *"Backup created: {filename}"*
  3. Type-to-confirm input: user must type `DELETE ALL` (case-sensitive) to enable the confirm button.
  4. Final "Confirm" button (danger style, disabled until input matches).
  5. On confirm: hard-deletes all inventory-related data.
  6. Success message: *"Inventory cleared. {X} titles, {Y} copies deleted. Backup saved as {filename}."*

### API Endpoint

```
POST /api/titles/nuke
Content-Type: application/json

Body: { "confirm": "DELETE ALL" }

Response 200:
{
  "titlesDeleted": 150,
  "copiesDeleted": 423,
  "rentalsDeleted": 87,
  "reservationsDeleted": 12,
  "transactionItemsDeleted": 340,
  "backupFile": "rerun-backup-2026-03-12-143022.db"
}
```

### Backend Logic

1. Validate `confirm` field equals `"DELETE ALL"` (server-side safety check). Return 400 if missing/wrong.
2. Create database backup by calling extracted backup utility function.
3. In a single transaction, delete in FK-safe order:
   - Delete all `transaction_items`
   - Delete all `rentals`
   - Delete all `reservations`
   - Delete all `copies`
   - Delete all `titles`
4. Return counts and backup filename.

**Note:** `transactions` table is preserved as a financial audit trail.

---

## Data Flow

```
Bulk Delete:
  UI selects IDs → POST /api/titles/bulk-delete { ids[] }
  → Server validates (non-empty, ≤ 500)
  → Server checks for active rentals per title
  → Skips titles with active rentals, reports them
  → Hard-deletes in transaction: transaction_items → rentals → reservations → copies → titles
  → Returns { deleted[], skipped[] }

Nuke:
  UI → POST /api/titles/nuke { confirm: "DELETE ALL" }
  → Server validates confirm string
  → Server creates backup via backup utility
  → Hard-deletes in transaction: transaction_items → rentals → reservations → copies → titles
  → Returns { titlesDeleted, copiesDeleted, rentalsDeleted, reservationsDeleted, transactionItemsDeleted, backupFile }
```

---

## Testing Plan

### Backend Tests

**Bulk delete route (`POST /api/titles/bulk-delete`):**
- Deletes multiple titles and their copies
- Deletes associated rentals, reservations, and transaction_items
- Skips titles with active rentals, returns them in `skipped`
- Returns empty `deleted` array when all have active rentals
- Rejects empty `ids` array with 400
- Rejects arrays exceeding 500 IDs with 400
- Handles non-existent IDs gracefully
- Transaction rollback on failure

**Nuke route (`POST /api/titles/nuke`):**
- Rejects request without `confirm: "DELETE ALL"` with 400
- Rejects wrong confirm string (e.g., "delete all" lowercase)
- Creates backup before deleting
- Deletes all titles, copies, rentals, reservations, and transaction_items
- Preserves transactions table
- Returns accurate counts for all affected tables
- Returns backup filename
- Works on empty database (no-op, returns zeros)

### Frontend Tests

**InventoryBrowser select mode:**
- Toggle into/out of select mode
- Checkbox selection toggles individual titles
- "Select All on Page" selects/deselects all visible
- Selected count updates correctly
- "Delete Selected" button disabled when 0 selected
- Confirm dialog shows correct count
- Handles skipped titles in result message
- Exits select mode after deletion

**Settings Danger Zone:**
- "Clear All Inventory" button renders in Danger Zone section
- Dialog shows correct inventory counts
- Confirm button disabled until user types "DELETE ALL"
- Case-sensitive match on type-to-confirm
- Success message shows deletion stats and backup filename

---

## Files to Modify

### Backend
- `server/routes/titles.ts` — Add `POST /bulk-delete` and `POST /nuke` endpoints
- `server/routes/backup.ts` — Extract backup creation logic into a shared utility function (e.g., `server/lib/create-backup.ts`) so it can be called from both the backup route and the nuke endpoint

### Frontend
- `client/src/api/client.ts` — Add `titles.bulkDelete(ids)` and `titles.nuke(confirm)` methods (using `post()` helper)
- `client/src/components/inventory/InventoryBrowser.tsx` — Add select mode, checkboxes, sticky action bar
- `client/src/components/settings/DangerZone.tsx` — New component for the Danger Zone section
- `client/src/components/settings/SettingsPage.tsx` — Import and render DangerZone component

### Tests
- `tests/server/routes/titles.test.ts` — Add bulk delete and nuke test suites
- `tests/client/` — Add select mode and danger zone component tests
