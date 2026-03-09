<!-- ABOUTME: Main project README for reRun video rental POS system -->
<!-- ABOUTME: Overview, features, quick start, tech stack, and contribution links -->

# reRun

A retro CRT-styled point-of-sale system for independent video rental stores.

<!-- TODO: Add screenshot -->

## Features

- Checkout & returns with barcode or manual lookup
- Customer management with family member tracking
- Inventory management with TMDb integration for movie metadata
- Age restriction enforcement for rated content
- Lightspeed POS reference codes for reconciliation
- Automatic updates from GitHub releases
- Daily database backups with restore
- CRT green phosphor aesthetic

## Tech Stack

- **Server**: Hono
- **Client**: React 19, React Router v7
- **Database**: SQLite (better-sqlite3) with Drizzle ORM
- **Build**: Vite

## Quick Start

See [INSTALL.md](INSTALL.md) for full setup instructions. The application runs on port **1987**.

## Development

```bash
git clone https://github.com/nervous-net/reRun.git
cd reRun
npm install
npm run dev
```

Run tests:

```bash
npm run test:run
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, coding conventions, and how to submit pull requests.

## License

This project is licensed under the GPL-3.0-or-later — see [COPYING](COPYING) for details.
