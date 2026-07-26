# Category Budgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Goals tab's savings-target buckets with category budgets — a monthly cap per spending category (or whole category group), showing Budget / Actual / Remaining, where Actual is computed automatically from real Plaid transactions.

**Architecture:** One Prisma model (`CategoryBudget`) replaces `Goal`. A budget's `categoryKey` is either a bare Plaid detailed category code or a `GROUP:`-prefixed group name, letting one budget cover either a single category (e.g. "Groceries") or a whole group (e.g. "Shopping", which spans 12 detailed codes). `GET /api/budgets` computes the current calendar month's actual spend per budget at read time — no stored/cached actuals. The Goals tab id/label/color in `components/ReportTabs.tsx` are unchanged; only its content changes.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma (SQLite dev), Vitest.

## Global Constraints

- Money formatting via `lib/format.ts`'s `money0` only — never format currency inline.
- Dark/light theme tokens (`app/globals.css` CSS custom properties) — never hardcode colors; use `var(--token)` or existing Tailwind utility classes.
- Single-user app — no multi-tenant logic, no auth changes.
- The existing `Goal` table and its data are dropped by this plan's migration (per approved spec) — this is intentional, not a bug.
- The Goals tab is always scoped to the **current calendar month**, ignoring the app-wide `DateRangePicker` — its query params are still sent for `ENDPOINT`/`load()` consistency but the budgets API route ignores them.

---

### Task 1: Category/group budget helpers in `lib/categories.ts`

**Files:**
- Modify: `lib/categories.ts` (append after line 186, the end of the file)
- Test: `tests/categories.test.ts` (append a new `describe` block)

**Interfaces:**
- Produces: `GROUP_PREFIX: string`, `GROUP_EMOJI: Record<string, string>`, `categoryOrGroupInfo(key: string): { display: string; emoji: string }`, `budgetableOptions(): { key: string; display: string; emoji: string }[]` — all exported from `lib/categories.ts`. Consumed by Task 2 (`GROUP_PREFIX` in `lib/aggregations.ts`), Task 5 (API routes, for validation + display resolution), Task 6 (`GoalsView.tsx`, for preset/custom-picker labels).
- Consumes: existing `categoryInfo`, `GROUPS`, and the module-private `MAP` (already in scope in this file).

- [ ] **Step 1: Write the failing tests**

Add to the end of `tests/categories.test.ts` (extend the existing import list at the top of the file to include the new names):

```ts
import {
  categoryInfo,
  isIncomeCategory,
  isTransfer,
  isInvestmentTransferCategory,
  GROUPS,
  GROUP_PREFIX,
  categoryOrGroupInfo,
  budgetableOptions,
} from "@/lib/categories";
```

Then append this new block after the existing `describe("categories", ...)` block's closing `});`:

```ts
describe("category/group budget helpers", () => {
  it("resolves a bare detailed category the same as categoryInfo", () => {
    const info = categoryOrGroupInfo("FOOD_AND_DRINK_GROCERIES");
    expect(info.display).toBe("Groceries");
    expect(info.emoji).toBe("🍎");
  });

  it("resolves a GROUP: key to the group name with a group emoji", () => {
    const info = categoryOrGroupInfo(`${GROUP_PREFIX}Shopping`);
    expect(info.display).toBe("Shopping");
    expect(info.emoji).toBe("🛍️");
  });

  it("falls back gracefully for an unknown group", () => {
    const info = categoryOrGroupInfo(`${GROUP_PREFIX}NotARealGroup`);
    expect(info.display).toBe("NotARealGroup");
    expect(info.emoji).toBeTruthy();
  });

  it("lists one option per non-Income group plus one per non-Income detailed category", () => {
    const options = budgetableOptions();
    const groupOptions = options.filter((o) => o.key.startsWith(GROUP_PREFIX));
    expect(groupOptions.length).toBe(GROUPS.length - 1);
    expect(options.some((o) => o.key === "FOOD_AND_DRINK_GROCERIES")).toBe(true);
    expect(options.some((o) => o.key.startsWith("INCOME"))).toBe(false);
    expect(options.some((o) => o.key === `${GROUP_PREFIX}Income`)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/categories.test.ts`
Expected: FAIL — `GROUP_PREFIX`/`categoryOrGroupInfo`/`budgetableOptions` are not exported from `@/lib/categories`.

- [ ] **Step 3: Write the minimal implementation**

