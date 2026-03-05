# reRun Video Rental POS — Installation & User Guide

A point-of-sale system for independent video rental stores. Manages inventory,
customers, rentals, returns, and transactions with a retro CRT terminal interface.

---

## Table of Contents

1. [Installation (First Time)](#installation-first-time)
2. [Opening the App](#opening-the-app)
3. [Updating the App](#updating-the-app)
4. [Backing Up Your Data](#backing-up-your-data)
5. [First-Time Configuration](#first-time-configuration)
6. [Navigating the App](#navigating-the-app)
7. [How to Check Out a Rental](#how-to-check-out-a-rental)
8. [How to Process a Return](#how-to-process-a-return)
9. [How to Add New Customers](#how-to-add-new-customers)
10. [How to Import Your Movie Collection](#how-to-import-your-movie-collection)
11. [How to Browse and Manage Inventory](#how-to-browse-and-manage-inventory)
12. [Settings and Store Configuration](#settings-and-store-configuration)
13. [Keyboard Shortcuts](#keyboard-shortcuts)
14. [Troubleshooting](#troubleshooting)

---

## Installation (First Time)

You only need to do this once. After that, the app starts automatically when
you turn on the computer.

### On Windows

1. Go to https://github.com/nervous-net/reRun/releases
2. Download the latest **rerun-vX.Y.Z.zip** file
3. Find the downloaded ZIP file (usually in your Downloads folder)
4. Right-click it and choose **"Extract All..."**
5. Open the extracted folder
6. Find the file called **install.ps1**
7. Right-click it and choose **"Run with PowerShell"**
8. If Windows asks "Do you want to allow this?", click **Yes**
9. The installer will set everything up automatically. You'll see progress
   messages as it works. When it's done, it will open your web browser to the
   app.

> **If the installer says "Node.js not found":** It will download and install
> Node.js for you. Follow any prompts that appear. After that finishes, the
> installer continues automatically.

### On Mac

1. Go to https://github.com/nervous-net/reRun/releases
2. Download the latest **rerun-vX.Y.Z.zip** file
3. Double-click the ZIP to unzip it
4. Open the **Terminal** app (find it in Applications > Utilities, or search
   for "Terminal" using Spotlight)
5. Type `cd ` (with a space after it), then drag the unzipped folder onto the
   Terminal window — this fills in the folder path for you. Press Enter.
6. Type `bash scripts/install.sh` and press Enter
7. The installer will set everything up. When it's done, it opens the app in
   your browser.

> **If the installer says "Node.js not found":** You need to install it first.
> The easiest way on Mac is to download it from https://nodejs.org — choose the
> **LTS** version. Run the installer, then try step 6 again.

### What the installer does

You don't need to understand this, but in case you're curious:

- Installs PM2 (a program that keeps reRun running in the background)
- Copies the app files to a permanent location on your computer
- Creates the database where your store's data will live
- Sets up reRun to start automatically when you turn on your computer

---

## Opening the App

After installation, reRun starts automatically whenever your computer turns on.
To use it, just open your web browser and go to:

```
http://localhost:1987
```

That's it. Bookmark this page so you can get to it quickly.

> **Tip:** You can create a desktop shortcut to this address. On Windows,
> right-click the desktop, choose New > Shortcut, and paste
> `http://localhost:1987` as the location. On Mac, open the page in Safari or
> Chrome, then drag the URL from the address bar to your desktop.

### If the app isn't running

If you visit the address and see "This site can't be reached," reRun may have
stopped. To restart it:

**On Windows:**
1. Open PowerShell (search for "PowerShell" in the Start menu)
2. Type `cd C:\reRun` and press Enter
3. Type `npx pm2 start ecosystem.config.cjs` and press Enter

**On Mac:**
1. Open Terminal
2. Type `cd ~/rerun` and press Enter
3. Type `npx pm2 start ecosystem.config.cjs` and press Enter

---

## Updating the App

reRun checks for updates automatically. When a new version is available, you'll
see a yellow banner at the top of the Dashboard that says something like:

> **Update available: v0.2.0** [INSTALL UPDATE]

To update:

1. Click the **"Install Update"** button
2. The screen will say **"Updating... please wait"**
3. Wait about 30 seconds. The page will refresh automatically when the update
   is done.

That's it. Your data is safe — the app creates a backup before every update.

You can also check for and install updates from the **Settings** page under the
**System** section.

> **What happens during an update:** The app backs up your database, downloads
> the new version, replaces the program files (not your data), and restarts.
> Your customers, rentals, inventory — everything — stays exactly where it is.

---

## Backing Up Your Data

Your data is the most important thing. reRun protects it in three ways:

### Automatic daily backups

The app automatically creates a backup of your database once per day. It keeps
the last 30 days of backups. You don't need to do anything — this happens in
the background.

### Automatic pre-update backups

Every time you install an update, the app creates a backup first. If anything
goes wrong with an update, your data from right before the update is saved.

### Manual backups

You can create a backup at any time:

1. Go to **Settings** (press F10 or click it in the sidebar)
2. Scroll down to the **Backup & Restore** section
3. Click **"Create Backup"**
4. You'll see the backup appear in the list below with its date and size

### Restoring from a backup

If something goes wrong and you need to go back to an earlier version of your
data:

1. Go to **Settings** > **Backup & Restore**
2. Find the backup you want in the list
3. Click the **"Restore"** button next to it
4. Confirm that you want to restore (this replaces your current data)
5. Close the browser tab and reopen it after a few seconds

> **Important:** Restoring a backup replaces all current data with the data from
> that backup. Any changes made after that backup was created will be lost.

### Where backups are stored

Backups are saved on this computer in the `data/backups` folder inside the reRun
installation directory. If you want extra protection, you can copy this folder
to a USB drive or another computer periodically.

---

## First-Time Configuration

Before your first day of business, go to **Settings** (press F10 or click
"Settings" in the sidebar) and configure:

1. **Store Name** — Your store's name. This appears throughout the app.
2. **Store Phone** — Your store's phone number.
3. **Store Address** — Your store's address.
4. **Tax Rate** — Enter your local sales tax as a percentage. For example, type
   `8.00` for 8% tax or `8.75` for 8.75% tax.
5. **Max Active Rentals** — How many movies one customer (or family) can have
   checked out at once. The default is 6.

You can also:

- Add or edit **Pricing Rules** (rental rates and late fees)
- Choose a **Theme** to change the look of the interface
- Enter your **TMDb API Key** to enable automatic movie poster and info lookup

---

## Navigating the App

The app has a sidebar on the left with all the main sections. You can click on
them or use keyboard shortcuts (function keys) to jump between screens.

| Section     | What it's for                                    |
|-------------|--------------------------------------------------|
| Dashboard   | Overview of your store — alerts, overdue rentals  |
| POS         | Check out rentals and sell products               |
| Customers   | Look up, create, and manage customer accounts     |
| Returns     | Process returned movies                           |
| Inventory   | Browse, search, and manage your movie collection  |
| Import      | Bulk-add movies from a spreadsheet (CSV file)     |
| Settings    | Configure your store, pricing, backups, updates   |

---

## How to Check Out a Rental

This is the main thing you'll do every day.

1. Press **F1** or click **POS** in the sidebar to open the checkout screen.

2. **Find the customer.** Type their name in the customer search box at the top.
   Pick them from the results that appear. If they're a new customer, see
   "How to Add New Customers" below.

3. **Pick who's renting.** If the customer has family members on their account,
   a picker will appear asking who is renting. Choose the account holder or the
   family member who will be watching the movie.

4. **Scan or search for the movie.** Type the barcode number or movie title in
   the scan box. If you type a title, matching movies will appear in a dropdown
   — click the one you want, then pick which copy to rent.

5. **Pick a rental period.** A panel will pop up asking you to choose a pricing
   option — for example, "New Release - 1 Night ($4.99)" or "Catalog - 7 Night
   ($3.99)". Click the one the customer wants.

6. **Add more items** if the customer is renting multiple movies. Repeat steps
   4-5 for each one.

7. **Complete the transaction.** Click the **"Complete"** button. The app will
   show you a **reference code** (like RN-A4K9). This is the code you type into
   Lightspeed to tie this rental to the payment.

8. **Process the payment in Lightspeed.** Ring up the total shown in reRun on
   Lightspeed, and enter the reference code so the two systems match up.

**Holding a transaction:** If a customer needs to step away, press **F5** to
hold the transaction. Their items are saved. When they come back, click "View
Held" to pull it back up.

> **Age restrictions:** If someone under 17 is renting an R or NC-17 rated
> movie, the app will show a warning. This checks the birthday of whoever is
> listed as the renter (the account holder or the family member selected in
> step 3).

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

You can scan multiple movies before processing — they'll all queue up and you
can handle them together.

---

## How to Add New Customers

1. Press **F2** or click **Customers** in the sidebar.

2. Click the **"New Customer"** button.

3. Fill in their information:
   - **First Name** and **Last Name** (required)
   - **Phone number** (recommended — makes it easy to look them up later)
   - **Email** (optional)
   - **Birthday** (optional — used for age checks on R/NC-17 rentals)

4. Click **Save**. The app automatically generates a member barcode for them.

**Family members:** You can add family members to a customer's account. On a
customer's detail page, click "Add Family Member." Family members share the
account's rental limit — so if the limit is 6, the whole family shares those 6
slots. Each family member's birthday is tracked separately for age restriction
checks.

---

## How to Import Your Movie Collection

If you have a spreadsheet of your movies, you can import them all at once.

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
   each one, tell it what that column represents (title name, year, format,
   etc.). The app tries to guess automatically.

4. **Step 3 — Match with TMDb:** If you have a TMDb API key configured, the app
   will search for each movie online. This adds cover art, descriptions, cast
   info, and other details automatically.

5. **Step 4 — Review:** Look over everything before importing.

6. **Step 5 — Import:** Click "Import" and the movies are added to your
   database. Barcodes are generated automatically for each copy.

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
| Store Name     | Appears throughout the app                            |
| Store Phone    | Your store's phone number                             |
| Store Address  | Your store's address                                  |

### Rental Policies

| Setting             | What it does                                             |
|---------------------|----------------------------------------------------------|
| Tax Rate            | Your local sales tax percentage (e.g. 8.00 for 8%)      |
| Max Active Rentals  | Most movies one customer/family can have out at once     |
| Max Family Members  | Most people that can share one account                   |
| Age Check           | Warn when minors rent R or NC-17 movies (on by default)  |

### Pricing Rules

This is where you set up your rental rates. The app comes with defaults like:

| Rule                    | Rate   | Duration | Late Fee       |
|-------------------------|--------|----------|----------------|
| New Release - 1 Night   | $4.99  | 1 day    | $1.99/day      |
| New Release - 3 Night   | $5.99  | 3 days   | $1.99/day      |
| Catalog - 3 Night       | $2.99  | 3 days   | $0.99/day      |
| Catalog - 7 Night       | $3.99  | 7 days   | $0.99/day      |
| Weekend Special         | $3.49  | 3 days   | $0.99/day      |

You can add, edit, or deactivate pricing rules at any time.

### Themes

Pick from six retro computer themes to customize the look:

- **Turbo Vision** — Borland-style teal and cyan
- **Norton Commander** — Blue and yellow classic file manager look
- **WordPerfect 5.1** — Blue and white like the legendary word processor
- **Lotus 1-2-3** — Green and gold spreadsheet vibes
- **Classic Terminal** — Plain green phosphor CRT
- **Hybrid CRT** — The default modern-retro mix

### Backup & Restore

Create, view, and restore backups of your database. See
[Backing Up Your Data](#backing-up-your-data) for details.

### System

Shows the current app version, update status, and lets you check for or install
updates. See [Updating the App](#updating-the-app) for details.

### TMDb Integration

Enter your TMDb API key here to enable automatic movie info lookup during
imports. Get a free key at https://www.themoviedb.org (Settings > API).

---

## Keyboard Shortcuts

These function keys work from any screen in the app:

| Key  | Goes to         |
|------|-----------------|
| F1   | POS (Checkout)  |
| F2   | Customers       |
| F3   | Returns         |
| F4   | Inventory       |
| F5   | Import          |
| F6   | Dashboard       |
| F10  | Settings        |

---

## Troubleshooting

### The app won't open / "This site can't be reached"

The app may have stopped running. See [If the app isn't running](#if-the-app-isnt-running)
above for how to restart it.

### The update button doesn't do anything

Make sure the computer is connected to the internet. The app needs internet
access to check for and download updates. If you're connected and it still
doesn't work, try closing the browser tab and reopening it.

### I accidentally restored the wrong backup

If you restore a backup and realize it was the wrong one, go back to
Settings > Backup & Restore and restore a different one. The automatic daily
backups and pre-update backups are all listed there.

### "Do you want to allow Node.js through the firewall?" (Windows)

If Windows shows a firewall dialog when the app starts, click **Allow**. The
app only runs on your local computer — it does not accept connections from the
internet.

### The app is slow or the database has errors (Windows)

If you installed reRun inside a cloud-synced folder (OneDrive, Dropbox, Google
Drive), the sync service can conflict with the database. The default install
location (`C:\reRun`) avoids this problem. If you moved the app into a synced
folder, move it back.

### Movies aren't matching during import

- Double-check that titles and years are spelled correctly in your CSV
- Make sure your TMDb API key is entered in Settings
- Some very obscure titles may not be in the online database — you can edit
  them manually after import

### Late fees aren't being charged

- Check that your pricing rules have a late fee amount set (Settings > Pricing
  Rules)
- Late fees are calculated per calendar day overdue

### I messed up a transaction

You can void a transaction from the transaction history. This reverses any
inventory changes and marks the transaction as voided for your records.

### I need to reset everything and start over

> **Warning:** This deletes all your data permanently. Make a backup first if
> you need to keep anything.

**On Windows:**
1. Open PowerShell
2. Type `cd C:\reRun` and press Enter
3. Delete the data folder: type `Remove-Item -Recurse -Force data` and press Enter
4. Run setup again: type `npx drizzle-kit push` and press Enter
5. Restart: type `npx pm2 restart rerun` and press Enter

**On Mac:**
1. Open Terminal
2. Type `cd ~/rerun` and press Enter
3. Delete the data folder: type `rm -rf data` and press Enter
4. Run setup again: type `npx drizzle-kit push` and press Enter
5. Restart: type `npx pm2 restart rerun` and press Enter
