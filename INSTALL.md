# reRun Video Rental POS — Installation & User Guide

A point-of-sale system for independent video rental stores. Manages inventory,
customers, rentals, returns, and transactions with a retro CRT terminal interface.

---

## Table of Contents

1. [What You Need](#what-you-need)
2. [Installation](#installation)
3. [Starting the App](#starting-the-app)
4. [First-Time Configuration](#first-time-configuration)
5. [Navigating the App](#navigating-the-app)
6. [How to Check Out a Rental](#how-to-check-out-a-rental)
7. [How to Process a Return](#how-to-process-a-return)
8. [How to Add New Customers](#how-to-add-new-customers)
9. [How to Import Your Movie Collection](#how-to-import-your-movie-collection)
10. [How to Browse and Manage Inventory](#how-to-browse-and-manage-inventory)
11. [Settings and Store Configuration](#settings-and-store-configuration)
12. [Backing Up Your Data](#backing-up-your-data)
13. [Keyboard Shortcuts](#keyboard-shortcuts)
14. [Troubleshooting](#troubleshooting)

---

## What You Need

Before you start, make sure you have:

- **A computer** running Windows, Mac, or Linux
- **Node.js version 18 or higher** — this is the engine that runs the app
  - Download it free from https://nodejs.org (choose the "LTS" version)
  - After installing, open a terminal and type `node --version` to confirm
- **A web browser** — Chrome, Firefox, Safari, or Edge all work
- **A TMDb API key** (optional but recommended) — this lets the app automatically
  look up movie posters, descriptions, and cast info when you import your inventory
  - Create a free account at https://www.themoviedb.org
  - Go to Settings > API and copy your "API Read Access Token"
  - You can skip this during setup and add it later

---

## Installation

### Step 1: Get the files

Download or copy the reRun application folder to your computer. It doesn't matter
where — your Desktop, Documents folder, or anywhere you like.

### Step 2: Open a terminal

- **On Mac**: Open the "Terminal" app (find it in Applications > Utilities)
- **On Windows**: Open "Command Prompt" or "PowerShell" from the Start menu
- **On Linux**: Open your terminal emulator

Navigate to the folder where you put reRun. For example, if it's on your Desktop:

```
cd Desktop/CRTvideo
```

### Step 3: Install dependencies

Type this command and press Enter:

```
npm install
```

This downloads all the software libraries the app needs. It may take a minute or
two. You'll see a progress bar and some output — that's normal. Wait until it
finishes and you see your command prompt again.

### Step 4: Run first-time setup

```
npm run setup
```

The setup wizard will:

1. Check that your Node.js version is new enough
2. Create a `data` folder for your database
3. Ask for your TMDb API key (press Enter to skip if you don't have one yet)
4. Create the database with all the tables it needs
5. Set up default pricing rules and store settings

You'll see a "Setup complete!" message with a nice little box when it's done.
**You only need to run setup once.**

---

## Starting the App

Every time you want to use the app, open a terminal in the reRun folder and type:

```
npm run dev
```

You'll see some output scroll by. Once you see lines about both the server and
client running, open your web browser and go to:

```
http://localhost:1987
```

That's it — you should see the reRun dashboard with the retro green-on-black
terminal look.

**To stop the app**, go back to the terminal and press `Ctrl+C`.

> **Note:** The app runs entirely on your computer. Your data never leaves your
> machine. No internet connection is needed after setup (unless you want to use
> the TMDb movie lookup feature during imports).

---

## First-Time Configuration

Before your first day of business, go to **Settings** (press F10 or click
"Settings" in the sidebar) and configure:

1. **Store Name** — Replace "Way Cool Video" with your store's name. This appears
   on receipts and throughout the app.
2. **Store Phone** — Your store's phone number for receipts.
3. **Store Address** — Your store's address for receipts.
4. **Tax Rate** — Enter your local sales tax rate as a whole number. For example,
   enter `800` for 8.00% tax, or `875` for 8.75% tax. The default is 800 (8%).
5. **Max Active Rentals** — How many movies a single customer can have checked out
   at once. The default is 6.

You can also:

- Add or edit **Pricing Rules** (rental rates and late fees)
- Choose a **Theme** to change the look of the interface
- Enter your **TMDb API Key** if you skipped it during setup

---

## Navigating the App

The app has a sidebar on the left with all the main sections. You can click on
them or use keyboard shortcuts (function keys) to jump between screens instantly.

The main sections are:

| Section     | What it's for                                    |
|-------------|--------------------------------------------------|
| Dashboard   | Overview of your store — alerts, overdue rentals  |
| POS         | Check out rentals and sell products               |
| Customers   | Look up, create, and manage customer accounts     |
| Returns     | Process returned movies                           |
| Inventory   | Browse, search, and manage your movie collection  |
| Import      | Bulk-add movies from a spreadsheet (CSV file)     |
| Settings    | Configure your store, pricing, and appearance     |

---

## How to Check Out a Rental

This is the main thing you'll do every day.

1. Press **F1** or click **POS** in the sidebar to open the checkout screen.

2. **Find the customer.** Type their name in the customer search box at the top.
   Pick them from the results that appear. If they're a new customer, see
   "How to Add New Customers" below.

3. **Scan or search for the movie.** Type the barcode number or movie title in
   the item search box. The movie will appear in the list.

4. **Pick a rental period.** A panel will pop up asking you to choose a pricing
   option — for example, "New Release - 1 Night ($4.99)" or "Catalog - 7 Night
   ($3.99)". Click the one the customer wants.

5. **Add more items** if the customer is renting multiple movies. Repeat steps
   3-4 for each one.

6. **Review the transaction.** The right side of the screen shows everything in
   the cart with the subtotal, tax, and total.

7. **Complete the sale.** Click the "Complete" button. Choose how the customer is
   paying:
   - **Cash** — Enter the amount they hand you. The app calculates change.
   - **Card** — Process the card on your card reader and confirm.
   - **Account** — Charge to the customer's store account balance.

8. **Done!** A receipt appears that you can print.

**Holding a transaction:** If a customer needs to step away, press **F5** to hold
the transaction. Their items are saved. When they come back, click "View Held" to
pull it back up.

---

## How to Process a Return

1. Press **F3** or click **Returns** in the sidebar.

2. **Scan the movie barcode** (or type it in and press Enter). The app will find
   the rental and show you:
   - Who rented it
   - When it was due
   - Whether it's late and how much the fee is

3. **If there's a late fee**, choose what to do:
   - **Pay** — The customer pays the fee right now
   - **Balance** — Add the fee to the customer's account (they pay later)
   - **Forgive** — Waive the fee (manager's discretion)

4. **Click "Process Returns"** to complete the return. The movie goes back into
   your available inventory automatically.

You can scan multiple movies before processing — they'll all queue up and you can
handle them together.

---

## How to Add New Customers

1. Press **F2** or click **Customers** in the sidebar.

2. Click the **"New Customer"** button.

3. Fill in their information:
   - **First Name** and **Last Name** (required)
   - **Phone number** (recommended — makes it easy to look them up later)
   - **Email** (optional)
   - **Birthday** (optional — the app will show a birthday alert on their special day)

4. Click **Save**. The app automatically generates a member barcode for them.

**Family members:** You can link family members to a customer's account. On a
customer's detail page, click "Add Family Member." Family members share the
account's rental limit — so if the limit is 6, the whole family shares those 6
slots.

---

## How to Import Your Movie Collection

If you have a spreadsheet of your movies, you can import them all at once instead
of typing each one in by hand.

### Preparing your spreadsheet

Save your spreadsheet as a **CSV file** (most spreadsheet apps can do this with
File > Save As > CSV). Your CSV should have columns like:

```
Title,Year,Format,Quantity,Genre,Rating
Blade Runner,1982,DVD,2,Sci-Fi,R
The Princess Bride,1987,VHS,3,Fantasy,PG
Jurassic Park,1993,Blu-ray,1,Action,PG-13
```

At minimum you need **Title** and **Format** (VHS, DVD, or Blu-ray). Year,
quantity, genre, and rating are helpful but optional.

### Running the import

1. Press **F5** or click **Import** in the sidebar.

2. **Step 1 — Upload:** Click "Choose File" and select your CSV file.

3. **Step 2 — Map Columns:** The app will show your CSV's column headers. For
   each one, tell it what that column represents (title name, year, format, etc.).
   The app tries to guess automatically.

4. **Step 3 — Match with TMDb:** If you have a TMDb API key configured, the app
   will search for each movie in the TMDb database. This adds cover art,
   descriptions, full cast info, and other metadata automatically. Movies with a
   strong match are auto-linked. For others, you can manually pick the right one.

5. **Step 4 — Review:** Look over everything before importing. Make sure the
   titles, years, and formats look right.

6. **Step 5 — Import:** Click "Import" and the movies are added to your database.
   Barcodes are generated automatically for each copy.

After importing, go to **Inventory (F4)** to see your new movies.

---

## How to Browse and Manage Inventory

Press **F4** or click **Inventory** in the sidebar.

### Searching

- Type a movie title in the search box to find it
- Use the **Genre** dropdown to filter by genre
- Use the **Format** checkboxes to show only VHS, DVD, or Blu-ray
- Use the **Rating** filter for G, PG, PG-13, R, or NC-17
- Check **Available Only** to hide movies with no copies currently in stock

### Viewing a title

Click on any movie to see its detail page:

- Cover art and metadata (if enriched via TMDb)
- List of all copies with their barcode, format, condition, and current status
  (in stock or rented out)
- Who currently has each copy checked out

### Managing copies

On the title detail page you can:

- **Add copies** — Add more copies in a specific format
- **Edit a copy's condition** — Mark as good, fair, or poor
- **Change status** — Manually mark a copy as in or out

### Adding a title manually

Click "Add Title" and fill in the details. If you provide a format and quantity,
copies will be created automatically with barcodes.

---

## Settings and Store Configuration

Press **F10** or click **Settings** in the sidebar.

### Store Information

| Setting        | What it does                                          |
|----------------|-------------------------------------------------------|
| Store Name     | Appears on receipts and the app header                |
| Store Phone    | Printed on receipts                                   |
| Store Address  | Printed on receipts                                   |
| Receipt Footer | Custom message at the bottom of receipts              |

### Rental Policies

| Setting             | What it does                                             |
|---------------------|----------------------------------------------------------|
| Tax Rate            | Sales tax in basis points (800 = 8.00%, 875 = 8.75%)    |
| Max Active Rentals  | Most movies one customer/family can have out at once     |
| Max Family Members  | Most people that can share one account                   |

### Pricing Rules

This is where you set up your rental rates. The app comes with five defaults:

| Rule                    | Rate   | Duration | Late Fee       |
|-------------------------|--------|----------|----------------|
| New Release - 1 Night   | $4.99  | 1 day    | $1.99/day      |
| New Release - 3 Night   | $5.99  | 3 days   | $1.99/day      |
| Catalog - 3 Night       | $2.99  | 3 days   | $0.99/day      |
| Catalog - 7 Night       | $3.99  | 7 days   | $0.99/day      |
| Weekend Special         | $3.49  | 3 days   | $0.99/day      |

You can add, edit, or deactivate pricing rules at any time. Deactivated rules
won't appear during checkout but are kept for records.

### Themes

Pick from six retro computer themes to customize the look:

- **Turbo Vision** — Borland-style teal and cyan
- **Norton Commander** — Blue and yellow classic file manager look
- **WordPerfect 5.1** — Blue and white like the legendary word processor
- **Lotus 1-2-3** — Green and gold spreadsheet vibes
- **Classic Terminal** — Plain green phosphor CRT
- **Hybrid CRT** — The default modern-retro mix

Click a theme to preview it, then save your choice.

### TMDb Integration

Enter your TMDb API key here to enable automatic movie metadata lookup during
imports. The key is saved in your settings and used whenever you run an import.

---

## Backing Up Your Data

All your data lives in one file: `data/rerun.db` inside the app folder.

### Manual backup

Copy the `data` folder to a safe location (USB drive, cloud storage, another
computer). Do this regularly — at least once a day if you're actively using the
system.

### What to back up

The only critical file is `data/rerun.db`. Everything else can be reinstalled.
But copying the entire `data` folder is easiest and also captures any automatic
backups the system has made.

### Restoring from backup

If something goes wrong:

1. Stop the app (Ctrl+C in the terminal)
2. Replace `data/rerun.db` with your backup copy
3. Start the app again with `npm run dev`

---

## Keyboard Shortcuts

These function keys work from any screen in the app:

| Key  | Goes to     |
|------|-------------|
| F1   | POS (Checkout) |
| F2   | Customers   |
| F3   | Returns     |
| F4   | Inventory   |
| F5   | Import      |
| F6   | Dashboard   |
| F10  | Settings    |

On the **POS screen**, there are additional shortcuts:

| Key  | Action                      |
|------|-----------------------------|
| F5   | Hold current transaction    |

---

## Troubleshooting

### "command not found: node" or "node is not recognized"

Node.js isn't installed or isn't in your system path. Download it from
https://nodejs.org and install it. Choose the LTS version. After installing,
close and reopen your terminal, then try again.

### "npm ERR!" during install

Try deleting the `node_modules` folder and running `npm install` again:

```
rm -rf node_modules
npm install
```

On Windows, use `rmdir /s /q node_modules` instead of the `rm` command.

### The app won't start / "port already in use"

Something else is using port 1987. Either close that other program, or edit your
`.env` file and change `PORT=1987` to a different number (like `PORT=3000`), then
go to `http://localhost:3000` instead.

### The browser shows a blank page

Make sure you're going to `http://localhost:1987` (not `https`). Check the
terminal for error messages. If you see errors, try stopping the app (Ctrl+C)
and starting it again.

### Movies aren't matching during import

- Double-check that titles and years are spelled correctly in your CSV
- Make sure your TMDb API key is entered in Settings > TMDb Integration
- Some very obscure titles may not be in the TMDb database — you can edit them
  manually after import

### Late fees aren't being charged

- Check that your pricing rules have a late fee amount set (Settings > Pricing Rules)
- Late fees are calculated per calendar day overdue — returning a movie the same
  day it's due (even late in the day) has no fee

### I messed up a transaction

You can void a transaction from the transaction history. This will reverse any
inventory changes (copies go back to "in" status, product stock is restored) and
mark the transaction as voided for your records.

### I need to reset everything and start over

1. Stop the app
2. Delete the `data` folder
3. Delete the `.env` file
4. Run `npm run setup` again

This gives you a completely fresh database. **All your data will be lost** — make
sure you have a backup first if you need to keep anything.
