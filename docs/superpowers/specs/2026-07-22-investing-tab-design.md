# Investing Tab — Design Spec

**Date:** 2026-07-22
**Status:** Approved (pending final spec review)
**Author:** Easton Lovell (with Claude)

## Summary

Adds visibility into the user's Robinhood investment accounts (now linked via
Plaid) in two independent pieces: a new **Investing** tab showing portfolio
value per account, and an **Investing** leaf on the existing Cash Flow Sankey
so money transferred out to Robinhood shows up instead of silently
disappearing as an excluded internal transfer. This supersedes the "no
investments" item in the v1 spec's Non-Goals
(`2026-07-19-personal-budgeting-app-design.md`) — the original v1 scope
assumed no investment accounts were connected; one now is.

## Goals

- Show current portfolio value, broken down by account (individual, IRA,
  crypto), for any connected `investment`-type account.
- Make the Cash Flow Sankey reflect transfers into investment accounts as
  their own category, distinct from "Savings" (money not yet allocated
  anywhere) and from spending.
- Reuse the existing account-balance data already synced by `accountsGet` —
  no new Plaid product, no new sync job, no new tables for v1.
- Match the existing dark-theme visual language (`app/globals.css`,
  `lib/palette.ts`) and card/stat patterns already used on Income/Spending/
  Cash Flow — this is not a new design language, just a new data view.

## Non-Goals (this pass)

- Per-security holdings (ticker, share count, cost basis) — requires Plaid's
  `Investments` product (confirmed available on the current free/Trial plan)
  and a new `Holding` table. Natural v2, not required for "where does my
  portfolio stand" visibility.
- Investment transaction history (buys/sells/dividends/fees) — requires
  `investmentsTransactionsGet`, a separate Plaid API from `transactionsSync`
  with a different data shape. Out of scope here.
- Historical portfolio value over time / performance charts — Plaid only
  exposes current balance via `accountsGet`; a time series would require
  periodic snapshotting, which doesn't exist yet.
- Editing/re-categorizing the `TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS`
  category — v1's "categories are read-only, straight from Plaid" constraint
  still applies.

## Architecture

Two independent additions sharing no code path:

1. **Investing tab** reads `Account` rows already populated by the existing
   `syncItem()` → `accountsGet` call. New endpoint queries
   `Account.findMany({ where: { type: "investment" } })` joined to `Item`
   for institution name. No new Plaid calls, no schema changes.
2. **Cash Flow "Investing" leaf** — a narrow, separate query sums
   transactions where `pfDetailed === "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS"`
   in the selected range. This is intentionally decoupled from `loadTxns()`
   (which still excludes all transfer categories, unchanged) — Income and
   Spending reports are untouched by this feature, zero regression risk.
   `cashflowSankey()` takes the sum as an input and adds an "Investing" leaf
   off the Income hub; the existing "Savings" leaf becomes `net -
   investingTotal` (leftover, unallocated money) instead of all of `net`, so
   the diagram shows the true split between spent / invested / saved.

## Components & Data Flow

### Backend

- `lib/categories.ts` — add `isInvestmentTransferCategory(pfDetailed:
  string): boolean`, true only for the exact detailed category
  `TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS`.
- `lib/reports.ts` — add `loadInvestmentTransferTotal(start: Date, end:
  Date): Promise<number>`, a Prisma sum query filtered to that category and
  date range, independent of `loadTxns()`.
- `lib/aggregations.ts`:
  - `investingSummary(accounts: InvestmentAccount[]): InvestingSummary` —
    pure function. Sorts accounts by balance descending. Treats a `null`
    `currentBalance` as excluded from the total (not coerced to `0`) but
    still returned in the list so the UI can render "—".
  - `cashflowSankey(txns: Txn[], investingTotal = 0): SankeyData` — extend
    existing signature with an optional param. When `investingTotal > 0`,
    adds an `inv:Investing` leaf off the hub before computing Savings; the
    Savings leaf (still only added when positive) becomes `net -
    investingTotal`.
  - `cashflowStats(txns: Txn[], investingTotal = 0): CashflowStats` — add an
    `investing` field to the returned stats shape.
- `app/api/reports/investing/route.ts` — new route:
  `Account.findMany({ where: { type: "investment" }, include: { item: true
  } })` → `investingSummary()` → JSON.
