# Screen: Income

## Purpose

Shows income over the selected date range: a stacked monthly bar chart by
source, plus a totals summary.

## Status

Shipped — commit `d081540` (report endpoint) + `1b05a89` (view).

## Key Files

- `components/income/IncomeView.tsx` — main component; owns the chart-view
  toggle state (`"source" | "vsSpending"`) and the Summary card.
- `components/income/IncomeBySourceChart.tsx` — stacked bar chart, one
  `<Bar>` per income source, colored via `colorMap()`.
- `components/income/IncomeVsSpendingChart.tsx` — monthly income (green,
  above zero) vs. spending (red, below zero) diverging bars, with a net
  income line overlaid.
- `app/api/reports/income/route.ts:5` — GET handler → `incomeReport(txns)`.
- `lib/aggregations.ts:18` — `incomeByMonth()`: buckets by UTC month, sums
  per category display name.
- `lib/aggregations.ts` — `cashflowByMonth()`: buckets by UTC month, sums
  income/expenses/net — powers the "Income vs. spending" chart view.
- `lib/aggregations.ts:36` — `incomeSummary()`: total/count/largest.
- `lib/palette.ts:33` — `colorMap()` assigns the 8-color `CATEGORICAL`
  palette by stable source order, not by value.

## Layout / UI Spec

Two cards: chart card, then summary card (date range label, 3 rows: Total
income (bold), Total transactions, Largest transaction). One primary value:
Total income, bolded in the summary.

The chart card has a pill toggle in its header switching between two chart
views: "By source" (stacked bar per income source + legend) and "Income vs.
spending" (diverging income/spending bars with a net income line + 3-item
legend). Toggle state is local and resets on remount — not persisted across
date-range changes or reloads.

## Data Contract

`IncomeReport` (`lib/types.ts:26`) = `{ byMonth: IncomeMonth[], sources:
string[], summary: IncomeSummary, netByMonth: NetMonth[] }`.

## Fintech UX Principles Applied

**Clarity** — bold "Total income" is the one number that matters most;
everything else is supporting detail. Legend colors are stable per source
(assigned by position in a fixed list, not by value/rank) so a source
doesn't change color between date ranges.

## Open Questions / Risks

None currently open.

## How to Verify

`npm test tests/aggregations.test.ts` covers `incomeSummary` and
`cashflowByMonth`. Visually confirm both chart views (bar stacking/legend,
and the income-vs-spending toggle) against seeded data: `npm run seed`,
then open the Income tab and try both toggle options.
