# Video Rental POS System — Design Document

**Date:** 2026-02-26
**Deadline:** 2026-03-14 (launch day)
**Status:** Draft
**Name:** reRun

---

## 1. Problem Statement

A brick-and-mortar video rental store is opening March 14, 2026. The off-the-shelf software they planned to use does not support bulk data import — meaning 1,700 titles would need to be entered by hand. We are building a full replacement system that solves the import problem and delivers a better overall experience than existing video rental software.

## 2. Solution Overview

A local-first web application that runs on a single machine. A lightweight TypeScript backend serves both the API and the React frontend. Data lives in SQLite. Movie metadata and cover art are enriched via the TMDb API during import. The UI embraces a retro CRT/VHS aesthetic.

### Key Differentiators vs. Existing Software
- **Bulk CSV import** with automatic TMDb enrichment (cover art, genre, cast, synopsis, ratings)
- **Modern web-based UI** with retro CRT aesthetic — runs in any browser, no Windows-only lock-in
- **Local-first architecture** — data stays on their machine, works offline, no subscription fees
- **Easy upgrade path** to multi-station via LAN when ready

## 3. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js | Stable, widely supported |
| Language | TypeScript | Type safety across the full stack |
| Backend | Hono or Express | Lightweight, fast, no framework overhead |
| Frontend | React | Component-based UI, large ecosystem |
| Database | SQLite (via better-sqlite3) | Zero config, single-file, perfect for local-first |
| ORM | Drizzle | Type-safe, lightweight, excellent SQLite support |
| Movie Data | TMDb API | Free, comprehensive metadata + cover art |
| Process Mgr | PM2 | Auto-start on boot, crash recovery |
| Build | Vite | Fast dev server, optimized production builds |

## 4. Architecture

```
┌─────────────────────────────────────────────┐
│                  Browser                     │
│  ┌─────────────────────────────────────────┐ │
│  │         React Frontend (Vite)           │ │
│  │  POS  │ Inventory │ Customers │ Search  │ │
│  └──────────────┬──────────────────────────┘ │
└─────────────────┼───────────────────────────┘
                  │ HTTP (localhost)
┌─────────────────┼───────────────────────────┐
│  Node.js Process│(single)                    │
│  ┌──────────────┴──────────────────────────┐ │
│  │     Hono/Express API Server             │ │
│  │  /api/rentals  /api/inventory           │ │
│  │  /api/customers  /api/transactions      │ │
│  │  /api/import  /api/search               │ │
│  └──────────────┬──────────────────────────┘ │
│  ┌──────────────┴──────────────────────────┐ │
│  │  SQLite (better-sqlite3) + Drizzle ORM  │ │
│  └──────────────┬──────────────────────────┘ │
│  ┌──────────────┴──────────────────────────┐ │
│  │  TMDb Client (enrichment on import)     │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
         │
         ▼
  rental-store.db (single SQLite file)
```

### Production Serving

In production, the backend serves the built React frontend as static files. One process, one port. In development, Vite's dev server proxies API calls to the backend.

### Future Multi-Station Path

When ready for multiple stations:
1. Bind server to `0.0.0.0` instead of `localhost`
2. Enable SQLite WAL mode for concurrent reads
3. Other machines on LAN open browser to server machine's IP
4. If concurrency becomes an issue, swap to PostgreSQL

## 5. Data Model

### Core Entities

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Customer   │     │      Rental      │     │      Title       │
├──────────────┤     ├──────────────────┤     ├──────────────────┤
│ id           │────<│ customer_id      │     │ id               │
│ first_name   │     │ copy_id         │>────│ tmdb_id          │
│ last_name    │     │ checked_out_at   │     │ name             │
│ email        │     │ due_at           │     │ year             │
│ phone        │     │ returned_at      │     │ genre            │
│ address      │     │ late_fee         │     │ runtime_minutes  │
│ birthday     │     │ status           │     │ synopsis         │
│ notes        │     │ employee_id      │     │ rating           │
│ balance      │     └──────────────────┘     │ cast             │
│ created_at   │                               │ cover_url        │
│ active       │     ┌──────────────────┐     │ format           │
└──────────────┘     │      Copy        │     └──────────────────┘
                     ├──────────────────┤              │
                     │ id               │              │
                     │ title_id        │>─────────────┘
                     │ barcode          │
                     │ format (VHS/DVD/ │
                     │   Blu-ray)       │
                     │ condition        │
                     │ status (in/out/  │
                     │   lost/retired)  │
                     └──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│   Transaction    │     │ TransactionItem  │
