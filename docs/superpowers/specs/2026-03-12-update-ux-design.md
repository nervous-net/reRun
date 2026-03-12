# v0.3.9 Design: Update UX Fix

## Problem

Users click "Install Update", get no feedback, don't know if it worked, and stale browser cache means even successful updates don't show new content until a hard refresh.

## Changes

### 1. Cache-busting on `index.html`

In `server/app.ts`, the SPA fallback serves `index.html` with no cache headers. Add `Cache-Control: no-cache, no-store, must-revalidate` to the HTML response only. Vite's hashed assets (`/assets/foo-abc123.js`) stay cacheable — this only affects the HTML shell that references them.

### 2. Update modal with status polling

When the user clicks "Install Update" (on Dashboard or Settings), show a modal that:

- Displays a spinner with status text: "Updating to vX.X.X..."
- Polls `GET /api/update/status` every 3 seconds
- **Success**: when `currentVersion` changes from what it was before → show "Update complete!" for 2 seconds, then `window.location.reload()`
- **Failure**: if `updating` flips back to `false` without a version change → show "Update failed. Ask your admin to check `data/update.log`"
- **Timeout**: after 3 minutes of no change → show the same failure message

The modal blocks interaction with the rest of the page (no clicking around during an update).

### 3. Server-side update status improvement

Add an `error` field to the update status. When `do-update.ts` fails, it already writes to `update.log`. On server startup, if `update.log` exists and the last line contains "UPDATE FAILED", populate `status.lastError` with that line. This way the polling UI can show *why* it failed instead of just "it failed."

### 4. Version bump to 0.3.9

`package.json` version bump.

## What stays the same

- The actual update mechanism (`do-update.ts`) — it works, the problem is feedback not plumbing
- Version display locations (footer + Settings) — already sufficient
- Update checker polling interval (6h) — fine

## Files touched

- `server/app.ts` — cache-control header on index.html
- `server/services/update.ts` — add `lastError` field, read from update.log on startup
- `server/routes/update.ts` — no changes needed (status already returns full state)
- `client/src/components/dashboard/Dashboard.tsx` — update modal
- `client/src/components/settings/SettingsPage.tsx` — update modal (shared component)
- New: `client/src/components/common/UpdateModal.tsx` — shared modal component
- `package.json` — version bump

## Testing

- Unit tests for `lastError` parsing from update.log
- Integration test: cache-control headers on index.html vs static assets
- Component test: UpdateModal states (polling, success, failure, timeout)
