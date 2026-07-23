# Income vs. Spending Chart Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toggle on the Income page that switches between the existing "stacked by source" income chart and a new "income vs. spending" chart (green income bars, red spending bars diverging from zero, white net income line overlaid).

**Architecture:** Extend the income aggregation/report with a new monthly income/expense/net series (`cashflowByMonth`, reusing transaction data the Income API route already loads). Split the existing chart out of `IncomeView.tsx` into its own component, add a sibling chart component for the new view, and wire a small local-state pill toggle into `IncomeView.tsx` to switch between them.

**Tech Stack:** Next.js 16 (App Router) + TypeScript, Recharts (`ComposedChart`/`BarChart`), Tailwind v4, Vitest.

## Global Constraints

- Money formatting: always via `lib/format.ts` (`money`, `money0`, `moneyCompact`) — never format currency inline.
- Dark theme only: use `lib/palette.ts` `CHART` tokens / CSS variables — never hardcode colors.
- Keep files under 500 lines.
- v1 reports are read-only — no editing/mutation logic in this feature.
- `npm run build` must succeed before any task is considered done (this project has no separate `tsc --noEmit` script; `next build` type-checks as part of the build).

---

### Task 1: `cashflowByMonth` aggregation + `NetMonth` type

**Files:**
- Modify: `lib/types.ts:15-30`
- Modify: `lib/aggregations.ts` (imports at top, new function after `incomeByMonth`, wire into `incomeReport`)
- Test: `tests/aggregations.test.ts`

**Interfaces:**
- Produces: `NetMonth = { month: string; income: number; expenses: number; net: number }` (exported from `lib/types.ts`)
- Produces: `cashflowByMonth(txns: Txn[]): NetMonth[]` (exported from `lib/aggregations.ts`) — sorted chronologically by `month`
- Produces: `IncomeReport.netByMonth: NetMonth[]`
- Consumes: existing `Txn` type (`lib/types.ts:4-13`), existing `monthKey()` helper (`lib/aggregations.ts:19-21`)

- [ ] **Step 1: Write the failing tests**

Open `tests/aggregations.test.ts`. Change the import line:

```ts
import {
  incomeByMonth,
  incomeSummary,
  incomeReport,
  spendingByCategory,
  transactionsForCategory,
  cashflowSankey,
  cashflowStats,
  cashflowByMonth,
  cashPlacementNudge,
  savingsRulesSimulation,
} from "@/lib/aggregations";
```

Then add this test, placed right after the existing `"income report exposes distinct sorted sources"` test:

```ts
  it("cashflow by month buckets income, expenses, and net", () => {
    const rows = cashflowByMonth(fixture);
    const jan = rows.find((r) => r.month === "2026-01")!;
    expect(jan.income).toBe(4050);
    expect(jan.expenses).toBe(2420);
    expect(jan.net).toBe(1630);
    const feb = rows.find((r) => r.month === "2026-02")!;
    expect(feb.income).toBe(4000);
    expect(feb.expenses).toBe(0);
    expect(feb.net).toBe(4000);
    // sorted chronologically
    expect(rows.map((r) => r.month)).toEqual(["2026-01", "2026-02"]);
  });
```

Also update the existing `"income report exposes distinct sorted sources"` test to check the new field:

```ts
  it("income report exposes distinct sorted sources", () => {
    const rep = incomeReport(fixture);
    expect(rep.sources).toContain("Paychecks");
    expect(rep.sources).toContain("Interest");
    expect(rep.netByMonth.map((r) => r.month)).toEqual(["2026-01", "2026-02"]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test tests/aggregations.test.ts`
Expected: FAIL — `cashflowByMonth` is not exported from `@/lib/aggregations` (import error / `is not a function`), and `rep.netByMonth` is `undefined`.

- [ ] **Step 3: Add the `NetMonth` type and extend `IncomeReport`**

In `lib/types.ts`, replace lines 15-30:

```ts
/** Income report */
export type IncomeMonth = {
  month: string; // "YYYY-MM"
  sources: Record<string, number>;
  total: number;
};
export type IncomeSummary = {
  total: number;
  count: number;
  largest: number;
};
export type IncomeReport = {
  byMonth: IncomeMonth[];
  sources: string[]; // distinct income source display names, for chart series
  summary: IncomeSummary;
};
```

with:

```ts
/** Income report */
export type IncomeMonth = {
  month: string; // "YYYY-MM"
  sources: Record<string, number>;
  total: number;
};
export type IncomeSummary = {
  total: number;
  count: number;
  largest: number;
};
export type NetMonth = {
  month: string; // "YYYY-MM"
  income: number;
  expenses: number;
  net: number;
};
export type IncomeReport = {
  byMonth: IncomeMonth[];
  sources: string[]; // distinct income source display names, for chart series
  summary: IncomeSummary;
  netByMonth: NetMonth[];
};
```

