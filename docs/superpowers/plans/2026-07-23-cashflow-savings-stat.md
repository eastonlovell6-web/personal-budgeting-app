# Cash Flow Savings Stat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Savings" stat card next to the existing "Investing" card on the Cash Flow screen so the user can compare savings vs. investing at a glance.

**Architecture:** `cashflowStats()` gains a `savings` field computed as `net - investing`, floored at 0 (same formula already used to size the Sankey's "Savings" leaf). `StatRow` renders it as a stat card alongside "Investing" in its existing 2-column grid, replacing the old full-width "Investing"-only card.

**Tech Stack:** TypeScript, Next.js App Router, Vitest, Tailwind v4.

## Global Constraints

- Money values render via `lib/format.ts` (`money`, `money0`) — never format currency inline.
- Dark theme tokens only (`CHART.*` from `lib/palette.ts`) — no hardcoded colors.
- Additive data contract change only — `CashflowStats` gains a field, no existing fields change shape.

---

### Task 1: Add `savings` to `CashflowStats`

**Files:**
- Modify: `lib/types.ts:56-62` (`CashflowStats` type)
- Modify: `lib/aggregations.ts:107-117` (`cashflowStats()`)
- Test: `tests/aggregations.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CashflowStats.savings: number` — `Math.max(0, net - investingTotal)`. Later tasks (Task 2) read `stats.savings`.

- [ ] **Step 1: Write the failing tests**

Add to `tests/aggregations.test.ts`, right after the existing "cashflow stats include the investing total and default to 0" test (currently ending at line 138):

```ts
  it("cashflow stats compute savings as net minus investing, floored at 0", () => {
    const noInvesting = cashflowStats(fixture);
    expect(noInvesting.savings).toBe(5630); // net with no investing

    const someInvesting = cashflowStats(fixture, 1000);
    expect(someInvesting.savings).toBe(4630); // 5630 net - 1000 invested

    const overInvested = cashflowStats(fixture, 6000);
    expect(overInvested.savings).toBe(0); // invested more than net; floors at 0
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test tests/aggregations.test.ts`
Expected: FAIL — `savings` is `undefined`, `expect(undefined).toBe(5630)` fails.

- [ ] **Step 3: Add `savings` to the `CashflowStats` type**

In `lib/types.ts`, change:

```ts
export type CashflowStats = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  investing: number;
};
```

to:

```ts
export type CashflowStats = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  investing: number;
  savings: number;
};
```

- [ ] **Step 4: Compute `savings` in `cashflowStats()`**

In `lib/aggregations.ts`, change:

```ts
export function cashflowStats(txns: Txn[], investingTotal = 0): CashflowStats {
  let income = 0;
  let expenses = 0;
  for (const t of txns) {
    if (t.isIncome) income += t.amount;
    else expenses += t.amount;
  }
  const net = income - expenses;
  const savingsRate = income > 0 ? net / income : 0;
  return { income, expenses, net, savingsRate, investing: investingTotal };
}
```

to:

```ts
export function cashflowStats(txns: Txn[], investingTotal = 0): CashflowStats {
  let income = 0;
  let expenses = 0;
  for (const t of txns) {
    if (t.isIncome) income += t.amount;
    else expenses += t.amount;
  }
  const net = income - expenses;
  const savingsRate = income > 0 ? net / income : 0;
  const savings = Math.max(0, net - investingTotal);
  return { income, expenses, net, savingsRate, investing: investingTotal, savings };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test tests/aggregations.test.ts`
Expected: PASS — all tests including the three new `savings` assertions.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/aggregations.ts tests/aggregations.test.ts
git commit -m "feat: compute savings (net minus investing) in cashflowStats"
```

---

### Task 2: Show Savings next to Investing in `StatRow`

**Files:**
- Modify: `components/cashflow/StatRow.tsx`
- Modify: `claudemd/screens/cashflow.md`

**Interfaces:**
- Consumes: `CashflowStats.savings` (produced by Task 1).
- Produces: nothing consumed by later tasks — this is the final task.

- [ ] **Step 1: Update `StatRow.tsx` to render Savings and Investing as grid cards**

Replace the full contents of `components/cashflow/StatRow.tsx` with:

```tsx
import type { CashflowStats } from "@/lib/types";
import { money0 } from "@/lib/format";
import { CHART } from "@/lib/palette";

export function StatRow({ stats }: { stats: CashflowStats }) {
  const items = [
    { label: "Total income", value: money0(stats.income), color: CHART.positive },
    { label: "Total expenses", value: money0(stats.expenses), color: CHART.negative },
    { label: "Net income", value: money0(stats.net), color: stats.net >= 0 ? CHART.positive : CHART.negative },
    { label: "Savings rate", value: `${(stats.savingsRate * 100).toFixed(1)}%`, color: CHART.textPrimary },
    { label: "Savings", value: money0(stats.savings), color: CHART.textPrimary },
    { label: "Investing", value: money0(stats.investing), color: CHART.textPrimary },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((it) => (
        <div key={it.label} className="rounded-xl border border-border bg-surface p-3">
          <div className="text-xs text-muted">{it.label}</div>
          <div
            className="mt-1 text-lg font-semibold tabular-nums"
            style={{ color: it.color }}
          >
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}
```

This removes the old full-width "Investing"-only card and folds both "Savings" and "Investing" into the same 2-column grid as the other four stats, so they land side by side as the grid's third row.

- [ ] **Step 2: Verify the build type-checks**

Run: `npm run build`
Expected: build succeeds with no type errors (`CashflowStats.savings` exists per Task 1, `StatRow` compiles).

- [ ] **Step 3: Update the screen doc**

In `claudemd/screens/cashflow.md`, change line 18-19:

```
- `components/cashflow/StatRow.tsx:5` — 4-stat grid: Total income, Total
  expenses, Net income (colored by sign), Savings rate %.
```

to:

```
- `components/cashflow/StatRow.tsx:5` — 6-stat grid: Total income, Total
  expenses, Net income (colored by sign), Savings rate %, Savings
  (net minus investing, floored at $0), Investing.
```

And change the Layout/UI Spec section (line 33):

```
`StatRow` (2x2 grid of stat cards) above a Sankey card; each Sankey node is
labeled with name + amount + percentage of the Income hub total; links are
colored by target node, translucent.
```

to:

```
`StatRow` (2-column grid, 6 stat cards) above a Sankey card; each Sankey
node is labeled with name + amount + percentage of the Income hub total;
links are colored by target node, translucent.
```

- [ ] **Step 4: Manually verify in the browser**

Run: `npm run dev`, open the Cash Flow tab.
Expected: the stat grid shows six cards — Total income, Total expenses, Net income, Savings rate, Savings, Investing — with Savings and Investing landing side by side in the last row.

- [ ] **Step 5: Commit**

```bash
git add components/cashflow/StatRow.tsx claudemd/screens/cashflow.md
git commit -m "feat: show Savings stat next to Investing on Cash Flow"
```
