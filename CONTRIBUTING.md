<!-- ABOUTME: Contributing guidelines for the reRun project -->
<!-- ABOUTME: Development setup, code conventions, testing, and PR process -->

# Contributing to reRun

Thanks for your interest in contributing to reRun! Here's how to get started.

## Prerequisites

- Node.js 22+
- npm

## Development Setup

```bash
git clone https://github.com/nervous-net/reRun.git
cd reRun
npm install
cp .env.example .env  # Edit with your TMDb API key (optional, for movie metadata)
npm run dev            # Opens at http://localhost:1987
```

## Project Structure

- `server/` — Hono API routes, services, database layer
- `client/` — React 19 SPA (Vite)
- `scripts/` — Install, update, and setup scripts
- `drizzle/` — Database migrations
- `data/` — SQLite database and backups (not committed)
- `tests/` — Vitest test suites

## Code Conventions

- Every file starts with a 2-line `// ABOUTME:` comment explaining what the file does
- Match the style of surrounding code — consistency within a file trumps style guides
- Never use `--no-verify` on git commits
- All monetary values stored in cents, tax in basis points
- Comments should be evergreen — describe what IS, not how it got there
- No "improved", "new", or "enhanced" in names — code naming should be timeless

## Testing

We practice TDD — write tests before implementation.

- Run tests: `npm run test:run` (single run) or `npm test` (watch mode)
- All tests must pass before submitting a PR
- Test setup uses in-memory SQLite via `createTestDb()` and `migrateTestDb()`
- Never use mocks for testing — use real data and real database instances

## Pull Request Process

1. Fork the repo and create a feature branch from `main`
2. Make your changes with tests
3. Run `npm run test:run` — all tests must pass
4. Submit a PR against `main`
5. Describe what your PR does and why

## Reporting Issues

Use GitHub Issues. Please include:

- Steps to reproduce the problem
- Expected behavior
- Actual behavior
- Your environment (OS, Node version)