- [ ] **Step 4: Implement `cashflowByMonth` and wire it into `incomeReport`**

In `lib/aggregations.ts`, update the type import at the top of the file to include `NetMonth`:

```ts
import type {
  Txn,
  IncomeMonth,
  IncomeSummary,
  IncomeReport,
  NetMonth,
  SpendingCategory,
  SpendingCategoryTransaction,
  SankeyData,
  CashflowStats,
  CashPlacementAccount,
  CashPlacementNudgeResult,
  SavingsRule,
  SavingsSimulationResult,
} from "@/lib/types";
```

Add `cashflowByMonth` right after `incomeByMonth` (i.e. immediately before the existing `incomeSummary` function):

```ts
/** Monthly income vs. expenses vs. net totals, sorted chronologically. */
export function cashflowByMonth(txns: Txn[]): NetMonth[] {
  const byMonth = new Map<string, NetMonth>();
  for (const t of txns) {
    const key = monthKey(t.date);
    let row = byMonth.get(key);
    if (!row) {
      row = { month: key, income: 0, expenses: 0, net: 0 };
      byMonth.set(key, row);
    }
    if (t.isIncome) row.income += t.amount;
    else row.expenses += t.amount;
    row.net = row.income - row.expenses;
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}
```

Update `incomeReport` to include the new field:

```ts
/** Full income report: monthly series + distinct sources + summary. */
export function incomeReport(txns: Txn[]): IncomeReport {
  const byMonth = incomeByMonth(txns);
  const sourceSet = new Set<string>();
  for (const m of byMonth) {
    for (const s of Object.keys(m.sources)) sourceSet.add(s);
  }
  return {
    byMonth,
    sources: [...sourceSet].sort(),
    summary: incomeSummary(txns),
    netByMonth: cashflowByMonth(txns),
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test tests/aggregations.test.ts`
Expected: PASS (all tests, including the two new/updated ones).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/aggregations.ts tests/aggregations.test.ts
git commit -m "feat: add cashflowByMonth aggregation for income vs spending chart"
```

---

### Task 2: Extract `IncomeBySourceChart` from `IncomeView`

Pure refactor — no behavior change. Moves the existing stacked-bar chart + legend out of `IncomeView.tsx` into its own file so it becomes a peer of the new chart component in Task 3.

**Files:**
- Create: `components/income/IncomeBySourceChart.tsx`
- Modify: `components/income/IncomeView.tsx`

**Interfaces:**
- Produces: `IncomeBySourceChart({ data: IncomeReport }): JSX.Element` — renders the chart `<div className="h-56 w-full">...</div>` plus the legend `<div className="mt-3 flex flex-wrap ...">...</div>`. Does NOT render the surrounding `Card` or the "Income by month" header — those stay in `IncomeView.tsx`.
- Consumes: `IncomeReport` (`lib/types.ts`), `colorMap`/`CHART` (`lib/palette.ts`), `money`/`moneyCompact`/`monthShort` (`lib/format.ts`)

- [ ] **Step 1: Create `components/income/IncomeBySourceChart.tsx`**

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { IncomeReport } from "@/lib/types";
import { colorMap, CHART } from "@/lib/palette";
import { money, moneyCompact, monthShort } from "@/lib/format";

type Row = { month: string } & Record<string, number | string>;

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {payload
        .slice()
        .reverse()
        .map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2 text-muted">
            <span
              className="inline-block h-2 w-2 rounded-sm"
              style={{ background: p.color }}
            />
            <span className="text-foreground">{p.dataKey}</span>
            <span className="ml-auto tabular-nums">{money(p.value)}</span>
          </div>
        ))}
    </div>
  );
}

export function IncomeBySourceChart({ data }: { data: IncomeReport }) {
  const colors = colorMap(data.sources);
  const rows: Row[] = data.byMonth.map((m) => ({
    month: monthShort(m.month),
    ...m.sources,
  }));

  return (
    <>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="month"
              tick={{ fill: CHART.textMuted, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: CHART.axis }}
            />
            <YAxis
              tick={{ fill: CHART.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => moneyCompact(Number(v))}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            {data.sources.map((source, i) => (
              <Bar
                key={source}
                dataKey={source}
                stackId="income"
                fill={colors[source]}
                isAnimationActive={false}
                radius={i === data.sources.length - 1 ? [4, 4, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {data.sources.map((source) => (
          <div key={source} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: colors[source] }}
            />
            <span className="text-muted">{source}</span>
          </div>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Replace `components/income/IncomeView.tsx` with the trimmed version**

Replace the entire file contents with:

```tsx
"use client";