Append to the end of `lib/categories.ts` (after the existing `isInvestmentTransferCategory` function, which currently ends the file at line 186):

```ts

/** Prefix distinguishing a whole-group budget key from a bare detailed-category key. */
export const GROUP_PREFIX = "GROUP:";

const GROUP_EMOJI: Record<string, string> = {
  Housing: "🏠",
  "Bills & Utilities": "🧾",
  "Food & Dining": "🍴",
  Transportation: "🚙",
  Shopping: "🛍️",
  "Travel & Vacation": "✈️",
  Entertainment: "🎭",
  "Health & Wellness": "⚕️",
  Other: "📦",
};

/** Resolve a budget's categoryKey (bare detailed code or GROUP:-prefixed) to display metadata. */
export function categoryOrGroupInfo(key: string): { display: string; emoji: string } {
  if (key.startsWith(GROUP_PREFIX)) {
    const group = key.slice(GROUP_PREFIX.length);
    return { display: group, emoji: GROUP_EMOJI[group] ?? "💰" };
  }
  const info = categoryInfo(key);
  return { display: info.display, emoji: info.emoji };
}

/** Every valid budget target: one per non-Income group, one per non-Income detailed category. */
export function budgetableOptions(): { key: string; display: string; emoji: string }[] {
  const groupOptions = GROUPS.filter((g) => g !== "Income").map((g) => ({
    key: `${GROUP_PREFIX}${g}`,
    display: g,
    emoji: GROUP_EMOJI[g] ?? "💰",
  }));
  const categoryOptions = Object.entries(MAP)
    .filter(([, info]) => info.group !== "Income")
    .map(([key, info]) => ({ key, display: info.display, emoji: info.emoji }));
  return [...groupOptions, ...categoryOptions];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/categories.test.ts`
Expected: PASS (all tests, including the pre-existing ones in this file).

- [ ] **Step 5: Commit**

```bash
git add lib/categories.ts tests/categories.test.ts
git commit -m "feat: add category/group budget helpers"
```

---

### Task 2: `budgetActual` aggregation in `lib/aggregations.ts`

**Files:**
- Modify: `lib/aggregations.ts:2` (import line) and end of file
- Test: `tests/aggregations.test.ts`

**Interfaces:**
- Consumes: `GROUP_PREFIX` (Task 1), existing `categoryInfo` (already imported in this file), `Txn` type (existing).
- Produces: `budgetActual(txns: Txn[], categoryKey: string): number`, consumed by Task 5's `GET /api/budgets` route.

- [ ] **Step 1: Write the failing test**

