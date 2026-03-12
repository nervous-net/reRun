# v0.3.9 Design: Update UX Fix

## Problem

Users click "Install Update", get no feedback, don't know if it worked, and stale browser cache means even successful updates don't show new content until a hard refresh.

## Changes

### 1. Cache-busting on `index.html`

In `server/app.ts`, the SPA fallback serves `index.html` with no cache headers. Add `Cache-Control: no-cache, no-store, must-revalidate` to the HTML response only. Vite's hashed assets (`/assets/foo-abc123.js`) stay cacheable — this only affects the HTML shell that references them.

Note: Direct requests to `/index.html` via `serveStatic` bypass the SPA fallback, but this is a POS system accessed via localhost — nobody is typing `/index.html` directly.

### 2. Update modal with status polling

When the user clicks "Install Update" (on Dashboard or Settings), show a modal that:

- Displays a spinner with status text: "Updating to vX.X.X..."
- Polls `GET /api/update/status` every 2 seconds (matches existing polling interval)
- **During PM2 restart**: polling requests will fail (connection refused). The modal tolerates this silently — keep polling, show "Restarting..." status text
- **Success**: when `currentVersion` changes from what it was before → show "Update complete!" for 2 seconds, then `window.location.reload()`
- **Failure**: if `lastError` is populated on a status response → show the error message from the log
- **Timeout**: after 3 minutes of no version change → show "Update may have failed. Check data/update.log for details."

The modal blocks interaction with the rest of the page (no clicking around during an update).

**Replaces** the existing inline polling code and `installing`/`installingUpdate` state in both `Dashboard.tsx` and `SettingsPage.tsx`. The old inline handlers are removed in favor of the shared `UpdateModal` component.

### 3. Server-side update status improvement

Add `lastError: string | null` to the update status response.

**Reading errors**: On each `GET /api/update/status` call (not just startup), if the `updating` flag is `true`, read the last line of `data/update.log`. If it contains "UPDATE FAILED", populate `lastError` with that line and flip `updating` back to `false`.

**Why on each request, not just startup**: If the update script fails, PM2 does NOT restart. The in-memory `updating` flag stays `true` forever. Reading the log on each status poll is the only way to detect failure during the same server session. The log file is tiny — this read is cheap.

**Clearing**: `lastError` is cleared when a new update is initiated (`POST /install` sets `lastError = null`). After a successful update + PM2 restart, the server starts fresh with `lastError = null` by default.

### 4. Version bump to 0.3.9

`package.json` version bump.

## What stays the same

- The actual update mechanism (`do-update.ts`) — it works, the problem is feedback not plumbing
- Version display locations (footer + Settings) — already sufficient
- Update checker polling interval (6h) — fine

## Files touched

- `server/app.ts` — cache-control header on index.html
- `server/services/update.ts` — add `lastError` field, read update.log on status requests when updating
- `server/routes/update.ts` — no changes needed (status already returns full state)
- `client/src/components/dashboard/Dashboard.tsx` — replace inline update handler with UpdateModal
- `client/src/components/settings/SettingsPage.tsx` — replace inline update handler with UpdateModal
- New: `client/src/components/common/UpdateModal.tsx` — shared modal component
- `package.json` — version bump

## Testing

- Unit tests for `lastError` parsing: reads log when `updating` is true, extracts error, flips flag
- Unit tests for `lastError` clearing: reset on new install request
- Integration test: `GET /` returns `Cache-Control: no-cache` header, `GET /assets/foo.js` does not
- Component test: UpdateModal renders spinner, transitions to success on version change, transitions to error on `lastError`, transitions to timeout after deadline
- Component test: UpdateModal tolerates fetch failures (connection refused during restart) without showing error
- Component test: polling stops after success/failure/timeout