import type { IncomeReport } from "@/lib/types";
import type { Range } from "@/components/DateRangePicker";
import { money, rangeLabel } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { IncomeBySourceChart } from "@/components/income/IncomeBySourceChart";

export function IncomeView({
  data,
  range,
}: {
  data: IncomeReport;
  range: Range;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 text-sm text-muted">Income by month</div>
        <IncomeBySourceChart data={data} />
      </Card>

      <Card>
        <div className="mb-3 text-sm text-muted">Summary</div>
        <div className="mb-3 text-xs text-muted">
          {rangeLabel(range.start, range.end)}
        </div>
        <SummaryRow label="Total income" value={money(data.summary.total)} strong />
        <SummaryRow label="Total transactions" value={String(data.summary.count)} />
        <SummaryRow label="Largest transaction" value={money(data.summary.largest)} />
      </Card>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border py-2.5 first:border-t-0">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`tabular-nums ${
          strong ? "text-base font-semibold text-foreground" : "text-sm text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build and visual output**

Run: `npm run build`
Expected: build succeeds with no type errors.

Run: `npm run dev`, open the Income tab in the browser. Confirm the chart and legend render exactly as before the refactor (no visual change expected — this step is a pure extraction).

- [ ] **Step 4: Commit**

```bash
git add components/income/IncomeBySourceChart.tsx components/income/IncomeView.tsx
git commit -m "refactor: extract IncomeBySourceChart from IncomeView"
```

---

### Task 3: `IncomeVsSpendingChart` component

**Files:**
- Create: `components/income/IncomeVsSpendingChart.tsx`

**Interfaces:**
- Produces: `IncomeVsSpendingChart({ data: IncomeReport }): JSX.Element`
- Consumes: `IncomeReport.netByMonth: NetMonth[]` (from Task 1), `CHART` tokens (`lib/palette.ts`), `money`/`moneyCompact`/`monthShort` (`lib/format.ts`)

- [ ] **Step 1: Create `components/income/IncomeVsSpendingChart.tsx`**

```tsx
"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { IncomeReport } from "@/lib/types";
import { CHART } from "@/lib/palette";
import { money, moneyCompact, monthShort } from "@/lib/format";

type Row = {
  month: string;
  income: number;
  expenses: number; // negated for display so bars diverge below zero
  net: number;
};

function TooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 text-muted">
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ background: color }}
      />
      <span className="text-foreground">{label}</span>
      <span className="ml-auto tabular-nums">{money(value)}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const income = payload.find((p: any) => p.dataKey === "income")?.value ?? 0;
  const expenses = payload.find((p: any) => p.dataKey === "expenses")?.value ?? 0;
  const net = payload.find((p: any) => p.dataKey === "net")?.value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      <TooltipRow color={CHART.positive} label="Income" value={income} />
      <TooltipRow color={CHART.negative} label="Spending" value={Math.abs(expenses)} />
      <TooltipRow color={CHART.textPrimary} label="Net income" value={net} />
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: color }}
      />
      <span className="text-muted">{label}</span>
    </div>
  );
}

export function IncomeVsSpendingChart({ data }: { data: IncomeReport }) {
  const rows: Row[] = data.netByMonth.map((m) => ({
    month: monthShort(m.month),
    income: m.income,
    expenses: -m.expenses,
    net: m.net,
  }));

  return (
    <>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="month"
              tick={{ fill: CHART.textMuted, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: CHART.axis }}
            />
            <YAxis
              tick={{ fill: CHART.textMuted, fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(v) => moneyCompact(Number(v))}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
            />
            <ReferenceLine y={0} stroke={CHART.axis} />
            <Bar
              dataKey="income"
              fill={CHART.positive}
              isAnimationActive={false}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="expenses"
              fill={CHART.negative}
              isAnimationActive={false}
              radius={[0, 0, 4, 4]}
            />
            <Line
              type="monotone"
              dataKey="net"
              stroke={CHART.textPrimary}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <LegendSwatch color={CHART.positive} label="Income" />
        <LegendSwatch color={CHART.negative} label="Spending" />
        <LegendSwatch color={CHART.textPrimary} label="Net income" />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds with no type errors. (This component isn't wired into any page yet — Task 4 does that — so there's nothing to visually check until then.)

- [ ] **Step 3: Commit**

```bash
git add components/income/IncomeVsSpendingChart.tsx
git commit -m "feat: add IncomeVsSpendingChart component"
```

---

### Task 4: Wire the chart-view toggle into `IncomeView`

**Files:**
- Modify: `components/income/IncomeView.tsx`

**Interfaces:**
- Consumes: `IncomeBySourceChart` (Task 2), `IncomeVsSpendingChart` (Task 3)

- [ ] **Step 1: Replace `components/income/IncomeView.tsx` with the toggle-enabled version**

```tsx
"use client";

import { useState } from "react";
import type { IncomeReport } from "@/lib/types";
import type { Range } from "@/components/DateRangePicker";
import { money, rangeLabel } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { IncomeBySourceChart } from "@/components/income/IncomeBySourceChart";
import { IncomeVsSpendingChart } from "@/components/income/IncomeVsSpendingChart";

type ChartView = "source" | "vsSpending";

export function IncomeView({
  data,
  range,
}: {
  data: IncomeReport;
  range: Range;
}) {
  const [view, setView] = useState<ChartView>("source");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm text-muted">
            {view === "source" ? "Income by month" : "Income vs. spending"}
          </div>
          <div className="flex rounded-full bg-surface p-1" role="tablist">
            <ViewButton
              active={view === "source"}
              onClick={() => setView("source")}
              label="By source"
            />
            <ViewButton
              active={view === "vsSpending"}
              onClick={() => setView("vsSpending")}
              label="Income vs. spending"
            />
          </div>
        </div>
        {view === "source" ? (
          <IncomeBySourceChart data={data} />
        ) : (
          <IncomeVsSpendingChart data={data} />
        )}
      </Card>

      <Card>
        <div className="mb-3 text-sm text-muted">Summary</div>
        <div className="mb-3 text-xs text-muted">
          {rangeLabel(range.start, range.end)}
        </div>
        <SummaryRow label="Total income" value={money(data.summary.total)} strong />
        <SummaryRow label="Total transactions" value={String(data.summary.count)} />
        <SummaryRow label="Largest transaction" value={money(data.summary.largest)} />
      </Card>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-surface-2 text-foreground shadow-sm"
          : "text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border py-2.5 first:border-t-0">
      <span className="text-sm text-muted">{label}</span>
      <span
        className={`tabular-nums ${
          strong ? "text-base font-semibold text-foreground" : "text-sm text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Manually verify in the browser**

Run: `npm run seed` (if not already seeded), then `npm run dev`, open the Income tab.

Confirm:
- Default view is "By source" (stacked chart, matches pre-existing behavior).
- Clicking "Income vs. spending" swaps to the new chart: green bars above the zero line, red bars below it, a white net-income line overlaid, and a 3-item legend (Income / Spending / Net income).
- Hovering a month in the new chart shows a tooltip with Income, Spending, and Net income as positive dollar amounts (no negative numbers shown).
- Switching back to "By source" restores the original chart.
- The Summary card below is unchanged in both views.

- [ ] **Step 4: Commit**

```bash
git add components/income/IncomeView.tsx
git commit -m "feat: add chart-view toggle to Income page"
```

---

### Task 5: Update the Income screen doc

**Files:**
- Modify: `claudemd/screens/income.md`

- [ ] **Step 1: Update `claudemd/screens/income.md`**

Replace the `## Key Files` section with:

```markdown
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
```

Replace the `## Layout / UI Spec` section with:

```markdown
## Layout / UI Spec

Two cards: chart card, then summary card (date range label, 3 rows: Total
income (bold), Total transactions, Largest transaction). One primary value:
Total income, bolded in the summary.

The chart card has a pill toggle in its header switching between two chart
views: "By source" (stacked bar per income source + legend) and "Income vs.
spending" (diverging income/spending bars with a net income line + 3-item
legend). Toggle state is local and resets on remount — not persisted across
date-range changes or reloads.
```

Replace the `## Data Contract` section with:

```markdown
## Data Contract

`IncomeReport` (`lib/types.ts:26`) = `{ byMonth: IncomeMonth[], sources:
string[], summary: IncomeSummary, netByMonth: NetMonth[] }`.
```

Replace the `## How to Verify` section with:

```markdown
## How to Verify

`npm test tests/aggregations.test.ts` covers `incomeSummary` and
`cashflowByMonth`. Visually confirm both chart views (bar stacking/legend,
and the income-vs-spending toggle) against seeded data: `npm run seed`,
then open the Income tab and try both toggle options.
```

- [ ] **Step 2: Commit**

```bash
git add claudemd/screens/income.md
git commit -m "docs: update income screen doc for chart-view toggle"
```