├──────────────────┤     ├──────────────────┤
│ id               │────<│ transaction_id   │
│ customer_id      │     │ type (rental/    │
│ employee_id      │     │   sale/return/   │
│ type (rental/    │     │   late_fee/void) │
│   sale/mixed)    │     │ copy_id          │
│ subtotal         │     │ product_id       │
│ tax              │     │ amount           │
│ total            │     │ tax              │
│ payment_method   │     └──────────────────┘
│ amount_tendered  │
│ change_given     │
│ voided           │
│ created_at       │
└──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│    Product       │     │   Reservation    │
├──────────────────┤     ├──────────────────┤
│ id               │     │ id               │
│ name             │     │ customer_id      │
│ sku              │     │ title_id         │
│ price            │     │ reserved_at      │
│ cost             │     │ expires_at       │
│ tax_rate         │     │ fulfilled        │
│ stock_qty        │     │ notified         │
│ reorder_level    │     └──────────────────┘
│ category         │
│ active           │     ┌──────────────────┐
└──────────────────┘     │  PricingRule     │
                         ├──────────────────┤
                         │ id               │
                         │ name             │
                         │ type (daily/     │
                         │  weekend/weekly/ │
                         │  subscription)   │
                         │ rate             │
                         │ duration_days    │
                         │ late_fee_per_day │
                         │ active           │
                         └──────────────────┘

┌──────────────────┐     ┌──────────────────┐
│    Promotion     │     │  PrepaidPlan     │
├──────────────────┤     ├──────────────────┤
│ id               │     │ id               │
│ name             │     │ name             │
│ type (multi_rent/│     │ price            │
│   discount/      │     │ credit_value     │
│   coupon)        │     │ rental_count     │
│ rules (JSON)     │     │ duration_days    │
│ start_date       │     │ active           │
│ end_date         │     └──────────────────┘
│ active           │
└──────────────────┘

