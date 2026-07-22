# Screen: Income

## Purpose

Shows income over the selected date range: a stacked monthly bar chart by
source, plus a totals summary.

## Status

Shipped — commit `d081540` (report endpoint) + `1b05a89` (view).

## Key Files

- `components/income/IncomeView.tsx:42` — main component; builds `Row[]`
  from `data.byMonth` (`IncomeView.tsx:50-53`).
- `components/income/IncomeView.tsx:80-89` — one stacked `<Bar>` per income
  source, colored via `colorMap()`.
- `components/income/IncomeView.tsx:106-114` — Summary card: total income,
  total transactions, largest transaction.
- `app/api/reports/income/route.ts:5` — GET handler → `incomeReport(txns)`.
- `lib/aggregations.ts:18` — `incomeByMonth()`: buckets by UTC month, sums
  per category display name.
- `lib/aggregations.ts:36` — `incomeSummary()`: total/count/largest.
- `lib/palette.ts:33` — `colorMap()` assigns the 8-color `CATEGORICAL`
  palette by stable source order, not by value.

## Layout / UI Spec

Two cards: chart card (stacked bar + legend), then summary card (date range
label, 3 rows: Total income (bold), Total transactions, Largest
transaction). One primary value: Total income, bolded in the summary.

## Data Contract

`IncomeReport` (`lib/types.ts:26`) = `{ byMonth: IncomeMonth[], sources:
string[], summary: IncomeSummary }`.

## Fintech UX Principles Applied

**Clarity** — bold "Total income" is the one number that matters most;
everything else is supporting detail. Legend colors are stable per source
(assigned by position in a fixed list, not by value/rank) so a source
doesn't change color between date ranges.

## Open Questions / Risks

None currently open.

## How to Verify

`npm test tests/aggregations.test.ts` covers `incomeSummary`. Visually
confirm bar stacking/legend against seeded data: `npm run seed`, then open
the Income tab.
