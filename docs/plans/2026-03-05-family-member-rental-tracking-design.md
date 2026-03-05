# Family Member Rental Tracking Design

## Problem

The age restriction check only looks at the primary customer's birthday. When a minor family member rents on an adult's account, the system doesn't flag R/NC-17 content. Additionally, rental records don't track which family member actually rented the item.

## Solution

Add family member selection to the POS checkout flow and track which family member rented each item. Use the selected person's birthday for age restriction checks.

## Schema Change

Add `familyMemberId` to the `rentals` table:
- Type: `text`, nullable, FK to `familyMembers.id`
- Null means the primary account holder is renting
- Non-null means that specific family member is renting

## POS Family Member Picker

After a customer is selected (scan or search), fetch their active family members. If family members exist:

1. Picker appears showing primary account holder + all active family members (name, relationship)
2. Employee selects who is renting
3. Selection persists for the whole transaction
4. Selected person's name shows in the customer bar

If no family members exist, the picker does not appear. Current behavior is preserved.

When searching by a family member's name, the parent account is found and that family member is auto-selected.

## Age Check Changes

- `POST /rentals/checkout` accepts a new optional `familyMemberId` field
- If `familyMemberId` is provided, the age check uses that family member's birthday
- If null, uses the primary customer's birthday (current behavior)

## Rental Record Tracking

- Rental record stores `familyMemberId` to track who actually rented
- Rental history views show the family member's name when applicable (e.g., "Johnny (son)")
- Return flow unchanged -- scans the copy barcode, no family member info needed

## What Changes

- `rentals` table gets `familyMemberId` column
- `POST /rentals/checkout` accepts `familyMemberId`, uses it for age check
- POSScreen gets family member picker after customer selection
- Customer bar shows selected family member name
- Rental history views show family member info
- Customer search by family member name auto-selects that member

## What Stays the Same

- Return flow
- Customers without family members see no change
- Primary account holder option always available in picker
