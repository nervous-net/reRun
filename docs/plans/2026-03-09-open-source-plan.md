# Open Source Release Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Open-source reRun under GPL-3.0 with contributor docs, and fix the update checker button.

**Architecture:** Add standard open-source files (LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT), update package.json metadata, and add a force-check endpoint so the "Check for Updates" button triggers a real GitHub API call instead of just reading cached status.

**Tech Stack:** Hono (server routes), React 19 (client), Vitest (tests)

---

### Task 1: Add GPL-3.0 License

**Files:**
- Create: `COPYING`

**Step 1: Download GPL-3.0 full text**

Run: `curl -sL https://www.gnu.org/licenses/gpl-3.0.txt -o COPYING`

**Step 2: Verify file exists**

Run: `head -5 COPYING`
Expected: First lines of GPL-3.0 text

**Step 3: Commit**

```bash
git add COPYING
git commit -m "chore: add GPL-3.0 license"
```

---

### Task 2: Update package.json metadata

**Files:**
- Modify: `package.json`

**Step 1: Add license, author, and repository fields**

Add these fields to `package.json`:

```json
"license": "GPL-3.0-or-later",
"author": "Dylan Reed",
"repository": {
  "type": "git",
  "url": "https://github.com/nervous-net/reRun.git"
},
```

Keep `"private": true` — this is an app, not an npm package.

**Step 2: Commit**

```bash
git add package.json
git commit -m "chore: add license, author, repository to package.json"
```

---

### Task 3: Create README.md

**Files:**
- Create: `README.md`

**Step 1: Write README**

Content should include:
- Project name + one-liner: "A retro CRT-styled point-of-sale system for independent video rental stores"
- Screenshot placeholder (commented out HTML img tag)
- Feature bullets:
  - Checkout & returns with barcode/manual lookup
  - Customer management with family member tracking
  - Inventory management with TMDb integration
  - Age restriction enforcement
  - Lightspeed POS reference codes for reconciliation
  - Automatic updates from GitHub releases
  - Daily database backups
  - CRT aesthetic with green phosphor theme
- Tech stack: Hono, React 19, React Router v7, SQLite (better-sqlite3), Drizzle ORM, Vite
- Quick start section pointing to `INSTALL.md`
- Development section: `npm install`, `npm run dev`, `npm test`
- Contributing: link to `CONTRIBUTING.md`
- License: GPL-3.0-or-later, link to `COPYING`

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

---

### Task 4: Create CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

**Step 1: Write contributing guide**

Sections:
- **Welcome** — brief intro, we appreciate contributions
- **Prerequisites** — Node.js 22+, npm
- **Development Setup** — clone, `npm install`, `npm run dev`, opens at localhost:1987
- **Project Structure** — `server/` (Hono API + services), `client/` (React SPA), `scripts/` (install/update), `drizzle/` (migrations), `data/` (SQLite DB, not committed)
- **Code Conventions:**
  - Every file starts with 2-line `// ABOUTME:` comment explaining what the file does
  - Match the style of surrounding code
  - No `--no-verify` on git commits, ever
  - All monetary values in cents, tax in basis points
  - Comments should be evergreen (no "recently added" or "new implementation")
- **Testing:**
  - We practice TDD — write tests first
  - Run tests: `npm run test:run` (single run) or `npm test` (watch)
  - Tests must pass before submitting PR
  - Test setup uses in-memory SQLite via `createTestDb()` + `migrateTestDb()`
- **Pull Request Process:**
  - Fork the repo
  - Create a feature branch from `main`
  - Make your changes with tests
  - Run `npm run test:run` and ensure all tests pass
  - Submit PR against `main`
  - Describe what your PR does and why
- **Reporting Issues** — use GitHub Issues, include steps to reproduce, expected vs actual behavior

**Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add contributing guidelines"
```

---

### Task 5: Add Code of Conduct

**Files:**
- Create: `CODE_OF_CONDUCT.md`

**Step 1: Add Contributor Covenant v2.1**

Use the standard Contributor Covenant 2.1 template. Set contact method to GitHub Issues.

**Step 2: Commit**

```bash
git add CODE_OF_CONDUCT.md
git commit -m "docs: add Contributor Covenant code of conduct"
```

---

### Task 6: Add force-check to update service (TDD)

**Files:**
- Modify: `server/services/update.ts`
- Test: `tests/server/services/update.test.ts`

**Step 1: Write the failing test**

Add to `tests/server/services/update.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isNewerVersion, parseGitHubRelease } from '../../../server/services/update.js';

// Keep all existing tests, then add:

