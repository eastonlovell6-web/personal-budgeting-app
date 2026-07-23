# Spending Category Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a category row on the Spending screen expands it inline to show that category's transactions for the selected date range, newest first.

**Architecture:** A new pure aggregation function filters/sorts transactions down to one category; a new lazy-loaded API route serves it; `SpendingView` tracks one expanded category (accordion) and a per-category fetch cache, keyed to the current date range.

**Tech Stack:** Next.js App Router API routes, Prisma, React (client component) state, Vitest.

## Global Constraints

- v1 reports stay read-only — no editing/re-categorization UI (`claudemd/screens/spending.md`).
- Money via `lib/format.ts`'s `money()` — never format currency inline.
- Dark theme tokens only — no hardcoded colors.
- Only one category expanded at a time (accordion), no pagination within a category.

---

### Task 1: `transactionsForCategory` aggregation + type

**Files:**
- Modify: `lib/types.ts` (add type, after the existing `SpendingReport` block, `lib/types.ts:39`)
- Modify: `lib/aggregations.ts` (add function, after `spendingByCategory`, `lib/aggregations.ts:90`)
- Test: `tests/aggregations.test.ts`

**Interfaces:**
- Consumes: `Txn` (`lib/types.ts:4-12`) — existing shape, no changes.
- Produces: `SpendingCategoryTransaction` type `{ transactionId: string; date: string; name: string; amount: number }`; `transactionsForCategory(txns: Txn[], detailed: string): SpendingCategoryTransaction[]` — used by Task 2's API route.

- [ ] **Step 1: Write the failing test**

Add to `tests/aggregations.test.ts`, right after the existing `"spending groups by category desc, income excluded"` test (after line 73):

```ts
  it("transactionsForCategory filters to one category, sorts newest first", () => {
    const rows = transactionsForCategory(fixture, "FOOD_AND_DRINK_GROCERIES");
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("x");
    expect(rows[0].amount).toBe(300);

    const rentAndFood = [
      ...fixture,
      t({
        pfPrimary: "FOOD_AND_DRINK",
        pfDetailed: "FOOD_AND_DRINK_GROCERIES",
        amount: 45,
        date: new Date("2026-01-20"),
        merchantName: "Trader Joe's",
      }),
    ];
    const multi = transactionsForCategory(rentAndFood, "FOOD_AND_DRINK_GROCERIES");
    expect(multi).toHaveLength(2);
    // newest first
    expect(multi[0].date).toBe("2026-01-20");
    expect(multi[0].name).toBe("Trader Joe's");
    expect(multi[1].date).toBe("2026-01-10");

    expect(transactionsForCategory(fixture, "INCOME_WAGES")).toHaveLength(0);
  });
```

Also update the import at the top of `tests/aggregations.test.ts` (line 2-12) to include `transactionsForCategory`:

```ts
import {
  incomeByMonth,
  incomeSummary,
  incomeReport,
  spendingByCategory,
  transactionsForCategory,
  cashflowSankey,
  cashflowStats,
  investingSummary,
  cashPlacementNudge,
  savingsRulesSimulation,
} from "@/lib/aggregations";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/aggregations.test.ts`
Expected: FAIL — `transactionsForCategory is not a function` (or import error).

- [ ] **Step 3: Add the type**

In `lib/types.ts`, immediately after the `SpendingReport` type (after `lib/types.ts:39`, the closing `};` of `SpendingReport`):

```ts
export type SpendingCategoryTransaction = {
  transactionId: string;
  date: string; // ISO date, e.g. "2026-01-20"
  name: string; // merchantName ?? name, resolved here
  amount: number;
};
```

- [ ] **Step 4: Implement `transactionsForCategory`**

In `lib/aggregations.ts`, add `isoDate` to the existing `lib/reports`-adjacent imports — at the top of the file, change line 2-16 imports to also pull in `isoDate`:

```ts
import { categoryInfo, GROUPS } from "@/lib/categories";
import { isoDate } from "@/lib/format";
import type {
  Txn,
  IncomeMonth,
  IncomeSummary,
  IncomeReport,
  SpendingCategory,
  SpendingCategoryTransaction,
  SankeyData,
  CashflowStats,
  InvestmentAccount,
  InvestingSummary,
  CashPlacementAccount,
  CashPlacementNudgeResult,
  SavingsRule,
  SavingsSimulationResult,
} from "@/lib/types";
```

Then add the function right after `spendingByCategory` ends (after `lib/aggregations.ts:90`, before the `/** Top-level cash flow numbers. */` comment):

