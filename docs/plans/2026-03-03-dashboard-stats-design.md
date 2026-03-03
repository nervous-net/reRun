# Dashboard Stats Endpoint Design

## Problem

The dashboard's "TODAY'S ACTIVITY" panel shows hardcoded placeholder values. A customer rental doesn't appear anywhere on the dashboard summary. The panel displays "Awaiting dashboard stats endpoint" because the backend endpoint was never built.

## Solution

Add `GET /api/dashboard/stats` — a single endpoint returning today's activity aggregations.

## Stats

| Stat | Source | Query Logic |
|------|--------|-------------|
| Rentals today | `transactions` | Count where `type = 'rental'`, `createdAt >= todayStart`, `voided = 0` |
| Returns today | `rentals` | Count where `returnedAt >= todayStart`, `returnedAt IS NOT NULL` |
| Revenue | `transactions` | Sum of `total` where `createdAt >= todayStart`, `voided = 0` |
| Late fees collected | `rentals` | Sum of `lateFee` where `lateFeeStatus = 'paid'`, `returnedAt >= todayStart` |

## Response Shape

```json
{
  "rentalsToday": 3,
  "returnsToday": 1,
  "revenueCents": 1497,
  "lateFeesCollectedCents": 200
}
```

Monetary values are in cents (integers) matching the existing DB convention. Frontend formats to currency display.

## Architecture

Follows existing codebase patterns:

- **Service**: `server/services/dashboard.ts` — aggregation queries, no route logic
- **Route**: `server/routes/dashboard.ts` — `createDashboardRoutes(db)` exporting a Hono app
- **Client API**: `api.dashboard.stats()` added to `client/src/api/client.ts`
- **Dashboard component**: Replace hardcoded values, remove placeholder message

## Refresh Behavior

Rides the existing 30-second poll + window-focus refetch cycle. The stats call is added to `loadDashboardData()` alongside existing `Promise.allSettled` calls.

## Edge Cases

- No activity today: all values return 0
- Voided transactions: excluded from rental count and revenue
- Late fees with `balance` or `forgiven` status: excluded from late fees collected
- Fetch failure: show "—" fallback per stat (existing pattern)

## Testing

- **Service unit tests**: Seed DB with known data, verify aggregation accuracy
- **Route integration tests**: HTTP-level response shape and value verification
- **Edge cases**: Empty day, voided transactions, mixed late fee statuses