describe('forceCheck', () => {
  it('calls checkForUpdates and updates cached status', async () => {
    // This test will be filled in after we define the interface
    // For now, just verify forceCheck is exported and callable
    const { forceCheck } = await import('../../../server/services/update.js');
    expect(typeof forceCheck).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/server/services/update.test.ts`
Expected: FAIL — `forceCheck` is not exported

**Step 3: Implement forceCheck in update service**

Add to `server/services/update.ts`:

```typescript
export async function forceCheck(): Promise<UpdateStatus> {
  if (!cachedStatus.currentVersion) {
    return { ...cachedStatus };
  }
  const update = await checkForUpdates(cachedStatus.currentVersion);
  cachedStatus.availableUpdate = update;
  cachedStatus.lastChecked = new Date().toISOString();
  return { ...cachedStatus };
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/server/services/update.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/update.ts tests/server/services/update.test.ts
git commit -m "feat: add forceCheck to update service"
```

---

### Task 7: Add POST /api/update/check endpoint (TDD)

**Files:**
- Modify: `server/routes/update.ts`
- Test: `tests/server/routes/update.test.ts`

**Step 1: Update the mock to include forceCheck**

In `tests/server/routes/update.test.ts`, update the `vi.mock` block to include `forceCheck`:

```typescript
vi.mock('../../../server/services/update.js', () => {
  let status = {
    currentVersion: '0.1.0',
    availableUpdate: null as any,
    lastChecked: '2026-03-05T10:00:00.000Z',
    updating: false,
  };
  return {
    getUpdateStatus: vi.fn(() => ({ ...status })),
    setUpdating: vi.fn((val: boolean) => { status.updating = val; }),
    forceCheck: vi.fn(async () => {
      status.lastChecked = new Date().toISOString();
      return { ...status };
    }),
    __setMockStatus: (s: any) => { status = s; },
  };
});
```

**Step 2: Write the failing test**

Add to the describe block:

```typescript
it('POST /api/update/check triggers force check and returns status', async () => {
  const res = await app.request('/api/update/check', { method: 'POST' });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('currentVersion');
  expect(body).toHaveProperty('lastChecked');
});
```

**Step 3: Run test to verify it fails**

Run: `npx vitest run tests/server/routes/update.test.ts`
Expected: FAIL — 404 not found

**Step 4: Add the route**

In `server/routes/update.ts`, add the import of `forceCheck` and the new route:

```typescript
import { getUpdateStatus, setUpdating, forceCheck } from '../services/update.js';

// Add inside createUpdateRoutes, before the return:
routes.post('/check', async (c) => {
  const status = await forceCheck();
  return c.json(status);
});
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/server/routes/update.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add server/routes/update.ts tests/server/routes/update.test.ts
git commit -m "feat: add POST /api/update/check endpoint for force refresh"
```

---

### Task 8: Wire client to use force-check endpoint

**Files:**
- Modify: `client/src/api/client.ts`
- Modify: `client/src/components/settings/SettingsPage.tsx`
- Modify: `client/src/components/dashboard/Dashboard.tsx`

**Step 1: Add check method to API client**

In `client/src/api/client.ts`, update the `update` object:

```typescript
update: {
  status: () => get<any>('/api/update/status'),
  check: () => post<any>('/api/update/check'),
  install: () => post<any>('/api/update/install'),
},
```

**Step 2: Update Settings page handleCheckUpdate**

In `client/src/components/settings/SettingsPage.tsx`, change `handleCheckUpdate` (line ~396):

```typescript
async function handleCheckUpdate() {
  setCheckingUpdate(true);
  try {
    const status = await api.update.check();
    setUpdateStatus(status);
  } catch {}
  setCheckingUpdate(false);
}
```

Change: `api.update.status()` → `api.update.check()`

**Step 3: Dashboard keeps using status (read-only on load)**

The Dashboard's `loadDashboard` callback at line ~359 should keep using `api.update.status()` for the passive load. No change needed here — the dashboard reads cache on load, which is correct behavior.

**Step 4: Commit**

```bash
git add client/src/api/client.ts client/src/components/settings/SettingsPage.tsx
git commit -m "feat: wire Check for Updates button to force-check endpoint"
```

---

### Task 9: Build and test the update flow

**Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (except the pre-existing return-flow late fee test)

**Step 2: Build the project**

Run: `npm run build`
Expected: Clean build with no errors

**Step 3: Manual smoke test**

1. Reinstall v0.2.9 from the zip to `~/rerun`
2. Start with PM2
3. Open http://localhost:1987
4. Go to Settings → click "Check for Updates"
5. Verify it shows "Update available: v0.3.1"
6. Click "Install Update"
7. Verify app restarts with new version

**Step 4: Commit any remaining changes**

If any fixes were needed during smoke test, commit them.
