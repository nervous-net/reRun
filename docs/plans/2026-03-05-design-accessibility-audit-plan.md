# Design & Accessibility Audit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all accessibility gaps, visual inconsistencies, theme contrast failures, and missing confirmations across the entire reRun Video frontend to achieve WCAG AA compliance and visual polish.

**Architecture:** Bottom-up approach: build a foundation layer (global CSS, shared hooks, component fixes) then apply those patterns across all feature components. Each task is independent after the foundation is laid.

**Tech Stack:** React 19, CSS custom properties, inline CSSProperties, Vitest for testing

**Key Files Reference:**
- CSS: `client/src/styles/variables.css`, `global.css`, `crt.css`, `themes.css`
- Shared components: `client/src/components/common/` (Button, Input, Select, Table, Modal, Alert, Badge, Layout, LoadingScreen, AsciiArt)
- CRT effects: `client/src/components/crt/` (CRTScreen, GlowText, Scanlines)
- Feature screens: `client/src/components/pos/`, `customers/`, `inventory/`, `rentals/`, `dashboard/`, `settings/`, `import/`

---

## Task 1: Global Focus-Visible CSS & Reduced Motion

**Files:**
- Modify: `client/src/styles/global.css`
- Modify: `client/src/styles/crt.css`
- Modify: `client/src/styles/variables.css`