Append to `tests/aggregations.test.ts` (add `budgetActual` to the existing import from `@/lib/aggregations`, and reuse the file's existing `t()` fixture helper and `fixture` array — do not redefine them):

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
  budgetActual,
} from "@/lib/aggregations";
```

Append this block at the end of the file, inside the existing `describe("aggregations", ...)` block (add it as a new top-level `describe` after that block's closing, to keep it self-contained):

```ts
describe("budgetActual", () => {
  it("sums only matching non-income transactions for a bare detailed key", () => {
    expect(budgetActual(fixture, "FOOD_AND_DRINK_GROCERIES")).toBe(300);
  });

  it("sums across every detailed category sharing a group for a GROUP: key", () => {
    // Food & Dining group = Groceries (300) + Restaurants (120) in the shared fixture
    expect(budgetActual(fixture, "GROUP:Food & Dining")).toBe(420);
  });

  it("never counts income toward a budget", () => {
    expect(budgetActual(fixture, "GROUP:Income")).toBe(0);
  });

  it("returns 0 for an empty transaction list", () => {
    expect(budgetActual([], "FOOD_AND_DRINK_GROCERIES")).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/aggregations.test.ts`
Expected: FAIL — `budgetActual` is not exported from `@/lib/aggregations`.

- [ ] **Step 3: Write the minimal implementation**

In `lib/aggregations.ts`, change the import on line 2 from:

```ts
import { categoryInfo, GROUPS } from "@/lib/categories";
```

to:

```ts
import { categoryInfo, GROUPS, GROUP_PREFIX } from "@/lib/categories";
```

Then append this function at the end of the file:

```ts

/** Current-month actual spend for a budget's category or group key. */
export function budgetActual(txns: Txn[], categoryKey: string): number {
  const inScope = categoryKey.startsWith(GROUP_PREFIX)
    ? (t: Txn) => categoryInfo(t.pfDetailed).group === categoryKey.slice(GROUP_PREFIX.length)
    : (t: Txn) => t.pfDetailed === categoryKey;
  return txns.reduce((sum, t) => (!t.isIncome && inScope(t) ? sum + t.amount : sum), 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/aggregations.test.ts`
Expected: PASS (all tests, including the pre-existing ones in this file).

- [ ] **Step 5: Commit**

```bash
git add lib/aggregations.ts tests/aggregations.test.ts
git commit -m "feat: add budgetActual aggregation for category/group budgets"
```

---

### Task 3: `currentMonthRange` helper in `lib/reports.ts`

**Files:**
- Modify: `lib/reports.ts` (end of file)
- Test: `tests/reports.test.ts` (new file)

**Interfaces:**
- Produces: `currentMonthRange(now?: Date): { start: Date; end: Date }`, consumed by Task 5's `GET /api/budgets` route.

- [ ] **Step 1: Write the failing test**

Create `tests/reports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { currentMonthRange } from "@/lib/reports";

describe("currentMonthRange", () => {
  it("returns the first and last instant of the given month in UTC", () => {
    const { start, end } = currentMonthRange(new Date("2026-02-15T12:00:00.000Z"));
    expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });

  it("handles a leap-year February and December year rollover", () => {
    const leap = currentMonthRange(new Date("2028-02-10T00:00:00.000Z"));
    expect(leap.end.toISOString()).toBe("2028-02-29T23:59:59.999Z");

    const dec = currentMonthRange(new Date("2026-12-25T00:00:00.000Z"));
    expect(dec.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(dec.end.toISOString()).toBe("2026-12-31T23:59:59.999Z");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/reports.test.ts`
Expected: FAIL — `Cannot find module` or `currentMonthRange is not exported`.

- [ ] **Step 3: Write the minimal implementation**

Append to the end of `lib/reports.ts`:

```ts

/** [start, end] of the calendar month containing `now`, in UTC. Defaults to the real current time. */
export function currentMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999)
  );
  return { start, end };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/reports.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/reports.ts tests/reports.test.ts
git commit -m "feat: add currentMonthRange helper"
```

---

### Task 4: Replace the `Goal` data model with `CategoryBudget`

**Files:**
- Modify: `prisma/schema.prisma:64-70`
- Modify: `lib/types.ts:123-129`

**Interfaces:**
- Produces: Prisma model `CategoryBudget` (fields: `id`, `categoryKey` (unique), `monthlyAmount`, `createdAt`) and TypeScript type `CategoryBudget` (`id`, `categoryKey`, `display`, `emoji`, `monthlyAmount`, `actualAmount`) from `lib/types.ts`. Consumed by Task 5 (API routes) and Task 6 (`app/page.tsx`, `GoalsView.tsx`).
- Removes: Prisma model `Goal` and TypeScript type `Goal`.

- [ ] **Step 1: Replace the Prisma model**

In `prisma/schema.prisma`, replace:

```prisma
model Goal {
  id            String   @id @default(cuid())
  name          String
  targetAmount  Float
  currentAmount Float    @default(0)
  createdAt     DateTime @default(now())
}
```

with:

```prisma
model CategoryBudget {
  id            String   @id @default(cuid())
  categoryKey   String   @unique
  monthlyAmount Float
  createdAt     DateTime @default(now())
}
```

- [ ] **Step 2: Run the migration**

Run: `npx prisma migrate dev --name replace_goal_with_category_budget`
Expected: Prisma reports the `Goal` table dropped and `CategoryBudget` table created; exits successfully. (This deletes any existing `Goal` rows in the dev SQLite database — expected per the approved spec.)

- [ ] **Step 3: Replace the TypeScript type**

In `lib/types.ts`, replace:

```ts
/** Goals (Savings Buckets) */
export type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
};
```

with:

```ts
/** Category Budgets */
export type CategoryBudget = {
  id: string;
  categoryKey: string;
  display: string;
  emoji: string;
  monthlyAmount: number;
  actualAmount: number;
};
```

- [ ] **Step 4: Run the type checker**

Run: `npx tsc --noEmit`
Expected: FAILS — `app/api/goals/route.ts`, `app/api/goals/[id]/route.ts`, and `app/page.tsx` all still reference `prisma.goal` / the `Goal` type, which no longer exist. This is expected at this point in the plan; Tasks 5 and 6 fix these files. Confirm the errors are exactly in those three files and nowhere else before moving on.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/types.ts
git commit -m "feat: replace Goal model with CategoryBudget"
```

---

### Task 5: `/api/budgets` routes

**Files:**
- Create: `app/api/budgets/route.ts`
- Create: `app/api/budgets/[id]/route.ts`
- Delete: `app/api/goals/route.ts`
- Delete: `app/api/goals/[id]/route.ts`

**Interfaces:**
- Consumes: `currentMonthRange` (Task 3), `loadTxns` (existing, `lib/reports.ts`), `budgetActual` (Task 2), `budgetableOptions`/`categoryOrGroupInfo` (Task 1), `CategoryBudget` type (Task 4), `prisma.categoryBudget` (Task 4's migration).
- Produces: `GET /api/budgets` → `CategoryBudget[]`; `POST /api/budgets` body `{ categoryKey, monthlyAmount }` → created row; `PATCH /api/budgets/:id` body `{ monthlyAmount }` → updated row; `DELETE /api/budgets/:id` → `{ ok: true }`. Consumed by Task 6.

- [ ] **Step 1: Delete the old goals routes**

```bash
git rm app/api/goals/route.ts app/api/goals/[id]/route.ts
```

(If the `[id]` directory becomes empty, it's removed automatically by `git rm`; if not, remove the now-empty `app/api/goals` directory manually.)

- [ ] **Step 2: Create `app/api/budgets/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentMonthRange, loadTxns } from "@/lib/reports";
import { budgetActual } from "@/lib/aggregations";
import { budgetableOptions, categoryOrGroupInfo } from "@/lib/categories";
import type { CategoryBudget } from "@/lib/types";

function validateNewBudget(body: {
  categoryKey?: unknown;
  monthlyAmount?: unknown;
}): string | null {
  if (typeof body.categoryKey !== "string" || body.categoryKey.trim() === "") {
    return "categoryKey must be a non-empty string";
  }
  if (!budgetableOptions().some((o) => o.key === body.categoryKey)) {
    return "categoryKey is not a recognized category or group";
  }
  if (typeof body.monthlyAmount !== "number" || body.monthlyAmount <= 0) {
    return "monthlyAmount must be a number greater than 0";
  }
  return null;
}

export async function GET() {
  const { start, end } = currentMonthRange();
  const txns = await loadTxns(start, end);
  const rows = await prisma.categoryBudget.findMany({ orderBy: { createdAt: "asc" } });

  const budgets: CategoryBudget[] = rows.map((r) => {
    const { display, emoji } = categoryOrGroupInfo(r.categoryKey);
    return {
      id: r.id,
      categoryKey: r.categoryKey,
      display,
      emoji,
      monthlyAmount: r.monthlyAmount,
      actualAmount: budgetActual(txns, r.categoryKey),
    };
  });

  return NextResponse.json(budgets);
}

export async function POST(req: Request) {
  const body = await req.json();
  const error = validateNewBudget(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  try {
    const created = await prisma.categoryBudget.create({
      data: {
        categoryKey: body.categoryKey,
        monthlyAmount: body.monthlyAmount,
      },
    });
    return NextResponse.json(created);
  } catch (e) {
    if (typeof e === "object" && e !== null && "code" in e && e.code === "P2002") {
      return NextResponse.json(
        { error: "A budget for this category already exists" },
        { status: 400 }
      );
    }
    throw e;
  }
}
```

- [ ] **Step 3: Create `app/api/budgets/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.categoryBudget.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (typeof body.monthlyAmount !== "number" || body.monthlyAmount <= 0) {
    return NextResponse.json(
      { error: "monthlyAmount must be a number greater than 0" },
      { status: 400 }
    );
  }

  const budget = await prisma.categoryBudget.update({
    where: { id },
    data: { monthlyAmount: body.monthlyAmount },
  });
  return NextResponse.json(budget);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.categoryBudget.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.categoryBudget.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run the type checker and full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: `tsc` now only reports errors in `app/page.tsx` and `components/goals/GoalsView.tsx` (fixed in Task 6); all Vitest suites pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/budgets app/api/goals
git commit -m "feat: add /api/budgets CRUD routes, remove /api/goals"
```

---

### Task 6: Wire the frontend — `app/page.tsx` and `GoalsView.tsx`

**Files:**
- Modify: `app/page.tsx:17,29,37,65,137` (import, type import, `ENDPOINT`, data union, render call)
- Modify: `components/goals/GoalsView.tsx` (full rewrite)

**Interfaces:**
- Consumes: `CategoryBudget` type (Task 4), `/api/budgets` routes (Task 5), `budgetableOptions`/`categoryOrGroupInfo`/`GROUP_PREFIX` (Task 1), `Card` (existing, `components/ui/Card.tsx`), `money0` (existing, `lib/format.ts`).

- [ ] **Step 1: Update `app/page.tsx`**

Change the type import (around line 24-30) from:

```ts
import type {
  IncomeReport,
  SpendingReport,
  CashflowReport,
  SavingsReport,
  Goal,
} from "@/lib/types";
```

to:

```ts
import type {
  IncomeReport,
  SpendingReport,
  CashflowReport,
  SavingsReport,
  CategoryBudget,
} from "@/lib/types";
```

Change the `ENDPOINT` map (around line 32-38):

```ts
const ENDPOINT: Record<Tab, string> = {
  income: "/api/reports/income",
  spending: "/api/reports/spending",
  cashflow: "/api/reports/cashflow",
  savings: "/api/reports/savings",
  goals: "/api/goals",
};
```

to:

```ts
const ENDPOINT: Record<Tab, string> = {
  income: "/api/reports/income",
  spending: "/api/reports/spending",
  cashflow: "/api/reports/cashflow",
  savings: "/api/reports/savings",
  goals: "/api/budgets",
};
```

Change the `data` state union type (around line 60-67) from:

```ts
  const [data, setData] = useState<
    | IncomeReport
    | SpendingReport
    | CashflowReport
    | SavingsReport
    | Goal[]
    | null
  >(null);
```

to:

```ts
  const [data, setData] = useState<
    | IncomeReport
    | SpendingReport
    | CashflowReport
    | SavingsReport
    | CategoryBudget[]
    | null
  >(null);
```

Change the render call (around line 137) from:

```tsx
        <GoalsView data={data as Goal[]} onChange={load} />
```

to:

```tsx
        <GoalsView data={data as CategoryBudget[]} onChange={load} />
```

- [ ] **Step 2: Rewrite `components/goals/GoalsView.tsx`**

Replace the entire file with:

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import type { CategoryBudget } from "@/lib/types";
import { money0 } from "@/lib/format";
import { GROUP_PREFIX, budgetableOptions, categoryOrGroupInfo } from "@/lib/categories";
import { Card } from "@/components/ui/Card";

const PRESET_KEYS = [
  "FOOD_AND_DRINK_GROCERIES",
  "FOOD_AND_DRINK_RESTAURANT",
  `${GROUP_PREFIX}Shopping`,
  `${GROUP_PREFIX}Transportation`,
  `${GROUP_PREFIX}Entertainment`,
  `${GROUP_PREFIX}Bills & Utilities`,
];

function BudgetRing({
  pct,
  over,
  emoji,
}: {
  pct: number;
  over: boolean;
  emoji: string;
}) {
  const color = over ? "var(--spending)" : "var(--goals)";
  return (
    <div
      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(${color} ${pct}%, var(--control) 0)` }}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-xl">
        {emoji}
      </div>
    </div>
  );
}

export function GoalsView({
  data,
  onChange,
}: {
  data: CategoryBudget[];
  onChange: () => void;
}) {
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [pendingAmount, setPendingAmount] = useState("");
  const [customOpen, setCustomOpen] = useState(false);

  const budgetedKeys = useMemo(() => new Set(data.map((b) => b.categoryKey)), [data]);
  const availablePresets = PRESET_KEYS.filter((k) => !budgetedKeys.has(k));
  const customOptions = useMemo(
    () => budgetableOptions().filter((o) => !budgetedKeys.has(o.key)),
    [budgetedKeys]
  );

  const addBudget = useCallback(async () => {
    if (!pendingKey) return;
    const value = Number(pendingAmount);
    if (!Number.isFinite(value) || value <= 0) return;

    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryKey: pendingKey, monthlyAmount: value }),
    });
    setPendingKey(null);
    setPendingAmount("");
    setCustomOpen(false);
    onChange();
  }, [pendingKey, pendingAmount, onChange]);

  const saveAmount = useCallback(
    async (id: string, raw: string) => {
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) return;
      await fetch(`/api/budgets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthlyAmount: value }),
      });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onChange();
    },
    [onChange]
  );

  const deleteBudget = useCallback(
    async (id: string) => {
      await fetch(`/api/budgets/${id}`, { method: "DELETE" });
      onChange();
    },
    [onChange]
  );

  return (
    <div className="flex flex-col gap-4">
      {data.length === 0 && (
        <Card>
          <div className="text-sm text-muted">No budgets yet — add one below.</div>
        </Card>
      )}

      {data.map((b) => {
        const pct =
          b.monthlyAmount > 0 ? Math.min(b.actualAmount / b.monthlyAmount, 1) * 100 : 0;
        const over = b.actualAmount > b.monthlyAmount;
        const remaining = b.monthlyAmount - b.actualAmount;
        const editValue = editing[b.id] ?? String(b.monthlyAmount);
        return (
          <Card key={b.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1 text-sm font-medium text-foreground">
                {b.display}
              </div>
              <button
                onClick={() => deleteBudget(b.id)}
                aria-label="Delete budget"
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
              <BudgetRing pct={pct} over={over} emoji={b.emoji} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <div className="text-eyebrow text-muted">Budget</div>
                <input
                  type="number"
                  step="1"
                  value={editValue}
                  onChange={(e) =>
                    setEditing((prev) => ({ ...prev, [b.id]: e.target.value }))
                  }
                  onBlur={(e) => saveAmount(b.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="mt-1 w-full rounded-control border border-border bg-background px-2 py-1 text-sm tabular-nums text-foreground"
                />
              </div>
              <div>
                <div className="text-eyebrow text-muted">Actual</div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                  {money0(b.actualAmount)}
                </div>
              </div>
              <div>
                <div className="text-eyebrow text-muted">Remaining</div>
                <div
                  className="mt-1 text-sm font-semibold tabular-nums"
                  style={{ color: remaining >= 0 ? "var(--income)" : "var(--spending)" }}
                >
                  {remaining >= 0 ? money0(remaining) : `Over by ${money0(-remaining)}`}
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      <Card>
        <div className="flex flex-col gap-3">
          <div className="text-eyebrow text-muted">Add a budget</div>

          <div className="flex flex-wrap gap-2">
            {availablePresets.map((key) => {
              const { display, emoji } = categoryOrGroupInfo(key);
              return (
                <button
                  key={key}
                  onClick={() => {
                    setPendingKey(key);
                    setCustomOpen(false);
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    pendingKey === key
                      ? "border-accent text-accent"
                      : "border-border text-foreground"
                  }`}
                >
                  {emoji} {display}
                </button>
              );
            })}
            <button
              onClick={() => {
                setCustomOpen(true);
                setPendingKey(null);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                customOpen ? "border-accent text-accent" : "border-border text-foreground"
              }`}
            >
              Custom…
            </button>
          </div>

          {customOpen && (
            <select
              value={pendingKey ?? ""}
              onChange={(e) => setPendingKey(e.target.value || null)}
              className="rounded-control border border-border bg-background px-2 py-1 text-sm"
            >
              <option value="" disabled>
                Choose a category or group
              </option>
              <optgroup label="Category groups">
                {customOptions
                  .filter((o) => o.key.startsWith(GROUP_PREFIX))
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.emoji} {o.display}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Specific categories">
                {customOptions
                  .filter((o) => !o.key.startsWith(GROUP_PREFIX))
                  .map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.emoji} {o.display}
                    </option>
                  ))}
              </optgroup>
            </select>
          )}

          {pendingKey && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                value={pendingAmount}
                onChange={(e) => setPendingAmount(e.target.value)}
                placeholder="200"
                className="w-24 rounded-control border border-border bg-background px-2 py-1 text-sm tabular-nums"
              />
              <span className="text-xs text-muted">monthly amount</span>
              <button
                onClick={addBudget}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-ink"
              >
                Add budget
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Run the type checker and full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: both succeed with zero errors.

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx components/goals/GoalsView.tsx
git commit -m "feat: rebuild Goals tab as category budgets"
```

---

### Task 7: Update docs and verify end-to-end

**Files:**
- Modify: `claudemd/screens/goals.md`
- Modify: `CLAUDE.md` (the Goals row in the Screen-by-Screen Docs table needs no text change, but the doc it points to does)

**Interfaces:**
- None — documentation and manual verification only.

- [ ] **Step 1: Rewrite `claudemd/screens/goals.md`**

Replace the entire file with:

```markdown
# Screen: Goals (Category Budgets)

## Purpose

A monthly spending cap per category or category group (e.g. "Groceries:
$200 budget, $250 actual, $50 over"), with Actual computed automatically
from real Plaid transactions — the "budget-vs-actual" concept
`claudemd/design-system.md` flags as tied to the Budgeting Mode Toggle
idea. Lives in the existing Goals tab slot; replaces the prior
savings-target-bucket version of this screen (2026-07-23).

## Status

Shipped 2026-07-26. See
`docs/superpowers/specs/2026-07-26-category-budgets-design.md`.

## Key Files

`components/goals/GoalsView.tsx`, `app/api/budgets/route.ts`,
`app/api/budgets/[id]/route.ts`, `lib/aggregations.ts` (`budgetActual`),
`lib/categories.ts` (`budgetableOptions`, `categoryOrGroupInfo`),
`lib/reports.ts` (`currentMonthRange`), `prisma/schema.prisma`
(`CategoryBudget` model).

## Layout / UI Spec

One card per budget: category name, a progress ring (conic-gradient,
emoji centered, magenta under budget / red over budget), and a
Budget / Actual / Remaining row (Budget is inline-editable, Actual and
Remaining are computed). Below the list, a preset quick-add tray
(Groceries, Restaurants, Shopping, Transportation, Entertainment,
Bills & Utilities) plus a "Custom…" picker covering every other
category/group.

## Data Contract

`CategoryBudget` Prisma model: `categoryKey` (a bare Plaid detailed code
or a `GROUP:`-prefixed group name), `monthlyAmount`, `createdAt`. CRUD via
`/api/budgets` (list/create) and `/api/budgets/[id]` (patch amount,
delete). `GET` always scopes Actual to the current calendar month,
ignoring the app-wide date range picker.

## Fintech UX Principles Applied

**Awareness** — seeing Actual vs. Budget in real time, with a clear
over-budget signal (red ring, "Over by $X"), is the core mechanic for
catching overspending before month-end rather than after.

## Open Questions / Risks

No rollover of unspent budget, no historical-month view, and no
push/notification on crossing 100% — all deferred; see the design spec's
"Open Questions" section.

## How to Verify

`npm run dev`, add the Groceries preset with an amount below this month's
seeded demo spend, confirm Actual/Remaining/red ring; add the Shopping
group preset and cross-check its Actual against the Spending tab's
per-category breakdown for the same month; edit a budget inline; delete
one; add a "Custom…" budget.
```

- [ ] **Step 2: Full verification pass**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all three succeed.

Then run: `npm run dev` and manually verify:
1. Open the Goals tab — no budgets yet, empty-state message shows.
2. Tap the "Groceries" preset chip, enter an amount below this month's seeded grocery spend (check the Spending tab for the actual figure first), tap "Add budget" — a card appears with a red-ish or green-ish ring depending on the amount chosen, correct Budget/Actual/Remaining figures.
3. Tap the "Shopping" preset, add a budget — confirm its Actual matches the sum of every Shopping-group category on the Spending tab for the current month (Clothing + Electronics + Superstores + etc.).
4. Edit a budget's amount inline (click the Budget number, change it, click away) — confirm Actual/Remaining recompute and persist across a page reload.
5. Tap "Custom…", pick a category not in the preset list, add a budget for it.
6. Delete a budget — confirm it disappears and reappears in the relevant preset/custom picker.
7. Confirm the other four tabs (Income, Spending, Cash Flow, Savings) and the Cash Placement Nudge are visually and behaviorally unchanged.

- [ ] **Step 3: Commit**

```bash
git add claudemd/screens/goals.md
git commit -m "docs: update Goals screen doc for category budgets"
```

## Success Criteria

- Goals tab (same id/label/color) shows category budgets: Budget / Actual / Remaining per card, ring visual, matching the reference layout.
- Actual is always real current-month Plaid spend for that category or group — never manually entered.
- Both detailed-category and whole-group budgets work correctly and independently (no double-counting, no missed transactions within a group).
- Budget CRUD (create via preset or custom, edit amount, delete) persists across reloads.
- Existing tabs and the Cash Placement Nudge are bit-for-bit unchanged.
- `npx tsc --noEmit`, `npm test`, and `npm run build` all succeed.
