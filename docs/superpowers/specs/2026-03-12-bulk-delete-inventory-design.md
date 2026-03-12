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
2. **Nuke inventory in Settings** — "Danger Zone" section that wipes all titles, copies, and associated rentals after creating a backup

Both operations perform **hard deletes** (row removal), not soft-delete (`active=0`).

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

```
DELETE /api/titles/bulk
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

### Backend Logic

1. Receive array of title IDs.
2. Validate IDs exist.
3. For each title, check for active rentals (rentals where `status='out'` and copy belongs to title).
4. Titles with active rentals go into `skipped` array.
5. For remaining titles: delete copies (by `titleId`), then delete titles.
6. Return `deleted` and `skipped` arrays.

All deletes happen in a single transaction.

---

## Feature 2: Nuke Inventory in Settings

### UI Behavior

- **Location:** New "Danger Zone" section at the bottom of the Settings page, with a red border.
- **Button:** "Clear All Inventory" (danger style).
- **Flow when clicked:**
  1. Dialog shows inventory count: *"This will permanently delete {X} titles, {Y} copies, and {Z} rentals."*
  2. Auto-triggers a database backup. Shows: *"Backup created: {filename}"*
  3. Type-to-confirm input: user must type `DELETE ALL` to enable the confirm button.
  4. Final "Confirm" button (danger style, disabled until input matches).
  5. On confirm: hard-deletes all copies, rentals, and titles.
  6. Success message: *"Inventory cleared. {X} titles, {Y} copies, {Z} rentals deleted. Backup saved as {filename}."*

### API Endpoint

```
DELETE /api/titles/nuke
Content-Type: application/json

Body: { "confirm": "DELETE ALL" }

Response 200:
{
  "titlesDeleted": 150,
  "copiesDeleted": 423,
  "rentalsDeleted": 87,
  "backupFile": "rerun-backup-2026-03-12-143022.db"
}
```

### Backend Logic

1. Validate `confirm` field equals `"DELETE ALL"` (server-side safety check).
2. Create database backup using existing backup service.
3. In a single transaction:
   - Delete all rows from `copies` table.
   - Delete all rows from `rentals` table.
   - Delete all rows from `titles` table.
4. Return counts and backup filename.

---

## Data Flow

```
Bulk Delete:
  UI selects IDs → DELETE /api/titles/bulk { ids[] }
  → Server checks for active rentals per title
  → Skips titles with active rentals, reports them
  → Hard-deletes in transaction: copies (by titleId) → titles
  → Returns { deleted[], skipped[] }

Nuke:
  UI → DELETE /api/titles/nuke { confirm: "DELETE ALL" }
  → Server validates confirm string
  → Server creates backup via backup service
  → Hard-deletes in transaction: copies → rentals → titles
  → Returns { titlesDeleted, copiesDeleted, rentalsDeleted, backupFile }
```

---

## Testing Plan

### Backend Tests

**Bulk delete route (`DELETE /api/titles/bulk`):**
- Deletes multiple titles and their copies
- Skips titles with active rentals, returns them in `skipped`
- Returns empty `deleted` array when all have active rentals
- Handles empty `ids` array (400 or empty response)
- Handles non-existent IDs gracefully
- Verifies copies are deleted with their titles (cascade)
- Transaction rollback on failure

**Nuke route (`DELETE /api/titles/nuke`):**
- Rejects request without `confirm: "DELETE ALL"`
- Creates backup before deleting
- Deletes all titles, copies, and rentals
- Returns accurate counts
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
- `server/routes/titles.ts` — Add `DELETE /bulk` and `DELETE /nuke` endpoints
- `server/services/backup.ts` — May need to expose backup creation as a callable function (verify current API)

### Frontend
- `client/src/api/client.ts` — Add `titles.bulkDelete(ids)` and `titles.nuke(confirm)` methods
- `client/src/components/inventory/InventoryBrowser.tsx` — Add select mode, checkboxes, action bar
- `client/src/components/settings/` — Add Danger Zone section with nuke UI (identify correct settings file)

### Tests
- `tests/server/routes/titles.test.ts` — Add bulk delete and nuke test suites
- `tests/client/` — Add select mode and danger zone component tests