┌──────────────────┐
│   AlertConfig    │
├──────────────────┤
│ id               │
│ type (overdue/   │
│  birthday/       │
│  card_expired)   │
│ template         │
│ enabled          │
└──────────────────┘
```

### Key Relationships

- A **Title** has many **Copies** (e.g., 3 copies of "The Matrix" on DVD)
- A **Copy** is what gets rented — it has a barcode and a status
- A **Rental** ties a Customer to a Copy with dates and fees
- A **Transaction** groups line items (rentals, product sales, late fees) into a single checkout
- **Products** are non-rental merchandise (candy, drinks, etc.)
- **PricingRules** define rate structures; assigned to titles or used as defaults
- **Promotions** handle multi-rental deals and coupons
- **PrepaidPlans** handle subscription/credit packages

## 6. Feature Breakdown by Tier

### Tier 1 — Must Have (Launch Blockers)

#### CSV Import + TMDb Enrichment
- Accept CSV in any reasonable format (auto-detect columns)
- Match titles against TMDb by name + year
- Pull in: cover art, genre, cast, runtime, synopsis, rating
- Review/confirm matches before committing
- Handle multi-copy entries (e.g., "The Matrix, DVD, qty: 3")
- Generate barcodes for copies if not provided

#### Core POS / Transaction Processing
- Rental checkout: scan/search copy → attach to customer → select pricing → process payment
- Returns: scan copy → auto-calculate late fees → process payment or add to balance
- Merchandise sales: add products to transaction alongside rentals
- Payment: cash (with change calculation), credit card (amount tracking — no payment gateway for MVP), gift certificates, house account/balance
- Tax calculation: configurable tax rate(s)
- Receipt printing: generate printable receipt (browser print dialog)
- Receipt emailing: send receipt to customer's email on file
- Void/refund transactions
- Hold/recall transactions mid-checkout

#### Inventory Management
- Full title catalog with TMDb metadata and cover art
- Multiple copies per title with individual tracking
- Copy status: in-stock, rented-out, lost, retired
- Barcode assignment per copy (support scanning and manual entry)
- NFC as alternative to barcode (if hardware supports it — same ID lookup flow)
- Stock level visibility per title
- Reorder alerts when available copies drop below threshold
- Add/edit/retire titles and copies

#### Customer Management
- Create/edit customer profiles (name, email, phone, address, birthday, notes)
- Customer search by name, phone, email, or member ID
- Full rental history per customer
- Account balance tracking (credits and debts)
- Membership card generation (with barcode or NFC ID)
- Family member linking (up to 2 additional members per account)

### Tier 2 — MVP (Should Have for Launch)

#### Rental Lifecycle
- Flexible due dates per rental (1-day, 3-day, 7-day, weekend, custom)
- Automatic late fee calculation on return
- Late fee options: pay now, add to balance, partial payment, forgive (tracked)
- Reservation system: reserve a title for a customer, notify when available
- "Previously rented" alert during checkout
- Prepaid rental plans: buy X rentals upfront at a discount

#### Search & Discovery
- Search titles by name, genre, year, actor, format, barcode
- Real-time availability (in-stock copy count)
- Filter/sort by genre, format, rating, availability

#### Promotions & Pricing
- Multiple pricing tiers (new release, catalog, bargain, etc.)
- Multi-rental deals ("3 for $10")
- Prepaid credit packages (pay $30, get $40 credit)
- Monthly subscription tracking (flat fee for unlimited/N rentals)

#### Alerts
- Overdue rental alerts (dashboard + email)
- Customer birthday alerts on checkout
- Expired credit card warnings
- Overdue email templates (configurable)

#### Data Management
- CSV/JSON export of all data
- Database backup to file (copy SQLite file)
- Database restore from backup

### Tier 3 — Post-Launch

- "Suggest a Movie" engine (preference-based recommendations)
- Public terminal / kiosk mode (browse-only for customers)
- Online reservations
- Buy-back (purchase items from customers)
- Graphical reporting and analytics
- Report export to PDF/HTML/RTF
- Employee accounts with role-based access control
- Multi-station support (LAN)
- Revenue reports (daily/weekly/monthly/yearly)
- Sales margin reports
- Predictive ordering

## 7. CSV Import Flow

The import system is the reason this project exists. It needs to handle whatever format the store owners provide.

```
CSV File
   │
   ▼
