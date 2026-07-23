# Design: Savings stat on Cash Flow

## Purpose

The Cash Flow stat row shows an "Investing" card (total moved to investment
accounts this period) as a full-width card. There's no comparable "Savings"
figure next to it, so the user can't tell at a glance how savings and
investing compare.

## Change

- `CashflowStats` (`lib/types.ts:56`) gains a `savings: number` field.
- `cashflowStats()` (`lib/aggregations.ts:107`) computes
  `savings = Math.max(0, net - investingTotal)` — net income left over
  after what was invested, floored at zero. This is the same formula
  already used to size the Sankey's "Savings" leaf (`cashflowSankey()`,
  `lib/aggregations.ts:124`), so the stat row and diagram stay consistent.
  `cashflowSankey()` is updated to take this value instead of
  recomputing it inline.
- `StatRow.tsx` (`components/cashflow/StatRow.tsx`): the current
  full-width "Investing" card is replaced with two half-width cards
  side by side — "Savings" and "Investing" — directly comparable at a
  glance, consistent with the existing 2-column grid used by the other
  four stats.
- Negative case: when invested more than net income, `savings` floors
  at $0 rather than going negative (matches Sankey behavior, which
  simply omits the "Savings" leaf when the raw value isn't positive).

## Data Contract

`CashflowStats` becomes:
```ts
{ income, expenses, net, savingsRate, investing, savings }
```
Additive change — no breaking changes to `/api/reports/cashflow`.

## Testing

`tests/aggregations.test.ts` gets a case asserting `savings` on
`cashflowStats()`, including the floored-at-zero case where investing
exceeds net.

## Docs

`claudemd/screens/cashflow.md` updated to list the new stat in the
`StatRow` description and Key Files section.
