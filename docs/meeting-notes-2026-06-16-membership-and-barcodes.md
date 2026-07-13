<!-- ABOUTME: Notes from a 2026-06-16 meeting with a Rerun prospect about membership cards, barcodes, and onboarding. -->
<!-- ABOUTME: Captures decisions and action items driving the member + movie barcode-rendering work. -->

# Rerun — Membership & Barcode Meeting (2026-06-16)

Prospect interested in adopting Rerun for their video-rental store (~7,000+ movies, currently cataloged in CLZ Movies, Rerun running offline/locally).

## Membership cards & barcodes
- **Preferred approach:** print barcode **stickers via Dymo label printer**, slap onto **pre-made laminated cards.**
  - Avoids wasting a full sheet per member.
  - Keeps their current sign-in + lamination flow intact.
- **Label size:** they'll confirm preferred Dymo label dimensions → **Dylan sets that as the default size in Rerun.**
- **Member barcode rendering is NOT built yet** — Dylan to add it. (Today the `memberBarcode` nanoid is generated + stored, but only displayed as plain text; no scannable image.)

## Movie barcode strategy
- Two options: reuse existing **UPCs from movie boxes** vs. **generate custom barcodes in Rerun.**
- **Recommendation: generate custom barcodes.**
  - Avoids UPC conflicts between editions and duplicate copies.
  - Single source for all barcodes → no DB confusion.
  - UPCs from the CLZ export still useful as a reference / import test.
- **Placement:** inside the case cover (library-style), opened naturally at checkout.
  - Avoids water damage from the exterior return box.
  - Works for most titles; **Criterion / cardboard boxes handled separately** (look up or scan at counter).
- **Multiple copies:** append **.001, .002** etc. to distinguish copies at check-in/out.
  - Critical for drop-box returns where the member can't be scanned first.

## Phased labeling approach
- **No need to label all 7,000+ movies upfront.**
  - Add a barcode when a movie is **returned**, before it goes back on the shelf.
  - If a movie hits checkout with no barcode, **print and apply on the spot.**
  - Adds a couple minutes per rental but avoids a full "museum shutdown."
- **Printer longevity:** they want to evaluate a more **durable (non-thermal)** option for long-term use (thermal labels fade).

## CLZ Movies export
- CLZ Movies already catalogs the collection; includes barcode/edition data.
- They can export a **CSV** → Dylan wants a **~100-row sample** to test import into Rerun.
  - **Only the barcode numbers needed**, not image files (Rerun generates the visual from the number).
- If CLZ doesn't currently export barcodes, a **support ticket to CLZ** would likely add it.

## Box sets & rentals
- Currently rented as **one item** (e.g., full Twilight Zone collection = 1 rental).
  - 30-day window before late fees.
  - Team wants to preserve the "wow, that's one item" customer moment.
- Renting by individual disc floated but **not decided** — needs a dedicated conversation.

## Website search & reservations
- **Request:** public-facing search of rental inventory on their website.
- **Reservations are complex** (privacy policy, customer counts); **search is more feasible short-term.**
- Possible shortcut: use their **CLZ/TVDB account** to expose owned titles, searchable via the website.
- Rerun is currently **offline/locally hosted** → external connectivity needs scoping.

## Next steps
- [ ] **Add barcode rendering for members and movies** to Rerun (Dylan) — keystone, unblocks onboarding.
- [ ] **Confirm Dymo label size** for membership cards (them) → set as default in Rerun (Dylan).
- [ ] **Export ~100 movies from CLZ Movies** as CSV → send to Dylan for import testing (them).
- [ ] **Get them set up + installed** on Rerun once the barcode feature is ready (Dylan).
- [ ] **Revisit box-set rental logic** in a follow-up conversation.
- [ ] **Scope website search** after core setup is stable.