┌─────────────────────┐
│  Column Detection    │  ← Auto-detect: title, year, format, qty, barcode, genre
│  (show preview)      │     Let user map columns if auto-detect is wrong
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  TMDb Matching       │  ← Search by title + year
│  (batch process)     │     Handle: exact matches, multiple results, no results
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Review Screen       │  ← Show matched results with cover art
│                      │     Flag ambiguous/missing matches for manual review
│                      │     Allow corrections before commit
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Commit to Database  │  ← Create Title + Copy records
│  (with progress)     │     Generate barcodes if not provided
└─────────────────────┘
```

### Edge Cases
- **No TMDb match:** Allow manual entry, mark for later enrichment
- **Multiple TMDb matches:** Present options, let user pick
- **Duplicate titles:** Detect and offer to add copies to existing title
- **Multi-format:** Same movie on VHS and DVD = same Title, different Copies with different format tags

## 8. UI Design — Retro CRT Aesthetic

### Visual Language
- **Color palette:** Phosphor green (#33FF00) on dark backgrounds, amber (#FFB000) for warnings, scanline overlay
- **Typography:** Monospace primary (e.g., JetBrains Mono, IBM Plex Mono), pixel/bitmap for headers
- **Effects:** Subtle CRT scanline overlay, slight screen curvature via CSS, text glow, optional flicker
- **Layout:** Dense, information-rich — POS operators need data, not whitespace
- **Interactions:** Keyboard-first (POS clerks hate reaching for the mouse), with mouse/touch as fallback

### Key Screens

#### 1. Main POS Screen
- Customer info bar (top) — name, balance, alerts
- Transaction area (center) — line items, running total
- Quick actions (right) — checkout, return, search, hold
- Barcode scan input always focused and ready

#### 2. Inventory Browser
- Grid/list view of titles with cover art thumbnails
- Filters sidebar: genre, format, availability, rating
- Click-through to title detail with copy status

#### 3. Customer Lookup
- Search bar (name/phone/ID)
- Customer card with rental history, balance, alerts
- Quick-rent from customer screen

#### 4. Import Wizard
- Step-by-step: upload → column mapping → TMDb matching → review → commit
- Progress bar for batch TMDb lookups
- Green/amber/red status per title (matched/ambiguous/missing)

#### 5. Dashboard
- Today's rentals & returns
- Overdue items
- Alerts (birthdays, expired cards)
- Quick stats

### Keyboard Shortcuts
- `F1` — New transaction
- `F2` — Customer lookup
- `F3` — Return
- `F4` — Search titles
- `F5` — Hold/recall transaction
- `Esc` — Cancel/back
- Barcode scanner input captured globally (auto-detects scan vs typing)

## 9. Deployment & Operations

### Installation
1. Install Node.js (LTS)
2. Clone/download the application
3. Run `npm install`
4. Run setup script (creates database, prompts for TMDb API key)
5. `npm start` — serves on `localhost:1987`

### PM2 Setup
```bash
npm install -g pm2
pm2 start server.js --name "rerun"
pm2 save
pm2 startup  # generates OS-specific auto-start command
```

### Backup Strategy
- SQLite database is a single file — copy it to back up
- Built-in backup button in the UI (copies DB file to a dated backup)
- Restore = replace DB file with backup

### Port
`1987` — peak VHS rental era.

## 10. Timeline

**16 days: Feb 26 → Mar 14**

| Phase | Days | What |
|-------|------|------|
| Setup & Data Layer | Days 1–3 | Project scaffold, database schema, Drizzle ORM, TMDb client, CSV import engine |
| Core POS | Days 4–7 | Transaction processing, checkout, returns, payments, receipts |
| Inventory & Customers | Days 8–10 | Title/copy management, customer CRUD, search, barcode handling |
| Rental Lifecycle & Alerts | Days 11–12 | Due dates, late fees, reservations, alerts, promotions |
| UI Polish & CRT Aesthetic | Days 13–14 | Scanline effects, keyboard shortcuts, responsive layout, receipt templates |
| Testing & Deployment | Days 15–16 | End-to-end testing, PM2 setup, backup/restore, install docs, handoff |

### Risk Mitigation
- **TMDb rate limiting:** Cache responses locally, batch requests with delays
- **CSV format surprises:** Build a flexible column mapper, don't assume a format
- **Scope creep:** Tier 3 features are hard-deferred. No exceptions without re-scoping.
- **Hardware unknowns:** Barcode scanner and receipt printer compatibility — test early if possible

## 11. Resolved Questions

| # | Question | Decision |
|---|----------|----------|
| 1 | Software name | **reRun** |
| 2 | Port number | **1987** |
| 3 | CSV format | Unknown until we see the file. Import wizard handles any format via auto-detect + manual column mapping. |
| 4 | Receipt printer | Browser print for MVP. Design for ESC/POS (Epson standard) integration post-launch once we know their hardware. |
| 5 | Barcode vs NFC | **Barcode** — they likely already have a USB scanner. Scanners act as keyboard input, zero driver work. NFC deferred to post-launch. |
| 6 | Credit card processing | **Track only** for MVP — record payment method + amount. Actual card processing happens on their existing terminal. Gateway integration (Square/Stripe) deferred until we know their setup. |
| 7 | TMDb API key | Dev key for development. Setup script prompts them to enter their own free TMDb key for production. |
| 8 | Manual title add | **Yes** — build a single-title add flow (TMDb search → pick match → set format/qty) alongside the bulk import. Needed for new releases after launch. |

## 12. Remaining Open Questions

1. **What OS is the store machine running?** — affects PM2 startup config
2. **Receipt printer model** — once purchased, we add direct ESC/POS support
3. **Credit card terminal** — once we know the hardware/service, we can explore integration
4. **Do they want a custom domain or is localhost fine?** — cosmetic but affects perceived polish
