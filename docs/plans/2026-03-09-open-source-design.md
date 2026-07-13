# Open Source Release Design

## Date: 2026-03-09

## Goal

Open-source reRun under GPL-3.0 with active contributor welcome, and fix the broken update checker button.

## Decisions

- **License:** GPL-3.0-or-later — modifications must stay open
- **Contribution model:** Actively welcoming contributors (detailed CONTRIBUTING.md, issue guidelines)
- **README scope:** Clean and minimal — description, features, quick start, tech stack, links. Evolve later.
- **package.json `private`:** Keep `true` — this is an app, not an npm package

## Deliverables

### 1. LICENSE (COPYING)

Standard GPL-3.0 full text. Use `COPYING` filename (GPL convention).

### 2. README.md

- One-liner description
- Feature bullets (checkout, returns, customers, inventory, auto-updates)
- Tech stack (Hono, React 19, SQLite/Drizzle, Vite)
- Quick start → link to INSTALL.md
- Screenshot placeholder
- Contributing link
- License section

### 3. CONTRIBUTING.md

- Prerequisites (Node.js, npm)
- Dev setup (clone, npm install, npm run dev)
- Project structure overview
- Testing requirements (TDD, npm test, must pass)
- Code conventions (ABOUTME comments, no --no-verify, match surrounding style)
- PR process (fork, branch, test, PR)
- Issue guidelines

### 4. CODE_OF_CONDUCT.md

Contributor Covenant v2.1.

### 5. package.json updates

- `"license": "GPL-3.0-or-later"`
- `"author": "Dylan Reed"`
- `"repository": { "type": "git", "url": "https://github.com/nervous-net/reRun.git" }`

### 6. Bug fix: Update checker "Check for Updates" button

**Problem:** Button calls `GET /api/update/status` which only returns cached data. If the initial startup check failed (e.g., repo was private), button does nothing.

**Fix:**
- Add `forceCheck()` to `server/services/update.ts` — calls `checkForUpdates()` and updates cache
- Add `POST /api/update/check` endpoint that triggers force check and returns fresh status
- Wire client button (`handleCheckUpdate`) to call new endpoint
- Keep existing background 6-hour polling unchanged
