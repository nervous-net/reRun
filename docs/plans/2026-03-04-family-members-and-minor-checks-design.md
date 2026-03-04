# Family Members & Minor Rental Checks — Design

## Overview

Six related features/fixes for customer and family member management, plus age-based rental validation.

## Features

### 1. Schema: Add birthday + active flag to family members
- Add `birthday` (text, nullable, YYYY-MM-DD) to `familyMembers`
- Add `active` (integer, default 1) to `familyMembers` for soft delete

### 2. Edit family members
- PUT `/api/customers/:customerId/family-members/:id`
- Accepts: firstName, lastName, relationship, birthday
- UI: inline edit or modal on customer detail page

### 3. Delete (soft) family members
- DELETE `/api/customers/:customerId/family-members/:id`
- Sets `active = 0` instead of removing the row
- Inactive members hidden from UI but preserved for history
- GET endpoints filter to `active = 1` by default

### 4. Search by family name
- Integrate into existing customer search
- When searching, also match against family member firstName/lastName
- Results indicate which family member matched
- Uses existing fuzzy/LIKE search pattern

### 5. Add birthdate to family members
- UI field on add/edit family member forms
- Date picker or text input with YYYY-MM-DD format
- Display age next to birthday in customer detail view

### 6. Minor rental check (R/NC-17 warning)
- At checkout, if the customer or family member is under 18 and the title is rated R or NC-17:
  - Show a warning dialog
  - Require clerk to check "parent/guardian approved" checkbox before proceeding
- Age computed from birthday at checkout time
- If no birthday on file, skip the check (no block)
- Both primary customer and family members are checked

### 7. Pre-fill customer on POS from customer page
- Existing "New Rental" button on customer detail page passes `customerId` as URL query param
- POS page reads `?customerId=X` on mount, fetches and auto-fills customer
- No other changes to POS flow

## Schema Change

```sql
ALTER TABLE family_members ADD COLUMN birthday TEXT;
ALTER TABLE family_members ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
```

## Implementation Order

1. Schema migration (birthday + active)
2. Backend: edit + soft-delete family member endpoints
3. Backend: update customer search to include family members
4. Backend: minor check logic in rental checkout
5. Frontend: edit/delete family member UI
6. Frontend: birthday field on family member forms
7. Frontend: family name search results display
8. Frontend: minor rental warning dialog
9. Frontend: POS customer pre-fill from query param
