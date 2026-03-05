# Lightspeed Reference Codes Design

## Problem

reRun handles rental logic (checkout, returns, inventory) but payment processing happens in Lightspeed POS. We need a way to tie a reRun transaction to its corresponding Lightspeed transaction for reconciliation.

## Solution

When a rental checkout completes in reRun, generate a short alphanumeric reference code (e.g., `RN-7X3K`) displayed to the employee. The employee enters this code into Lightspeed when ringing up the payment, creating a link between the two systems.

## Schema Change

Add `referenceCode` column to the `transactions` table:

- Type: `text`, nullable (existing transactions won't have one)
- Format: `RN-` prefix + 4 uppercase alphanumeric characters
- Alphabet: `0123456789ABCDEFGHJKLMNPQRSTUVWXYZ` (excludes I and O to avoid confusion with 1 and 0)
- Unique index for fast lookup and collision prevention
- Generated server-side at transaction creation using nanoid with custom alphabet
- On collision (unlikely), retry once with a new code

## Checkout Flow

The existing checkout flow stays intact up to payment:

1. Employee scans customer, scans copies, selects pricing rules (unchanged)
2. **Confirmation Modal** replaces PaymentModal, showing:
   - Line items summary (titles, formats, pricing rules, due dates)
   - Total amount to ring up in Lightspeed
3. Employee clicks "Complete Rental"
4. Server creates transaction + rental records, generates reference code
5. **Reference Code Screen** displays the `RN-XXXX` code prominently in large text
6. Employee types that code into Lightspeed and processes payment there
7. Employee clicks "Done" to return to main screen

The `paymentMethod`, `amountTendered`, and `changeGiven` fields remain in the schema but go unused. No migration needed for existing data.

## Receipt

reRun does not print receipts. Lightspeed handles all receipt printing.

## Search & Reconciliation

- Reference code displayed as a column in transaction history views
- Searchable by reference code (exact match, case-insensitive)
- Visible on transaction detail views
- Enables end-of-day reconciliation between reRun and Lightspeed

## What Changes

- PaymentModal replaced with ConfirmationModal + ReferenceCodeScreen
- Receipt component removed (Lightspeed handles receipts)
- Transaction creation endpoint generates and returns reference code
- Transaction list/detail views show reference code
- Search supports reference code lookup

## What Stays the Same

- Customer scanning/selection
- Copy barcode scanning
- Pricing rule selection
- Rental creation logic
- Return flow
- All other POS functionality (holds, voids, etc.)
