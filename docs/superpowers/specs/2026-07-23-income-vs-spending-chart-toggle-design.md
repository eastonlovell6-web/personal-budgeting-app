# Design: Income vs. Spending Chart Toggle

## Purpose

The Income page currently shows one chart: monthly income stacked by source.
Add a toggle so the user can switch to a second chart type — monthly income
(green) vs. spending (red) as diverging bars, with a net income line overlaid
— matching the reference (Monarch Money) cash flow chart style, but scoped to
the Income screen rather than the Cash Flow screen.

## Scope

- Lives entirely on the Income page (`components/income/`).
- Chart-type toggle only — no Monthly/Quarterly/Yearly granularity toggle in
  this pass. Both chart types use monthly buckets, matching the rest of the
  app's aggregation grain.
- Summary card below the chart is unchanged regardless of which chart view is
  active.

## Data Layer

Add a new aggregation, `cashflowByMonth(txns): NetMonth[]`, in
`lib/aggregations.ts`, next to `incomeByMonth`. For each UTC month bucket
(same `monthKey()` helper already used by `incomeByMonth`) it sums:

- `income` — total of transactions where `t.isIncome`
- `expenses` — total of transactions where `!t.isIncome`
- `net` — `income - expenses`

This mirrors the per-range logic already in `cashflowStats`, just bucketed
by month instead of totaled across the whole range.

New type in `lib/types.ts`:

```ts
export type NetMonth = {
  month: string; // "YYYY-MM"
  income: number;
  expenses: number;
  net: number;
};
```

`IncomeReport` (`lib/types.ts:26`) gains a `netByMonth: NetMonth[]` field.
`incomeReport()` (`lib/aggregations.ts:56`) calls `cashflowByMonth(txns)` and
includes the result.

No API route changes: `app/api/reports/income/route.ts` already loads the
full transaction set for the range via `loadTxns(start, end)` — it just
wasn't using the expense side. The Income page continues to make a single
fetch.

## Components

- **`components/income/IncomeBySourceChart.tsx`** (new file) — the existing
  stacked-by-source `BarChart` + legend, extracted verbatim from
  `IncomeView.tsx` (currently lines 56–104). Props: `data: IncomeReport`.
- **`components/income/IncomeVsSpendingChart.tsx`** (new file) — a Recharts
  `ComposedChart` built from `data.netByMonth`:
  - Green `Bar` for `income` (positive values, renders above the zero line).
  - Red `Bar` for `expenses`, values negated for display only (renders below
    the zero line) — the underlying `NetMonth.expenses` stays positive; only
    the chart's local row-mapping step negates it.
  - White/`CHART.textPrimary` `Line` (type `monotone`) for `net`, drawn over
    the bars.
  - A `ReferenceLine` at `y={0}`.
  - Own small legend: Income / Spending / Net income (three swatches, not
    the dynamic per-source legend the other chart uses).
  - Tooltip: a `ComposedChart`-aware variant of the existing `ChartTooltip`
    pattern, showing Income / Spending / Net for the hovered month. Spending
    is displayed as a positive dollar amount (e.g. "$1,234.56"), even though
    the underlying bar value is negated for layout — no negative numbers
    shown to the user.
- **`components/income/IncomeView.tsx`** (edit) — owns
  `const [view, setView] = useState<"source" | "vsSpending">("source")`.
  Renders a small pill toggle in the chart card header (next to the "Income
  by month" label), reusing the `rounded-full bg-surface p-1` /
  `bg-surface-2` active-state visual pattern from `ReportTabs.tsx`, sized
  down to fit inline in a card header rather than full-width tabs. Below the
  toggle, conditionally renders `<IncomeBySourceChart data={data} />` or
  `<IncomeVsSpendingChart data={data} />`. The Summary card
  (`IncomeView.tsx:106-114`) is untouched.

Toggle state is local `useState`, not persisted — it resets to `"source"` on
remount (e.g. navigating away and back, or changing the date range causing a
refetch/remount). This matches how other view state in the app already
behaves; no need for URL/query persistence.

## Colors

Reuse existing `lib/palette.ts` `CHART` tokens — no new colors introduced:

- Income bar → `CHART.positive` (same green `StatRow` uses for positive net
  income)
- Expense bar → `CHART.negative` (same red `StatRow` uses for negative net
  income / total expenses)
- Net line → `CHART.textPrimary`

## Edge Cases

- A month with $0 expenses (or $0 income) simply renders a 0-height bar for
  that series — consistent with how the existing stacked chart already
  handles a source with no activity in a given month.
- Date ranges with a single month, or no months, render the same way the
  existing income chart already handles those cases (empty `rows` array —
  no special-casing needed beyond what `IncomeBySourceChart` already does).

## Testing

Add a `cashflowByMonth` test case to `tests/aggregations.test.ts`, alongside
the existing `incomeByMonth` / `cashflowStats` cases: verify per-month
income/expense/net split on a small fixed transaction set, and that months
are sorted chronologically (same shape of assertion as the existing
`incomeByMonth` test).

No new visual/e2e test infra — verify manually via `npm run seed` +
Income tab, toggling between the two chart views.

## Non-Goals

- Monthly/Quarterly/Yearly granularity toggle (future work, not this spec).
- Any change to the Cash Flow page's Sankey chart.
- Persisting the selected chart view across sessions or in the URL.
