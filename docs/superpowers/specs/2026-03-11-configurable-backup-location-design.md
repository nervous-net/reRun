# Configurable Backup Location

## Overview

Allow reRun Video store operators to choose where backup files are saved — any local directory, USB drive, NAS mount, or network share. When the chosen path is unavailable (drive unplugged, mount lost), backups fall back to the default location and surface a warning in the UI.

## Current State

- Backup path is hardcoded: `path.join(path.dirname(DB_PATH), 'backups')` → `./data/backups/`
- Three backup types exist: manual (`rerun-*.db`), daily auto (`rerun-daily-*.db`), pre-update (`pre-update-*.db`)
- Settings are stored in the `store_settings` key-value table (SQLite)
- The only backup-related setting today is `last_backup_at`

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage mechanism | `store_settings` table | Consistent with existing config pattern; no schema changes needed |
| Scope | All backup types (manual, auto, pre-update) | Simplicity — one path for everything |
| Fallback behavior | Fall back to default path + UI warning | Never skip a backup; alert the user so they can fix it |
| Path selection UI | Text input + server-side directory browser | Can't use native file picker in a web UI; browser modal is more user-friendly than typing paths blind |

## Data Layer

### New `store_settings` Keys

| Key | Value | Default |
|-----|-------|---------|
| `backup_dir` | Absolute path string | Empty (use default `{DB_DIR}/backups/`) |
| `backup_fallback_warning` | `"true"` or `"false"` | `"false"` |

- `backup_dir`: When set and non-empty, all backup operations target this directory. When empty/unset, use the current default.
- `backup_fallback_warning`: Set to `"true"` when a backup operation falls back to the default path because the custom path was unavailable. Reset to `"false"` when the user updates their backup path or dismisses the warning banner.

## Server API

### New Endpoints

#### `GET /api/filesystem/browse`

Server-side directory browser for the path selection UI.

**Query Parameters:**
- `path` (optional) — Directory to list. Defaults to `/` on Unix, filesystem roots on Windows.

**Response (200):**
```json
{
  "current": "/mnt/usb",
  "parent": "/mnt",
  "directories": [
    { "name": "rerun-backups", "path": "/mnt/usb/rerun-backups" },
    { "name": "other-folder", "path": "/mnt/usb/other-folder" }
  ]
}
```

**Behavior:**
- Returns only directories, never files
- Validates the path exists and is a directory
- Returns 400 if path doesn't exist or isn't a directory
- Rejects dangerous paths on Linux (`/proc`, `/sys`, `/dev`)
- Sorts directories alphabetically

#### `POST /api/settings/backup-dir/verify`

Validates that a path is usable for backups before saving.

**Request Body:**
```json
{ "path": "/mnt/usb/rerun-backups" }
```

**Response (200):**
```json
{
  "valid": true,
  "exists": true,
  "writable": true,
  "created": false
}
```

**Behavior:**
- Checks if the directory exists
- If it doesn't exist, attempts to create it (`mkdir -p` equivalent)
- If created, sets `created: true` in response
- Writes and removes a temp file to verify write access
- Returns `valid: false` with an `error` string if anything fails

### Modified Behavior

#### Backup Path Resolution

All three backup code paths (manual, auto, pre-update) share a common resolution function:

```
function resolveBackupDir(db):
  customPath = db.select(store_settings, key='backup_dir')
  if customPath is set and non-empty:
    if customPath exists and is writable:
      return { path: customPath, fallback: false }
    else:
      db.upsert(store_settings, key='backup_fallback_warning', value='true')
      return { path: defaultBackupDir, fallback: true }
  return { path: defaultBackupDir, fallback: false }
```

This is called at backup time (not cached) so path changes take effect immediately.

#### `POST /api/backup` (manual backup)

- Uses `resolveBackupDir()` to determine target directory
- No other changes to behavior

#### Auto-backup middleware

- Uses `resolveBackupDir()` to determine target directory
- Logs a warning to console if falling back

#### `scripts/do-update.ts` (pre-update backup)

- Uses `resolveBackupDir()` to determine target directory
- If fallback occurs during an update, logs prominently but continues the update

#### `GET /api/backup/list`

