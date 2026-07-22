# Screen: Cash Flow

## Purpose

Shows the full picture of where money comes from and goes: a Sankey diagram
(income sources → Income hub → expense groups → Savings) plus a 4-stat
header row.

## Status

Shipped — commit `d081540` (report endpoint) + `1b05a89` (view) + `ad48451`
(chart animation fix for React 19) + `105b16f` (exclude internal transfers).

## Key Files

- `components/cashflow/CashflowView.tsx:8` — composes `StatRow` +
  `SankeyChart`.
- `components/cashflow/StatRow.tsx:5` — 4-stat grid: Total income, Total
  expenses, Net income (colored by sign), Savings rate %.
- `components/cashflow/SankeyChart.tsx:45` — d3-sankey layout + SVG render;
  `nodeColors()` (`SankeyChart.tsx:22`) colors by role (income/hub/savings
  green, expense groups by stable categorical hue, leaves inherit parent).
- `components/cashflow/SankeyChart.tsx:49-58` — `ResizeObserver` keeps the
  diagram full-width and horizontally scrollable on narrow screens.
- `app/api/reports/cashflow/route.ts:6` — GET handler → `{ sankey, stats }`.
- `lib/aggregations.ts:102` — `cashflowSankey()`: builds the 3-level
  node/link graph, adds a "Savings" leaf when net > 0.
- `lib/aggregations.ts:85` — `cashflowStats()`: income/expenses/net/
  savingsRate.

## Layout / UI Spec

`StatRow` (2x2 grid of stat cards) above a Sankey card; each Sankey node is
labeled with name + amount + percentage of the Income hub total; links are
colored by target node, translucent.

## Data Contract

`CashflowReport` (`lib/types.ts:55`) = `{ sankey: SankeyData, stats:
CashflowStats }`.

## Fintech UX Principles Applied

**Clarity** — `StatRow`'s Net income cell changes color by sign (green/red)
but always pairs it with the number and the "Net income" label, never
color alone. **Trust** — savings rate is shown plainly as a percentage, not
obscured behind a score or grade.

## Open Questions / Risks

Internal transfers between the user's own accounts are excluded from
reports as of commit `105b16f` — verify that exclusion logic stays correct
if new account types are added later.

## How to Verify

`npm test tests/aggregations.test.ts` (cashflowStats savings-rate case).
Visually confirm the Sankey against the Monarch reference screenshot
mentioned in `docs/superpowers/plans/2026-07-19-personal-budgeting-app.md`
Task 11.