```ts
/** One category's transactions, newest first — powers the Spending drill-down. */
export function transactionsForCategory(
  txns: Txn[],
  detailed: string
): SpendingCategoryTransaction[] {
  return txns
    .filter((t) => !t.isIncome && t.pfDetailed === detailed)
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((t) => ({
      transactionId: t.transactionId,
      date: isoDate(t.date),
      name: t.merchantName ?? t.name,
      amount: t.amount,
    }));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/aggregations.test.ts`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/aggregations.ts tests/aggregations.test.ts
git commit -m "feat: add transactionsForCategory aggregation for spending drill-down"
```

---

### Task 2: API route `/api/reports/spending/transactions`

**Files:**
- Create: `app/api/reports/spending/transactions/route.ts`

**Interfaces:**
- Consumes: `parseRange`, `loadTxns` (`lib/reports.ts`, unchanged); `transactionsForCategory` (Task 1).
- Produces: `GET /api/reports/spending/transactions?start=&end=&category=` → `SpendingCategoryTransaction[]` JSON, or `400 { error }` if `category` is missing. Consumed by Task 4's `SpendingView` fetch.

- [ ] **Step 1: Implement the route**

```ts
import { NextResponse } from "next/server";
import { parseRange, loadTxns } from "@/lib/reports";
import { transactionsForCategory } from "@/lib/aggregations";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }
  const { start, end } = parseRange(req.url);
  const txns = await loadTxns(start, end);
  const transactions = transactionsForCategory(txns, category);
  return NextResponse.json(transactions);
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev` (if not already running), then in another terminal:

```bash
curl "http://localhost:3000/api/reports/spending/transactions?start=2026-01-01&end=2026-06-30&category=FOOD_AND_DRINK_GROCERIES"
```

Expected: a JSON array of transactions (or `[]` if seed data has none in range for that category — try `npm run seed` first if the DB is empty). Also verify the 400 path:

```bash
curl -i "http://localhost:3000/api/reports/spending/transactions?start=2026-01-01&end=2026-06-30"
```

Expected: `HTTP/1.1 400` with `{"error":"category is required"}`.

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/spending/transactions/route.ts
git commit -m "feat: add spending transactions-by-category API route"
```

---

### Task 3: `dayShort` date formatter

**Files:**
- Modify: `lib/format.ts` (add after `monthShort`, `lib/format.ts:34-39`)

**Interfaces:**
- Produces: `dayShort(d: Date): string` — used by Task 4's `TransactionRow`.

- [ ] **Step 1: Implement**

In `lib/format.ts`, immediately after the `monthShort` function:

```ts
/** Date -> "Jul 18" (short date label for transaction rows). */
export function dayShort(d: Date): string {
  return d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
```

- [ ] **Step 2: Verify visually in Task 4**

No dedicated test here — `monthShort`/`rangeLabel` in the same file have no
unit tests either, and this one-liner has no branching logic. Its output
is confirmed visually in Task 4's manual verification (transaction rows
show dates like "Jul 18").

- [ ] **Step 3: Commit**

```bash
git add lib/format.ts
git commit -m "feat: add dayShort date formatter"
```

---

### Task 4: Wire up `SpendingView` drill-down UI

**Files:**
- Modify: `app/page.tsx:135` (pass `range` prop)
- Modify: `components/spending/SpendingView.tsx` (accordion state, fetch, new `TransactionRow`)

**Interfaces:**
- Consumes: `SpendingCategoryTransaction` (Task 1), `GET /api/reports/spending/transactions` (Task 2), `dayShort` (Task 3), `Range` (`components/DateRangePicker.tsx:5`), `isoDate` (`lib/format.ts`, existing).
- Produces: none consumed elsewhere — this is the leaf UI.

- [ ] **Step 1: Pass `range` into `SpendingView`**

In `app/page.tsx`, change line 135 from:

```tsx
        <SpendingView data={data as SpendingReport} />
```

to:

```tsx
        <SpendingView data={data as SpendingReport} range={range} />
```

- [ ] **Step 2: Rewrite `components/spending/SpendingView.tsx`**

Replace the full file contents with:

```tsx
"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type {
  SpendingReport,
  SpendingCategory,
  SpendingCategoryTransaction,
} from "@/lib/types";
import { CATEGORICAL, OTHER_COLOR } from "@/lib/palette";
import { money, dayShort, isoDate } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import type { Range } from "@/components/DateRangePicker";

const TOP_N = 8;

function DonutTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <span className="text-foreground">{p.name}</span>
      <span className="ml-2 tabular-nums text-muted">{money(p.value)}</span>
    </div>
  );
}

export function SpendingView({ data, range }: { data: SpendingReport; range: Range }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [txnCache, setTxnCache] = useState<
    Map<string, SpendingCategoryTransaction[] | "loading">
  >(new Map());

  // Collapse and drop cached transactions whenever the selected date range
  // changes — the cache is keyed by category only, so a stale list for the
  // old range must not be shown.
  const rangeKey = `${isoDate(range.start)}|${isoDate(range.end)}`;
  useEffect(() => {
    setExpandedCategory(null);
    setTxnCache(new Map());
  }, [rangeKey]);

  function toggleCategory(detailed: string) {
    if (expandedCategory === detailed) {
      setExpandedCategory(null);
      return;
    }
    setExpandedCategory(detailed);
    if (txnCache.has(detailed)) return;

    setTxnCache((m) => new Map(m).set(detailed, "loading"));
    const qs = `?start=${isoDate(range.start)}&end=${isoDate(range.end)}&category=${encodeURIComponent(detailed)}`;
    fetch(`/api/reports/spending/transactions${qs}`)
      .then((res) => res.json())
      .then((txns: SpendingCategoryTransaction[]) => {
        setTxnCache((m) => new Map(m).set(detailed, txns));
      })
      .catch(() => {
        setTxnCache((m) => {
          const next = new Map(m);
          next.delete(detailed);
          return next;
        });
      });
  }

  // Donut: top N distinct slices + a folded "Other".
  const top = data.categories.slice(0, TOP_N);
  const tail = data.categories.slice(TOP_N);
  const tailTotal = tail.reduce((s, c) => s + c.amount, 0);
  const slices = [
    ...top.map((c, i) => ({ name: c.display, value: c.amount, color: CATEGORICAL[i] })),
    ...(tailTotal > 0 ? [{ name: "Other", value: tailTotal, color: OTHER_COLOR }] : []),
  ];

  const visible = expanded ? data.categories : data.categories.slice(0, TOP_N);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="relative mx-auto h-60 w-60">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={2}
                stroke={"var(--surface)"}
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-semibold tabular-nums">
              {money(data.total)}
            </div>
            <div className="text-xs text-muted">Total</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col">
          {visible.map((c, i) => (
            <CategoryRow
              key={c.detailed}
              category={c}
              color={i < TOP_N ? CATEGORICAL[i] : OTHER_COLOR}
              total={data.total}
              expanded={expandedCategory === c.detailed}
              onToggle={() => toggleCategory(c.detailed)}
              transactions={txnCache.get(c.detailed)}
            />
          ))}
        </div>
        {data.categories.length > TOP_N && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 w-full py-2 text-center text-sm font-medium text-accent"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </Card>
    </div>
  );
}

function CategoryRow({
  category,
  color,
  total,
  expanded,
  onToggle,
  transactions,
}: {
  category: SpendingCategory;
  color: string;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  transactions: SpendingCategoryTransaction[] | "loading" | undefined;
}) {
  const pct = total > 0 ? (category.amount / total) * 100 : 0;
  return (
    <div className="border-t border-border first:border-t-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 py-2.5 text-left"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm"
          style={{ background: color + "22" }}
        >
          {category.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm text-foreground">{category.display}</div>
          <div className="text-xs text-muted">{pct.toFixed(1)}%</div>
        </div>
        <div className="tabular-nums text-sm text-foreground">
          {money(category.amount)}
        </div>
      </button>
      {expanded && (
        <div className="flex flex-col pb-2.5 pl-11">
          {transactions === "loading" || transactions === undefined ? (
            <div className="py-1.5 text-xs text-muted">Loading…</div>
          ) : (
            transactions.map((t) => <TransactionRow key={t.transactionId} txn={t} />)
          )}
        </div>
      )}
    </div>
  );
}

function TransactionRow({ txn }: { txn: SpendingCategoryTransaction }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-12 shrink-0 text-xs text-muted">{dayShort(new Date(txn.date))}</div>
      <div className="min-w-0 flex-1 truncate text-sm text-foreground">{txn.name}</div>
      <div className="tabular-nums text-sm text-muted">{money(txn.amount)}</div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS (all existing tests plus Task 1's new test).

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, open `http://localhost:3000`, go to the Spending tab.

- Tap a category row: it expands below with its transactions, newest first, each showing date/name/amount.
- Tap it again: it collapses.
- Tap a different category: the first collapses, the new one expands (accordion — only one open at a time).
- Change the date range while one is expanded: it collapses (no stale data shown for the old range).
- Confirm the donut and "Show more" button behave exactly as before.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/spending/SpendingView.tsx
git commit -m "feat: add transaction drill-down to spending category rows"
```