- `app/api/reports/cashflow/route.ts` — call
  `loadInvestmentTransferTotal(start, end)` alongside the existing
  `loadTxns()`, pass the result into both `cashflowSankey()` and
  `cashflowStats()`.

### Frontend

- `components/investing/InvestingView.tsx` — new, modeled on
  `CashflowView.tsx`'s composition style: a stat card for total portfolio
  value, plus a list of accounts (name, institution, balance) sorted
  largest first, reusing existing card/stat CSS classes rather than
  introducing new styles.
- `app/page.tsx` — add `"investing"` to the tab union, the `ENDPOINT` map,
  and the tab bar; add an empty state ("No investment accounts yet") when
  the account list is empty, mirroring the existing `empty` check pattern
  already in the file.
- `components/cashflow/StatRow.tsx` — add a 5th stat cell, "Investing"
  (period total transferred to investment accounts), alongside the existing
  four (Total income, Total expenses, Net income, Savings rate).
  `SankeyChart.tsx` needs no changes — `nodeColors()` already colors/labels
  nodes generically by role, so the new `inv:Investing` node is handled by
  existing logic.

## Data Model

No schema changes. Both additions read existing tables
(`Account.currentBalance`, `Account.type`, `Transaction.pfDetailed`)
introduced in the original v1 spec.

## Error Handling & Edge Cases

- **No investment accounts connected:** `/api/reports/investing` returns
  `{ accounts: [], total: 0 }`; `InvestingView` shows an empty state
  matching the existing `ConnectEmptyState` pattern.
- **Balance not yet synced** (`currentBalance === null`, e.g. immediately
  after linking, before a sync completes): render "—" for that account row;
  exclude it from the total rather than treating it as `$0`, to avoid a
  misleadingly low portfolio total right after linking.
- **Cash Flow with zero investment transfers in range:** `investingTotal`
  is `0`; the Sankey omits the Investing leaf entirely (same conditional
  pattern already used for the Savings leaf).
- **Income/Spending reports:** unaffected. `loadInvestmentTransferTotal()`
  is a separate query; `loadTxns()`'s exclusion filter (including the
  `LOAN_PAYMENTS_CREDIT_CARD_PAYMENT` fix from the prior session) is
  untouched.

## Testing

- `tests/aggregations.test.ts`: `investingSummary()` — sorts by balance,
  handles `null` balance (excluded from total, present in list), handles an
  empty account list. Updated `cashflowSankey()`/`cashflowStats()` cases:
  Investing leaf appears and Savings leaf is reduced accordingly when
  `investingTotal > 0`; both behave exactly as before when `investingTotal`
  is `0` (regression coverage for existing Cash Flow tests).
- `tests/categories.test.ts`: `isInvestmentTransferCategory()` — true for
  the exact detailed category, false for other `TRANSFER_*` categories and
  for non-transfer categories.
- Manual verification: `npm run dev`, sync, confirm the Investing tab shows
  the real linked Robinhood accounts (individual / crypto / IRA) with
  correct balances, and Cash Flow's Sankey shows an Investing leaf sized to
  actual Wells Fargo → Robinhood transfers in the selected range.

## Success Criteria

- Investing tab renders real account balances for all connected
  `investment`-type accounts, matching Plaid's synced balances.
- Cash Flow Sankey shows an Investing leaf whenever investment transfers
  occurred in the selected range, and the Savings leaf reflects leftover
  money net of both spending and investing.
- Income and Spending reports are bit-for-bit unchanged in behavior for
  users with no investment accounts.
- All new pure functions covered by unit tests; existing test suite
  continues to pass.

## Open Questions / Follow-ups (not blocking this pass)

- Per-security holdings and investment transaction history (buys, sells,
  dividends) are natural v2 additions once the `Investments` product is
  explicitly enabled — would need a new `Holding`/`InvestmentTransaction`
  data model, distinct from the `Transaction` table's PFC-category shape.
- No historical portfolio value tracking yet — would need a periodic
  snapshot job (not just on-demand `accountsGet`) if a performance-over-time
  view is wanted later.
- Crypto is currently lumped into the same `investment`-type Account
  bucket as brokerage/IRA; revisit if the user wants it broken out
  separately (e.g., different risk framing) once per-security data exists.
