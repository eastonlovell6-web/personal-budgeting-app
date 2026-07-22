# Screen: Spending

## Purpose

Shows spending by category for the selected range: a donut with a centered
total, and a ranked category list below.

## Status

Shipped — commit `d081540` (report endpoint) + `1b05a89` (view).

## Key Files

- `components/spending/SpendingView.tsx:23` — main component; `TOP_N = 8`
  (`SpendingView.tsx:10`).
- `components/spending/SpendingView.tsx:27-33` — top-8 distinct slices +
  folded "Other" for the tail.
- `components/spending/SpendingView.tsx:63-68` — centered total overlay on
  the donut.
- `components/spending/SpendingView.tsx:83-90` — "Show more"/"Show less"
  toggle past the top 8.
- `app/api/reports/spending/route.ts:6` — GET handler →
  `spendingByCategory(txns)` + summed total.
- `lib/aggregations.ts:64` — `spendingByCategory()`: groups by detailed
  category, sorted descending by amount.
- `lib/categories.ts:22` — `MAP`: Plaid detailed category → `{display,
  emoji, group}`.

## Layout / UI Spec

Donut card (center total, "Total" label) then category-list card, each row
= emoji + name + % of total + amount, sorted descending. One primary value:
the centered total.

## Data Contract

`SpendingReport` (`lib/types.ts:39`) = `{ total: number, categories:
SpendingCategory[] }`.

## Fintech UX Principles Applied

**Clarity** — center-total donut plus progressive disclosure ("Show more")
keeps the long tail of small categories from overwhelming the screen; emoji
+ percentage make category weight scannable without reading exact dollar
amounts.

## Open Questions / Risks

v1 categories are read-only, straight from Plaid — no re-categorization UI.
Explicit non-goal in
`docs/superpowers/specs/2026-07-19-personal-budgeting-app-design.md`.

## How to Verify

`npm test tests/categories.test.ts tests/aggregations.test.ts`. Visually
confirm donut/list against seeded data.
