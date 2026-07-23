# Spending Category Drill-Down — Design Spec

**Date:** 2026-07-23
**Status:** Approved
**Author:** Easton Lovell (with Claude)

## Summary

On the Spending screen (`claudemd/screens/spending.md`), tapping a category
row expands it inline to show that category's underlying transactions —
newest first. This is the first piece of transaction-level detail on any
report screen; everything else on Spending stays exactly as it is today.

## Goals

- Tapping a `CategoryRow` toggles an inline-expanded list of that
  category's transactions for the currently selected date range.
- Only one category expanded at a time (accordion).
- Each transaction row shows date (e.g. "Jul 18"), merchant/name, amount.
- Transactions are lazy-fetched on first expand and cached per category for
  the rest of the session, so re-toggling doesn't refetch.

## Non-Goals

- **No editing or re-categorization** — v1 reports stay read-only
  (`claudemd/screens/spending.md`'s existing constraint).
- **No pagination** within an expanded category — the full list for the
  selected range renders at once.
- **No changes to the donut or "Show more" behavior** above the category
  list.

## Architecture

A new endpoint, `/api/reports/spending/transactions`, filters the same
`loadTxns()` result (`lib/reports.ts:33`) down to one `pfDetailed` category
and returns it sorted newest-first. `SpendingView` needs the current date
`range` (mirroring `IncomeView`, which already receives it) to build the
query on click.

## Components & Data Flow

### Data Contract (`lib/types.ts`)

```ts
export type SpendingCategoryTransaction = {
  transactionId: string;
  date: string;   // ISO date
  name: string;   // merchantName ?? name, resolved server-side
  amount: number;
};
```

### Backend

- `lib/aggregations.ts`: new `transactionsForCategory(txns: Txn[], detailed: string): SpendingCategoryTransaction[]` —
  filters to `!isIncome && pfDetailed === detailed`, maps `merchantName ??
  name` to `name`, sorts by date descending. Pure function, tested the same
  way as `spendingByCategory`.
- `app/api/reports/spending/transactions/route.ts` (new): `GET
  ?start=&end=&category=` — reuses `parseRange` + `loadTxns`, calls
  `transactionsForCategory`, returns the array as JSON. 400 if `category`
  is missing.

### Frontend

- `app/page.tsx`: pass `range={range}` into `<SpendingView>` (same prop
  `IncomeView` already takes).
- `components/spending/SpendingView.tsx`:
  - New state: `expandedCategory: string | null` (the `detailed` key) and a
    `Map<string, SpendingCategoryTransaction[] | "loading">` cache.
  - `CategoryRow` becomes clickable (`onClick` toggles `expandedCategory`).
    Expanding a category not yet in the cache triggers the fetch to
    `/api/reports/spending/transactions?start=...&end=...&category=...`;
    the cache entry is set to `"loading"` immediately so the row can show a
    "Loading…" state, then replaced with the result.
  - When `expandedCategory === category.detailed`, render the transaction
    list directly below that row (inside the same card), each as a new
    `TransactionRow` (date via new `dayShort`, name, amount via `money`).
- `lib/format.ts`: new `dayShort(d: Date): string` → `"Jul 18"`, same
  pattern as the existing `monthShort`.

## Error Handling & Edge Cases

- **Category with zero transactions in range:** can't happen — categories
  only appear in `SpendingReport.categories` if they have spend in the
  range, so an expanded category always has at least one transaction.
- **Range changes while a category is expanded:** the cache is keyed only
  by category, not range, so it must be cleared (and `expandedCategory`
  reset to `null`) whenever `range` changes — otherwise a stale list for
  the old range would show.
- **Fetch fails:** cache entry reverts to unset (not `"loading"`) so the
  row shows nothing further; not worth a dedicated error UI for a v1
  read-only drill-down.

## Testing

- Unit test (`tests/aggregations.test.ts`): `transactionsForCategory` —
  filters to the right category, excludes income/transfers (already
  excluded upstream by `loadTxns`), sorts newest-first, resolves
  `merchantName ?? name`.
- Manual verification: `npm run dev`, open Spending, tap a category, confirm
  its transactions appear newest-first with date/name/amount; tap again to
  collapse; tap a different category and confirm the first collapses
  (accordion); change the date range while one is expanded and confirm it
  collapses rather than showing stale data.
- `npx tsc --noEmit` and `npm test` stay green.

## Success Criteria

- Clicking any category row on Spending shows its transactions inline,
  newest first, without navigating away from the page.
- Only one category is ever expanded at once.
- No change to existing Spending behavior (donut, "Show more", totals).
- Existing test suite continues to pass.