**Why:** Every interactive component lacks visible focus indicators for keyboard users. The flicker animation runs at 6.67Hz (above WCAG's 3Hz seizure threshold). No `prefers-reduced-motion` protection exists.

**Step 1: Add focus-visible variables to variables.css**

Add after the `--glow-amber` line (~line 96):

```css
/* Focus indicators */
--focus-outline: 2px solid var(--crt-green);
--focus-outline-offset: 2px;
--focus-glow: 0 0 8px var(--accent-30), 0 0 16px var(--accent-10);

/* Missing glow variants */
--glow-red: 0 0 8px var(--error-30), 0 0 16px var(--error-10);
--glow-cyan: 0 0 8px rgba(85, 255, 255, 0.3), 0 0 16px rgba(85, 255, 255, 0.1);
```

**Step 2: Add global focus-visible styles to global.css**

Add after the scrollbar section (~line 59):

```css
/* Global focus indicators for keyboard navigation */
button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible,
[tabindex="0"]:focus-visible,
[role="button"]:focus-visible,
[role="checkbox"]:focus-visible,
[role="option"]:focus-visible {
  outline: var(--focus-outline);
  outline-offset: var(--focus-outline-offset);
  box-shadow: var(--focus-glow);
}

/* Remove default outline for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}
```

**Step 3: Add prefers-reduced-motion to crt.css**

Add at the end of crt.css:

```css
/* Accessibility: respect reduced motion preferences */
@media (prefers-reduced-motion: reduce) {
  .crt-flicker {
    animation: none;
  }
  .type-in {
    animation: none;
    width: 100%;
  }
  .crt-screen::before {
    /* Keep scanlines but disable any animation */
    animation: none;
  }
}
```

Also slow down the flicker animation to be safe. Change `.crt-flicker` from `0.15s` to `0.5s` (2Hz, under the 3Hz threshold):

```css
.crt-flicker {
  animation: flicker 0.5s infinite;
}
```

**Step 4: Verify changes don't break existing styles**

Run: `cd /Users/nervous/Dev/CRTvideo && npm run build`
Expected: Clean build, no errors.

**Step 5: Commit**

```
feat: add global focus-visible indicators and reduced-motion support
```

---

## Task 2: Fix Theme E Contrast + Add Missing Theme Variables

**Files:**
- Modify: `client/src/styles/themes.css` (lines 113-135 for Theme E)

**Why:** Theme E (Classic POS Terminal) has black text (#000000) on grey background (#555555) = 3.2:1 contrast ratio. WCAG AA requires 4.5:1. It also doesn't override `--text-error`, `--crt-red`, or `--crt-cyan`, causing bright CGA fallbacks on grey backgrounds.

**Step 1: Rewrite Theme E with accessible contrast**

Replace the `.theme-e` block (lines ~113-135) with a corrected palette. Keep the "Classic POS Terminal" aesthetic (light background, dark text) but fix contrast:

```css
/* Theme E: Classic POS Terminal — light background, dark text, retail feel */
.theme-e {
  --bg-primary: #c0c0c0;      /* Silver frame */
  --bg-secondary: #e0e0e0;    /* Light grey panels */
  --bg-panel: #d4d4d4;        /* Mid-grey panels */
  --bg-input: #ffffff;         /* White inputs */
  --crt-green: #006600;        /* Dark green — 5.1:1 on #d4d4d4 */
  --crt-green-dim: #004400;    /* Darker green */
  --crt-green-bright: #008800; /* Medium green */
  --crt-amber: #7a5c00;       /* Dark amber — 5.2:1 on #d4d4d4 */
  --crt-amber-dim: #5a4400;   /* Darker amber */
  --crt-red: #990000;          /* Dark red — 5.8:1 on #d4d4d4 */
  --crt-cyan: #006666;         /* Dark cyan — 5.0:1 on #d4d4d4 */
  --text-primary: #1a1a1a;    /* Near-black — 11.3:1 on #d4d4d4 */
  --text-secondary: #333333;  /* Dark grey — 7.5:1 on #d4d4d4 */
  --text-muted: #555555;      /* Medium grey — 4.6:1 on #d4d4d4 */
  --text-error: #990000;      /* Dark red */
  --text-warning: #7a5c00;    /* Dark amber */
  --border-color: #888888;    /* Medium grey border */
  --glow-green: none;          /* No glow on light backgrounds */
  --glow-amber: none;          /* No glow on light backgrounds */
  --accent-02: rgba(0, 102, 0, 0.04);
  --accent-06: rgba(0, 102, 0, 0.08);
  --accent-10: rgba(0, 102, 0, 0.12);
  --accent-15: rgba(0, 102, 0, 0.18);
  --accent-30: rgba(0, 102, 0, 0.25);
  --accent-50: rgba(0, 102, 0, 0.40);
  --error-05: rgba(153, 0, 0, 0.05);
  --error-10: rgba(153, 0, 0, 0.10);
  --error-30: rgba(153, 0, 0, 0.30);
  --error-50: rgba(153, 0, 0, 0.50);
  --warning-08: rgba(122, 92, 0, 0.08);
  --overlay-50: rgba(0, 0, 0, 0.50);
  --overlay-60: rgba(0, 0, 0, 0.60);
  --overlay-80: rgba(0, 0, 0, 0.80);
  /* Focus indicators need different color on light bg */
  --focus-outline: 2px solid #006600;
  --focus-glow: 0 0 6px rgba(0, 102, 0, 0.4);
}
```

**Step 2: Add missing `--text-error`, `--text-warning`, `--crt-red`, `--crt-cyan` overrides to all other themes**

For themes A-D and F, verify these variables exist. If they don't, add them so they're explicit rather than falling back to `:root`. Check each theme block and add where missing:

- Theme A: `--crt-red: #FF5555; --crt-cyan: #55FFFF; --text-error: #FF5555; --text-warning: #FFFF55;`
- Theme B: same bright values
- Theme C: same bright values
- Theme D: `--crt-red: #FF5555; --crt-cyan: #55FFFF; --text-error: #FF5555; --text-warning: #FFFF55;`
- Theme F: same bright values

These should be on dark backgrounds so contrast is fine.

**Step 3: Build and verify**

Run: `npm run build`
Expected: Clean build.

**Step 4: Commit**

```
fix: rewrite Theme E for WCAG AA contrast compliance
```

---

## Task 3: Fix Input and Select Label Association

**Files:**
- Modify: `client/src/components/common/Input.tsx`
- Modify: `client/src/components/common/Select.tsx`

**Why:** Both components render `<label>` as visual text without `htmlFor` association. Screen readers can't connect labels to their fields.

**Step 1: Fix Input.tsx label association**

The component needs to generate a stable ID and connect `<label htmlFor>` to `<input id>`. Modify Input.tsx:

- Add `import { useId } from 'react';` at top
- In the component body, add: `const autoId = useId();` and `const inputId = rest.id || autoId;`
- Change `<label>` to `<label htmlFor={inputId}>`
- Change `<input>` to include `id={inputId}`
- If no `label` prop, add `aria-label` from placeholder as fallback

**Step 2: Fix Select.tsx label association**

Same pattern as Input:

- Add `import { useId } from 'react';`
- Generate `autoId` and `selectId`
- Connect `<label htmlFor={selectId}>` to `<select id={selectId}>`

**Step 3: Build and verify**

Run: `npm run build`

**Step 4: Commit**

```
fix: connect label elements to inputs/selects via htmlFor
```

---

## Task 4: Fix Table Component Keyboard + ARIA

**Files:**
- Modify: `client/src/components/common/Table.tsx`

**Why:** Clickable table rows (`onRowClick`) have no keyboard support. No `role`, `tabIndex`, or `onKeyDown`. Rows also lack `scope` on headers.

**Step 1: Add keyboard support to clickable rows**

When `onRowClick` is provided:
- Add `tabIndex={0}` to `<tr>`
- Add `onKeyDown` handler: Enter/Space triggers `onRowClick`
- Add `role="button"` to each clickable `<tr>`
- Add `style={{ cursor: 'pointer' }}` (already present)
- Add `onFocus`/`onBlur` handlers that mirror the hover effect (green background)

**Step 2: Add scope to table headers**

Add `scope="col"` to all `<th>` elements.

**Step 3: Add caption support**

Add optional `caption?: string` prop. If provided, render `<caption className="sr-only">{caption}</caption>` above `<thead>`.

Add a `.sr-only` utility class to global.css:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

**Step 4: Build and verify**

**Step 5: Commit**

```
feat: add keyboard navigation and ARIA to Table component
```

---

## Task 5: Fix Modal Focus Trap and Restoration

**Files:**
- Modify: `client/src/components/common/Modal.tsx`

**Why:** When modals open, focus stays wherever it was. Tab key can escape the modal. Focus doesn't return to trigger element on close.

**Step 1: Add focus trap**

Inside Modal.tsx, after the existing `handleKeyDown` for Escape:

- On mount (when `isOpen` becomes true): save `document.activeElement` as `previousFocus`
- Focus the first focusable element inside the modal panel (or the panel itself with `tabIndex={-1}`)
- Add Tab key handling in `handleKeyDown`: when Tab is pressed, cycle focus within the modal's focusable elements
- On unmount (when `isOpen` becomes false): restore focus to `previousFocus`

Implementation approach — add a `useEffect` that:
1. Queries all focusable elements inside the panel ref
2. On Tab: if focus is on last element, move to first. On Shift+Tab: if focus is on first element, move to last.
3. On close: `previousFocusRef.current?.focus()`

**Step 2: Add aria-labelledby**

If `title` prop is provided:
- Generate an ID for the title element: `const titleId = useId();`
- Add `aria-labelledby={titleId}` to the dialog div
- Add `id={titleId}` to the `<h2>` title element

**Step 3: Build and verify**

**Step 4: Commit**

```
feat: add focus trap and focus restoration to Modal
```

---

## Task 6: Fix Button Hover/Focus Parity + Hardcoded Colors

**Files:**
- Modify: `client/src/components/common/Button.tsx`

**Why:** Hover effects use inline `onMouseEnter`/`onMouseLeave` DOM mutation but no matching `onFocus`/`onBlur`. Danger variant hardcodes `#ff5555` instead of using CSS variable. The global `:focus-visible` from Task 1 provides an outline, but buttons should also get the glow effect on focus (matching hover).

**Step 1: Add onFocus/onBlur handlers**

Mirror the existing hover handlers for focus:
- `onFocus`: Apply same glow/border effects as `onMouseEnter`
- `onBlur`: Apply same reset as `onMouseLeave`

**Step 2: Replace hardcoded danger color**

Change `#ff5555` (line ~72-73) to `var(--crt-red)`.

**Step 3: Use `--glow-red` variable for danger hover**

Replace inline `'0 0 10px var(--error-30)'` with `var(--glow-red)` (defined in Task 1).

**Step 4: Build and verify**

**Step 5: Commit**

```
fix: add focus styles to Button, replace hardcoded colors with variables
```

---

## Task 7: Fix All Clickable Divs — Keyboard + ARIA

This is the largest task. Every clickable `<div>` needs keyboard support.

**Files:**
- Modify: `client/src/components/inventory/TitleCard.tsx` (line ~111-116)
- Modify: `client/src/components/inventory/InventoryBrowser.tsx` (line ~408-416, custom checkbox)
- Modify: `client/src/components/inventory/TitleForm.tsx` (lines ~267-290, TMDb dropdown)
- Modify: `client/src/components/customers/CustomerSearch.tsx` (lines ~101-140, result rows)
- Modify: `client/src/components/pos/CustomerBar.tsx` (lines ~154-173, dropdown items)
- Modify: `client/src/components/import/MatchReview.tsx` (lines ~217-244, TMDb results; line ~258, table rows)

**Pattern to apply everywhere:**

For **clickable divs** (TitleCard, CustomerSearch rows, MatchReview rows):
```tsx
<div
  role="button"
  tabIndex={0}
  onClick={handler}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } }}
  onFocus={(e) => { /* apply same style as onMouseEnter */ }}
  onBlur={(e) => { /* apply same style as onMouseLeave */ }}
>
```

For **custom checkbox** (InventoryBrowser "In stock only"):
- Already has `role="checkbox"` and `aria-checked` — just add `tabIndex={0}` and `onKeyDown` for Space to toggle.

For **dropdown lists** (CustomerBar, TitleForm TMDb):
- Wrap list in `role="listbox"`
- Each item gets `role="option"`, `tabIndex={-1}` (managed focus), `aria-selected`
- Add `onKeyDown` on the container: ArrowDown/ArrowUp to move focus, Enter to select, Escape to close
- Track focused index with state
- Add `aria-expanded` on the triggering input

**Step 1: Fix TitleCard clickable div**

Add `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space, `onFocus`/`onBlur` to mirror hover.

**Step 2: Fix InventoryBrowser custom checkbox**

Add `tabIndex={0}` and `onKeyDown` handler for Space key.

**Step 3: Fix TitleForm TMDb dropdown**

Convert to `role="listbox"` with `role="option"` items. Add arrow key navigation and Enter to select.

**Step 4: Fix CustomerSearch result rows**

Add `role="button"`, `tabIndex={0}`, `onKeyDown`, `onFocus`/`onBlur`.

**Step 5: Fix CustomerBar dropdown items**

Convert to `role="listbox"` / `role="option"` with arrow key navigation.

**Step 6: Fix MatchReview TMDb results and table rows**

Add `role="button"`, `tabIndex={0}`, keyboard handlers.

**Step 7: Build and verify**

**Step 8: Commit**

```
feat: add keyboard navigation to all interactive elements
```

---

## Task 8: Fix Overlay Keyboard Dismiss + ARIA in POSScreen

**Files:**
- Modify: `client/src/components/pos/POSScreen.tsx`

**Why:** POSScreen has 5 custom overlays (pricing rules, family picker, search results, confirmation, reference code) that don't handle Escape key or have proper ARIA. Only the ones using `<Modal>` get Escape support.

**Step 1: Add Escape key handlers to custom overlays**

For each overlay that doesn't use `<Modal>`:
- Pricing Rule Picker (~line 553): Add `onKeyDown` on the overlay div that calls `setPendingScan(null)` on Escape
- Family Member Picker (~line 580): Add Escape to close
- Search Results (~line 593): Add Escape to dismiss

Pattern:
```tsx
<div
  style={styles.pricingOverlay}
  onClick={() => setPendingScan(null)}
  onKeyDown={(e) => { if (e.key === 'Escape') setPendingScan(null); }}
  role="dialog"
  aria-modal="true"
  aria-label="Select pricing rule"
>
```

**Step 2: Add role="dialog" and aria-modal to overlays**

Add to each overlay wrapper:
- `role="dialog"`
- `aria-modal="true"`
- `aria-label` describing the overlay purpose

**Step 3: Add aria-label to scan input**

Line ~466-479: Add `aria-label="Barcode scan input"` to the raw `<input>` element.

**Step 4: Build and verify**

**Step 5: Commit**

```
feat: add keyboard dismiss and ARIA to POS overlays
```

---

## Task 9: Add Confirmation Dialogs for Destructive Actions

**Files:**
- Modify: `client/src/components/pos/POSScreen.tsx` (Clear All, Void Last)
- Modify: `client/src/components/pos/TransactionPanel.tsx` (Remove item — add aria-label)
- Modify: `client/src/components/rentals/ReturnScreen.tsx` (Clear Queue, Process All Returns)
- Modify: `client/src/components/rentals/ReservationList.tsx` (Cancel Reservation)
- Modify: `client/src/components/dashboard/Dashboard.tsx` (Install Update)
- Modify: `client/src/components/settings/SettingsPage.tsx` (Install Update — replace window.confirm with Modal)
- Modify: `client/src/components/settings/PricingRulesManager.tsx` (Deactivate)
- Modify: `client/src/components/settings/PromotionsManager.tsx` (Deactivate)
- Modify: `client/src/components/import/ImportProgress.tsx` (Start Over)

**Pattern:** Use the existing `<Modal>` component with a confirmation message and Cancel/Confirm buttons. Add state like `showConfirmClear` to toggle the modal.

**For each destructive action:**
1. Add state: `const [showConfirmX, setShowConfirmX] = useState(false);`
2. Change the button's onClick to open the modal: `onClick={() => setShowConfirmX(true)}`
3. Render a confirmation Modal:
```tsx
<Modal isOpen={showConfirmX} onClose={() => setShowConfirmX(false)} title="Confirm Action">
  <p style={{ color: 'var(--text-primary)' }}>Are you sure you want to [action]? This cannot be undone.</p>
  <div style={{ display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}>
    <Button variant="secondary" onClick={() => setShowConfirmX(false)}>Cancel</Button>
    <Button variant="danger" onClick={() => { actualAction(); setShowConfirmX(false); }}>Confirm</Button>
  </div>
</Modal>
```

**Specific actions to wrap:**
- POSScreen "Clear All" — "Clear the entire transaction?"
- POSScreen "Void Last Item" — skip confirmation (too frequent, reversible by re-scanning)
- ReturnScreen "Clear Queue" — "Clear all items from the return queue?"
- ReturnScreen "Process All Returns" — "Process all N returns? This will finalize them."
- ReservationList "Cancel" — "Cancel this reservation? This cannot be undone."
- Dashboard "Install Update" — "Install update and restart the system?"
- SettingsPage "Install Update" — same as Dashboard
- SettingsPage "Restore Backup" — replace `window.confirm()` with styled Modal
- PricingRulesManager "Deactivate" — "Deactivate this pricing rule?"
- PromotionsManager "Deactivate" — "Deactivate this promotion?"
- ImportProgress "Start Over" — "Start the import over? Current progress will be lost."

**Also:** Add `aria-label="Remove item"` to the "X" buttons in TransactionPanel and ReturnScreen.

**Step 1-9:** Add confirmation modals to each file listed above
**Step 10:** Build and verify
**Step 11:** Commit

```
feat: add confirmation dialogs for destructive actions
```

---

## Task 10: Fix Layout Navigation Accessibility

**Files:**
- Modify: `client/src/components/common/Layout.tsx`

**Why:** Active nav link has no `aria-current="page"`. Status bar lacks `role="status"`. No skip-to-content link.

**Step 1: Add aria-current to active nav link**

In the nav link rendering (around line ~107), add `aria-current={isActive ? 'page' : undefined}` to each `<Link>`.

**Step 2: Add role="status" to status bar**

Around line ~130, add `role="status"` and `aria-live="polite"` to the status bar div.

**Step 3: Add skip-to-content link**

As the first child inside the layout wrapper, add:

```tsx
<a href="#main-content" className="sr-only" style={{ position: 'absolute', top: '-9999px' }}
  onFocus={(e) => { e.currentTarget.style.top = '0'; e.currentTarget.style.zIndex = '9999'; }}
  onBlur={(e) => { e.currentTarget.style.top = '-9999px'; }}
>
  Skip to content
</a>
```

And add `id="main-content"` to the main content area div.

**Step 4: Build and verify**

**Step 5: Commit**

```
feat: add skip-to-content link and ARIA landmarks to Layout
```

---

## Task 11: Visual Polish — Glow Consistency

**Files:**
- Modify: `client/src/components/pos/CustomerBar.tsx` (dropdown items)
- Modify: `client/src/components/pos/HeldTransactions.tsx` (list items)
- Modify: `client/src/components/pos/FamilyMemberPicker.tsx` (buttons)
- Modify: `client/src/components/pos/TransactionPanel.tsx` (empty state)
- Modify: `client/src/components/pos/ReferenceCodeScreen.tsx` (font family)
- Modify: `client/src/components/pos/ConfirmationModal.tsx` (font family)
- Modify: `client/src/components/inventory/TitleCard.tsx` (placeholder glow, border)
- Modify: `client/src/components/customers/CustomerSearch.tsx` (results header color)
- Modify: `client/src/components/dashboard/Dashboard.tsx` (link focus/hover parity)

**Step 1: Fix hardcoded fontFamily references**

In ReferenceCodeScreen.tsx (~line 60) and ConfirmationModal.tsx (~lines 88, 106):
Replace `fontFamily: "'Courier New', monospace"` and `fontFamily: 'monospace'` with `fontFamily: 'var(--font-mono)'`.

**Step 2: Add glow to dropdown items**

In CustomerBar.tsx dropdown items (~line 159-164): Add `textShadow: 'var(--glow-green)'` to hovered items.
In HeldTransactions.tsx list items: Add subtle glow on hover.

**Step 3: Fix TitleCard placeholder**

Add `textShadow: 'var(--glow-green)'` to the placeholder style in TitleCard.tsx.
Change default border from `var(--crt-green-dim)` to `var(--border-color)` for consistency.

**Step 4: Fix CustomerSearch results header**

Change `borderBottom` from `var(--crt-green-dim)` to `var(--crt-green)` to match other section headers.

**Step 5: Add focus/hover parity to Dashboard links**

In Dashboard.tsx (~lines 442-475): Add `onFocus`/`onBlur` handlers that mirror the `onMouseEnter`/`onMouseLeave` background effects.

**Step 6: Improve empty states**

In TransactionPanel.tsx empty state (~line 131-135) and HeldTransactions.tsx empty state (~line 96-100):
Add `color: 'var(--text-muted)'` and a subtle border or background tint to distinguish from content.

**Step 7: Replace hardcoded spacing with variables**

Search for `gap: '4px'` across components and replace with `gap: 'var(--space-xs)'`. Files include:
- TitleCard.tsx badge row
- InventoryBrowser.tsx format badges
- Various inline flex containers

**Step 8: Build and verify**

**Step 9: Commit**

```
fix: visual polish — consistent glows, fonts, spacing, and empty states
```

---

## Task 12: Remaining ARIA and Form Accessibility

**Files:**
- Modify: `client/src/components/pos/FamilyMemberPicker.tsx` (button labels)
- Modify: `client/src/components/pos/TransactionPanel.tsx` (type icon labels)
- Modify: `client/src/components/inventory/TitleDetail.tsx` (add-copies form labels, close button focus)
- Modify: `client/src/components/rentals/ReturnScreen.tsx` (barcode input label, late fee dropdown label)
- Modify: `client/src/components/settings/SettingsPage.tsx` (API key label, show/hide button label)
- Modify: `client/src/components/import/FileUpload.tsx` (drop zone aria-label, error role)
- Modify: `client/src/components/import/ImportProgress.tsx` (progress bar role)
- Modify: `client/src/components/import/ImportWizard.tsx` (step indicator labels)
- Modify: `client/src/components/common/LoadingScreen.tsx` (prefers-reduced-motion)
- Modify: `client/src/components/common/AsciiArt.tsx` (role="img", aria-label)
- Modify: `client/src/components/customers/CustomerCard.tsx` (balance text backup)

**Step 1: Add aria-labels to unlabeled inputs**

- ReturnScreen barcode input: Add `aria-label="Scan copy barcode to return"`
- TitleDetail add-copies select: Add `aria-label="Copy format"`
- TitleDetail add-copies input: Add `aria-label="Number of copies"`
- SettingsPage API key label: Connect via `htmlFor` to input

**Step 2: Add aria-labels to icon-only buttons**

- SettingsPage show/hide toggle: `aria-label="Toggle API key visibility"`
- TransactionPanel type icons: Wrap `[R]`/`[P]`/`[F]` in `<span aria-label="Rental">`/etc.

**Step 3: Add progress bar ARIA**

ImportProgress.tsx progress bar: Add `role="progressbar"`, `aria-valuenow={percent}`, `aria-valuemin={0}`, `aria-valuemax={100}`, `aria-label="Import progress"`.

**Step 4: Add step indicator ARIA**

ImportWizard.tsx step circles: Add `aria-current="step"` on the active step, `aria-label="Step N: Name"`.

**Step 5: Fix FileUpload accessibility**

- Add `aria-label="Upload CSV file — drag and drop or click to browse"` to drop zone
- Wrap error message in `<div role="alert">`

**Step 6: Fix AsciiArt and LoadingScreen**

- AsciiArt: Add `role="img"` and `aria-label="reRun Video logo"` to the `<pre>` element
- LoadingScreen: Add `aria-live="polite"` to the boot sequence container

**Step 7: Add balance text indicator**

CustomerCard.tsx balance display: Add "(credit)" or "(owed)" text next to the amount so color-blind users can distinguish:
```tsx
{formatBalance(customer.balance)}
{customer.balance < 0 ? ' owed' : customer.balance > 0 ? ' credit' : ''}
```

**Step 8: Add focus styles to TitleDetail close button**

Add `onFocus`/`onBlur` handlers that mirror the existing `onMouseEnter`/`onMouseLeave` color changes.

**Step 9: Build and verify**

**Step 10: Commit**

```
feat: add ARIA labels, roles, and form accessibility across all components
```

---

## Task 13: Readability Check — All Themes

**Files:**
- Modify: `client/src/styles/themes.css` (if any theme needs fixes beyond Theme E)

**Why:** User specifically asked to check themes for readability.

**Step 1: Verify contrast ratios for each theme**

Check these critical combinations for each theme:

| Combination | Minimum Ratio |
|---|---|
| `--text-primary` on `--bg-primary` | 4.5:1 |
| `--text-primary` on `--bg-panel` | 4.5:1 |
| `--text-secondary` on `--bg-panel` | 4.5:1 |
| `--crt-green` on `--bg-primary` | 4.5:1 |
| `--crt-green` on `--bg-panel` | 4.5:1 |
| `--crt-amber` on `--bg-primary` | 4.5:1 |
| `--text-error` (fallback #FF5555) on `--bg-panel` | 4.5:1 |
| `--text-muted` on `--bg-panel` | 4.5:1 |

Use a contrast checker tool or calculate manually: https://www.w3.org/TR/WCAG20-TECHS/G17.html

Theme E was already fixed in Task 2. For other themes:

- **Theme A (Turbo Vision):** Cyan (#00AAAA) on blue (#0000AA) = ~3.1:1. May need brightening to #55FFFF (8.6:1).
- **Theme B (Norton Commander):** Check cyan on blue.
- **Theme C (WordPerfect):** White on blue — should pass easily.
- **Theme D (Lotus 1-2-3):** Green on black — should pass.
- **Theme F (Hybrid CRT):** White on grey/blue — should pass.

**Step 2: Fix any failing contrasts**

If Theme A's cyan accent fails, brighten it. If any `--text-muted` values fail on their theme's background, darken the text or lighten the background.

**Step 3: Build and verify**

**Step 4: Commit**

```
fix: ensure all themes meet WCAG AA contrast requirements
```

---

## Task 14: Write Tests

**Files:**
- Create: `client/src/components/common/__tests__/Button.test.tsx`
- Create: `client/src/components/common/__tests__/Input.test.tsx`
- Create: `client/src/components/common/__tests__/Select.test.tsx`
- Create: `client/src/components/common/__tests__/Table.test.tsx`
- Create: `client/src/components/common/__tests__/Modal.test.tsx`

**Why:** No client-side component tests exist. Test the accessibility fixes.

**Test Pattern for Each Component:**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
```

**Button tests:**
- Renders with correct variant styles
- Calls onClick on click
- Calls onClick on Enter key
- Calls onClick on Space key
- Shows focus styles on focus (check boxShadow changes)
- Disabled button doesn't fire onClick
- Disabled button has reduced opacity

**Input tests:**
- Renders with label connected via htmlFor
- Label's htmlFor matches input's id
- Fires onChange when typed in
- Shows focus glow on focus

**Select tests:**
- Renders with label connected via htmlFor
- Renders all options
- Fires onChange on selection

**Table tests:**
- Renders headers with scope="col"
- Renders data rows
- Clickable rows have tabIndex={0} and role="button"
- Clickable rows fire onRowClick on Enter key
- Clickable rows fire onRowClick on Space key
- Shows empty message when data is empty

**Modal tests:**
- Renders children when isOpen is true
- Doesn't render when isOpen is false
- Has role="dialog" and aria-modal="true"
- Closes on Escape key
- Closes on overlay click
- Traps focus within modal
- Restores focus on close

**Step 1:** Install @testing-library/react and @testing-library/jest-dom if not already:
```
npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

**Step 2:** Configure vitest for jsdom environment. Check `vite.config.ts` for test config. Add if needed:
```ts
test: {
  environment: 'jsdom',
  setupFiles: ['./client/src/test-setup.ts'],
}
```

Create `client/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

**Step 3-7:** Write tests for each component listed above.

**Step 8:** Run all tests: `npm test`

**Step 9:** Commit

```
test: add accessibility tests for shared UI components
```

---

## Execution Order & Dependencies

```
Task 1 (Global CSS) ──┐
Task 2 (Theme E)  ────┤── Foundation (run first, in parallel)
Task 3 (Labels)   ────┤
Task 4 (Table)    ────┘
                       │
Task 5 (Modal focus) ──┤── Core components (depends on Task 1)
Task 6 (Button)   ─────┘
                       │
Task 7 (Clickable divs) ──── Feature fixes (depends on Tasks 1, 4)
Task 8 (POS overlays) ────── Feature fixes (depends on Task 5)
Task 9 (Confirmations) ───── Feature fixes (depends on Task 5)
Task 10 (Layout) ─────────── Feature fixes (depends on Task 1)
Task 11 (Visual polish) ──── Polish (depends on Task 1)
Task 12 (ARIA labels) ────── Polish (independent)
Task 13 (Theme readability) ─ Polish (depends on Task 2)
Task 14 (Tests) ──────────── Last (depends on all above)
```

**Parallel groups:**
- Group A (foundation): Tasks 1, 2, 3 (all independent)
- Group B (core components): Tasks 4, 5, 6 (depend on Task 1 but independent of each other)
- Group C (feature fixes): Tasks 7, 8, 9, 10 (depend on earlier tasks)
- Group D (polish): Tasks 11, 12, 13 (mostly independent)
- Group E (tests): Task 14 (last)
