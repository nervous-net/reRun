# v0.3.9 Update UX Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give users feedback during the update process and fix stale browser cache preventing new features from appearing after update.

**Architecture:** Add `lastError` detection to the existing update status service by reading `data/update.log` on status polls. Create a shared `UpdateModal` component that replaces the inline polling in both Dashboard and Settings. Add `Cache-Control` headers to the SPA fallback for `index.html`.

**Tech Stack:** Hono (server), React 19 (client), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-12-update-ux-design.md`

---

## Task 1: Add `lastError` detection to update service

**Files:**
- Modify: `server/services/update.ts`
- Test: `tests/server/services/update.test.ts`

- [ ] **Step 1: Write failing tests for `readLastError` and `lastError` in status**

In `tests/server/services/update.test.ts`, add:

```typescript
import { readLastError } from '../../../server/services/update.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('readLastError', () => {
  it('returns null when log file does not exist', () => {
    expect(readLastError('/nonexistent/update.log')).toBeNull();
  });

  it('returns error message when last line contains UPDATE FAILED', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-test-'));
    const logPath = path.join(tmpDir, 'update.log');
    fs.writeFileSync(logPath, [
      '[2026-03-12T10:00:00.000Z] Starting update to v0.3.8',
      '[2026-03-12T10:00:05.000Z] UPDATE FAILED: Download failed: 404',
    ].join('\n'));
    expect(readLastError(logPath)).toBe('UPDATE FAILED: Download failed: 404');
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('returns null when last line is a success message', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'update-test-'));
    const logPath = path.join(tmpDir, 'update.log');
    fs.writeFileSync(logPath, [
      '[2026-03-12T10:00:00.000Z] Starting update to v0.3.8',
      '[2026-03-12T10:00:30.000Z] Update to v0.3.8 complete!',
    ].join('\n'));
    expect(readLastError(logPath)).toBeNull();
    fs.rmSync(tmpDir, { recursive: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/server/services/update.test.ts`
Expected: FAIL — `readLastError` is not exported

- [ ] **Step 3: Implement `readLastError` and add `lastError` to status**

In `server/services/update.ts`:

1. Add `import fs from 'fs';` and `import path from 'path';` at the top
2. Add `lastError: string | null` to `UpdateStatus` interface
3. Initialize `lastError: null` in `cachedStatus`
4. Add `logFilePath` variable (set by `startUpdateChecker`)
5. Add exported function:

```typescript
export function readLastError(logPath: string): string | null {
  try {
    if (!fs.existsSync(logPath)) return null;
    const content = fs.readFileSync(logPath, 'utf-8').trimEnd();
    const lastLine = content.split('\n').pop() ?? '';
    const match = lastLine.match(/\] (UPDATE FAILED: .+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
```

6. Modify `getUpdateStatus()`: when `cachedStatus.updating` is `true` and `logFilePath` is set, call `readLastError(logFilePath)`. If it returns a value, set `cachedStatus.lastError` to it and flip `cachedStatus.updating` to `false`.

7. Modify `setUpdating(true)` call path: when setting to `true`, also clear `cachedStatus.lastError = null`.

8. In `startUpdateChecker`, accept a second param `dataDir: string` and store `logFilePath = path.join(dataDir, 'update.log')`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/server/services/update.test.ts`
Expected: PASS

- [ ] **Step 5: Update `startUpdateChecker` call in `server/app.ts`**

Change line 74 from:
```typescript
startUpdateChecker(pkg.version);
```
to:
```typescript
startUpdateChecker(pkg.version, path.dirname(DB_PATH));
```

- [ ] **Step 6: Write test for lastError in route response**

In `tests/server/routes/update.test.ts`:
1. Add `lastError: null` to the mock status object in the `vi.mock` factory AND in the `beforeEach` `setMockStatus` call
2. Add test:

```typescript
it('GET /api/update/status includes lastError field', async () => {
  setMockStatus({
    currentVersion: '0.1.0',
    availableUpdate: null,
    lastChecked: '2026-03-05T10:00:00.000Z',
    updating: false,
    lastError: 'UPDATE FAILED: Download failed: 404',
  });
  const res = await app.request('/api/update/status');
  const body = await res.json();
  expect(body.lastError).toBe('UPDATE FAILED: Download failed: 404');
});
```

- [ ] **Step 7: Run route tests**

Run: `npx vitest run tests/server/routes/update.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/services/update.ts server/app.ts tests/server/services/update.test.ts tests/server/routes/update.test.ts
git commit -m "feat: add lastError detection to update status service"
```

---

## Task 2: Add cache-busting headers on `index.html`

**Files:**
- Modify: `server/app.ts`

The SPA fallback only runs when `NODE_ENV === 'production'` and reads `dist/client/index.html` from disk, which doesn't exist in the test environment. This is a one-line header addition — verified manually after build. No empty test file needed.

- [ ] **Step 1: Add Cache-Control header to SPA fallback**

In `server/app.ts`, change the SPA fallback (lines 83-86) from:

```typescript
  app.get('*', (c) => {
    const html = fs.readFileSync('./dist/client/index.html', 'utf-8');
    return c.html(html);
  });
```

to:

```typescript
  app.get('*', (c) => {
    const html = fs.readFileSync('./dist/client/index.html', 'utf-8');
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return c.html(html);
  });
```

- [ ] **Step 2: Run full test suite to verify nothing breaks**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add server/app.ts
git commit -m "fix: add cache-busting headers to index.html SPA fallback"
```

---

## Task 3: Create `UpdateModal` component

**Files:**
- Create: `client/src/components/common/UpdateModal.tsx`

- [ ] **Step 1: Create the UpdateModal component**

The component uses the existing `Modal` component and `api` client.

**Note:** The `Modal` component renders an `X` close button and supports Esc/click-outside to close. We pass `onClose={() => {}}` as a no-op so the modal cannot be dismissed during an active update. The close button and Esc still fire but do nothing. This is acceptable — the modal auto-closes on success via page reload, and on failure/timeout the user can see the error. No spinner CSS animation is used — instead we use a simple text-based indicator (`[ ◉ ]`) that the CRT theme already makes look good via text-shadow/glow.

```tsx
// ABOUTME: Modal shown during app updates with polling status feedback
// ABOUTME: Displays progress, detects success/failure/timeout, auto-reloads on success

import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from './Modal';
import { api } from '../../api/client';

interface UpdateModalProps {
  isOpen: boolean;
  version: string;
  previousVersion: string;
}

type UpdatePhase = 'installing' | 'restarting' | 'success' | 'failed' | 'timeout';

const POLL_INTERVAL_MS = 2000;
const TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export function UpdateModal({ isOpen, version, previousVersion }: UpdateModalProps) {
  const [phase, setPhase] = useState<UpdatePhase>('installing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    setPhase('installing');
    setErrorMessage(null);

    // Start timeout
    timeoutRef.current = setTimeout(() => {
      cleanup();
      setPhase('timeout');
    }, TIMEOUT_MS);

    // Start polling
    intervalRef.current = setInterval(async () => {
      try {
        const status = await api.update.status();

        // Check for error
        if (status.lastError) {
          cleanup();
          setErrorMessage(status.lastError);
          setPhase('failed');
          return;
        }

        // Check for version change (success)
        if (status.currentVersion && status.currentVersion !== previousVersion) {
          cleanup();
          setPhase('success');
          setTimeout(() => window.location.reload(), 2000);
          return;
        }
      } catch {
        // Connection refused — server is restarting, keep polling
        setPhase('restarting');
      }
    }, POLL_INTERVAL_MS);

    return cleanup;
  }, [isOpen, previousVersion, cleanup]);

  const phaseText: Record<UpdatePhase, string> = {
    installing: `Updating to v${version}...`,
    restarting: 'Restarting server...',
    success: 'Update complete! Reloading...',
    failed: errorMessage ?? 'Update failed. Check data/update.log for details.',
    timeout: 'Update may have failed. Check data/update.log for details.',
  };

  const isTerminal = phase === 'success' || phase === 'failed' || phase === 'timeout';
  const isError = phase === 'failed' || phase === 'timeout';

  const iconStyle = {
    fontSize: 'var(--font-size-xl)',
    marginBottom: 'var(--space-md)',
    textShadow: 'var(--glow-green)',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="System Update"
      maxWidth="450px"
    >
      <div style={{
        textAlign: 'center',
        padding: 'var(--space-md)',
        color: isError ? 'var(--crt-red, #ff4444)' : 'var(--crt-green)',
        fontFamily: 'var(--font-mono)',
      }}>
        {!isTerminal && (
          <div style={iconStyle}>[ ◉ ]</div>
        )}
        {phase === 'success' && (
          <div style={iconStyle}>[ ✓ ]</div>
        )}
        {isError && (
          <div style={{ ...iconStyle, textShadow: 'none', color: 'var(--crt-red, #ff4444)' }}>
            [ ✗ ]
          </div>
        )}
        <div style={{ fontSize: 'var(--font-size-md)' }}>
          {phaseText[phase]}
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/common/UpdateModal.tsx
git commit -m "feat: add UpdateModal component with polling status feedback"
```

---

## Task 4: Component tests for UpdateModal

**Files:**
- Create: `tests/client/components/UpdateModal.test.tsx`

- [ ] **Step 1: Write tests for UpdateModal phases**

```tsx
// ABOUTME: Tests for UpdateModal component phase transitions
// ABOUTME: Verifies polling, success/failure/timeout detection, and cleanup

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UpdateModal } from '../../../client/src/components/common/UpdateModal';

// Mock the API client
vi.mock('../../../client/src/api/client', () => ({
  api: {
    update: {
      status: vi.fn(),
    },
  },
}));

import { api } from '../../../client/src/api/client';
const mockStatus = vi.mocked(api.update.status);

describe('UpdateModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockStatus.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders installing phase when open', () => {
    mockStatus.mockResolvedValue({ currentVersion: '0.3.5', updating: true, lastError: null });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);
    expect(screen.getByText('Updating to v0.3.9...')).toBeTruthy();
  });

  it('does not render when closed', () => {
    render(<UpdateModal isOpen={false} version="0.3.9" previousVersion="0.3.5" />);
    expect(screen.queryByText('System Update')).toBeNull();
  });

  it('transitions to success when version changes', async () => {
    mockStatus.mockResolvedValue({ currentVersion: '0.3.9', updating: false, lastError: null });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    // Advance past first poll interval
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Update complete! Reloading...')).toBeTruthy();
  });

  it('transitions to failed when lastError is set', async () => {
    mockStatus.mockResolvedValue({
      currentVersion: '0.3.5',
      updating: false,
      lastError: 'UPDATE FAILED: Download failed: 404',
    });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('UPDATE FAILED: Download failed: 404')).toBeTruthy();
  });

  it('transitions to restarting on fetch failure', async () => {
    mockStatus.mockRejectedValue(new Error('Connection refused'));
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Restarting server...')).toBeTruthy();
  });

  it('transitions to timeout after 3 minutes', async () => {
    mockStatus.mockResolvedValue({ currentVersion: '0.3.5', updating: true, lastError: null });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    await act(async () => {
      vi.advanceTimersByTime(3 * 60 * 1000);
    });

    expect(screen.getByText(/Update may have failed/)).toBeTruthy();
  });

  it('stops polling after success', async () => {
    mockStatus.mockResolvedValue({ currentVersion: '0.3.9', updating: false, lastError: null });
    render(<UpdateModal isOpen={true} version="0.3.9" previousVersion="0.3.5" />);

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    mockStatus.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    // No additional calls after success
    expect(mockStatus).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/client/components/UpdateModal.test.tsx`
Expected: FAIL — component doesn't exist yet (or if Task 3 already ran, tests should pass)

Note: If Task 3 has already been completed, these tests should pass immediately. Run them to verify.

- [ ] **Step 3: Run tests to verify they pass (after Task 3 component is created)**

Run: `npx vitest run tests/client/components/UpdateModal.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add tests/client/components/UpdateModal.test.tsx
git commit -m "test: add component tests for UpdateModal phase transitions"
```

---

## Task 5: Integrate UpdateModal into Dashboard and Settings

**Files:**
- Modify: `client/src/components/dashboard/Dashboard.tsx`
- Modify: `client/src/components/settings/SettingsPage.tsx`

- [ ] **Step 1: Refactor Dashboard to use UpdateModal**

In `Dashboard.tsx`:

1. Add import: `import { UpdateModal } from '../common/UpdateModal';`
2. Keep `installing` state (line 278) — it now controls the `UpdateModal` open state instead of the inline banner
3. Replace `handleInstallUpdate` (lines 371-387):

```typescript
async function handleInstallUpdate() {
  setConfirmUpdate(false);
  setInstalling(true);
  try {
    await api.update.install();
  } catch {
    setInstalling(false);
  }
}
```

4. Replace the installing banner (lines 494-498):

Remove:
```tsx
{installing && (
  <div style={updatingBannerStyle}>
    Updating... please wait. The page will refresh automatically.
  </div>
)}
```

5. Replace the confirm Modal (lines 810-818) with:

```tsx
{/* Install Update Confirmation */}
<Modal isOpen={confirmUpdate} onClose={() => setConfirmUpdate(false)} title="Confirm Action">
  <p style={{ color: 'var(--text-primary)', margin: 0 }}>
    Install update and restart the system? The app will reload.
  </p>
  <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
    <Button variant="secondary" onClick={() => setConfirmUpdate(false)}>Cancel</Button>
    <Button variant="danger" onClick={handleInstallUpdate}>Install Update</Button>
  </div>
</Modal>

<UpdateModal
  isOpen={installing}
  version={updateStatus?.availableUpdate?.version ?? ''}
  previousVersion={updateStatus?.currentVersion ?? ''}
/>
```

6. Remove `updatingBannerStyle` if it exists and is no longer used.

- [ ] **Step 2: Refactor Settings to use UpdateModal**

In `SettingsPage.tsx`:

1. Add import: `import { UpdateModal } from '../common/UpdateModal';`
2. Replace `handleInstallUpdate` (lines 459-479):

```typescript
async function handleInstallUpdate() {
  setConfirmUpdate(false);
  setInstallingUpdate(true);
  try {
    await api.update.install();
  } catch {
    setInstallingUpdate(false);
  }
}
```

3. Replace the confirm Modal (lines 1069-1077) with:

```tsx
<Modal isOpen={confirmUpdate} onClose={() => setConfirmUpdate(false)} title="Confirm Action">
  <p style={{ color: 'var(--text-primary)', margin: 0 }}>
    Install update and restart the system? The app will reload.
  </p>
  <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
    <Button variant="secondary" onClick={() => setConfirmUpdate(false)}>Cancel</Button>
    <Button variant="danger" onClick={handleInstallUpdate}>Install Update</Button>
  </div>
</Modal>

<UpdateModal
  isOpen={installingUpdate}
  version={updateStatus?.availableUpdate?.version ?? ''}
  previousVersion={updateStatus?.currentVersion ?? ''}
/>
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add client/src/components/dashboard/Dashboard.tsx client/src/components/settings/SettingsPage.tsx
git commit -m "feat: replace inline update polling with UpdateModal in Dashboard and Settings"
```

---

## Task 6: Version bump and final verification

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version in package.json**

Change `"version"` from `"0.3.8"` to `"0.3.9"`.

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Build to verify production output**

Run: `npm run build`
Expected: Clean build with no errors

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: bump version to v0.3.9"
```