- When a custom `backup_dir` is set, scans both the custom path AND the default path
- Merges results into a single list, sorted by creation time (most recent first)
- Each entry includes a `location` field (the full directory path) so restore knows where to find the file
- Deduplicates by filename (custom path takes precedence if same filename exists in both)

#### `POST /api/backup/restore/:filename`

- Accepts an optional `location` query param or body field to specify which directory the backup is in
- Falls back to searching custom path first, then default path
- No other changes to restore behavior

## Client UI

### Settings Page — Backup Location Subsection

Added above the existing backup list in the "Backup & Restore" section.

**Components:**
- **Path input** — Text field showing the current custom backup path, or placeholder text "Default (./data/backups/)"
- **Browse button** — Opens the directory browser modal
- **Save button** — Calls the verify endpoint, then saves to `store_settings` via `PUT /api/settings/backup_dir`
- **Clear button** — Resets to default (deletes the `backup_dir` setting)
- **Helper text** — "Choose a folder for backups. Leave empty to use the default location next to the database."

**Save flow:**
1. User enters/browses a path
2. User clicks Save
3. Client calls `POST /api/settings/backup-dir/verify` with the path
4. If `valid: true` — save the setting, show success toast
5. If `valid: false` — show the error message, don't save
6. If directory was created (`created: true`) — include that in the success message: "Folder created and saved"

### Directory Browser Modal

A CRT-themed modal for navigating the server's filesystem.

**Layout:**
- **Header:** "Select Backup Folder" with current path displayed
- **Navigation:** "Up" button (disabled at root), breadcrumb-style path display
- **Directory list:** Scrollable list of subdirectories. Each row is clickable to navigate into.
- **Footer:** "Select This Folder" button (confirms selection) and "Cancel" button

**Behavior:**
- Opens at the current `backup_dir` value if set, otherwise at the default backup directory
- Clicking a directory navigates into it (calls `GET /api/filesystem/browse?path=...`)
- "Select This Folder" populates the text input with the current path and closes the modal
- Loading state while fetching directories
- Error state if a directory can't be read (permissions, etc.)

### Fallback Warning Banner

Displayed when `backup_fallback_warning` is `"true"`.

**Where:** Dashboard page and Settings page.

**Appearance:** Amber/yellow banner, consistent with CRT aesthetic.

**Text:** "Backup location unavailable — backups are being saved to the default location. Check your backup path in Settings."

**Behavior:**
- On Settings page: the warning appears near the Backup Location input
- On Dashboard: the warning appears as a banner, clicking it navigates to Settings
- Dismissable via an "X" button — sets `backup_fallback_warning` to `"false"` via the settings API
- Automatically clears when the user successfully saves a new (valid) backup path

## Testing

### Server Unit Tests

- `resolveBackupDir` returns custom path when set and available
- `resolveBackupDir` falls back to default and sets warning when custom path unavailable
- `resolveBackupDir` returns default when no custom path set
- Browse endpoint returns only directories
- Browse endpoint rejects non-existent paths
- Browse endpoint rejects dangerous paths (`/proc`, `/sys`)
- Verify endpoint confirms writable directory
- Verify endpoint creates directory if it doesn't exist
- Verify endpoint returns error for unwritable path
- Backup list merges files from both directories when custom path is set
- Backup list deduplicates by filename

### Server Integration Tests

- Full cycle: set custom path → create manual backup → verify file exists at custom path
- Full cycle: set unavailable custom path → auto-backup → file at default path → warning flag set
- Restore from backup in custom directory
- Restore from backup in default directory when custom path is set
- Pre-update backup respects custom path

### Client Tests

- Directory browser modal opens at correct initial path
- Navigating into a directory updates the listing
- "Up" button navigates to parent
- "Select This Folder" populates the input
- Save triggers verify → save flow
- Save shows error when verify fails
- Fallback warning banner appears when flag is set
- Dismissing banner clears the flag
- Clear button resets to default

### E2E Tests

- Set custom backup path via Settings UI → create backup → verify backup at custom location
- Set custom path to unavailable location → trigger auto-backup → verify fallback warning appears on Dashboard
- Dismiss fallback warning → verify it disappears
- Change backup path → verify new backups go to new location
- Backups from old location still appear in backup list after path change
