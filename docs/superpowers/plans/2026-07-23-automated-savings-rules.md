# Automated Savings Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Savings" report tab where the user defines percent-split and round-up automation rules and sees what they would have moved to savings over the selected date range, replayed against real historical transactions.

**Architecture:** One new Prisma model (`SavingsRule`, polymorphic via a `type` discriminator), one new pure aggregation function computed on each request (no caching, same as the other reports), rule-CRUD API routes plus a report route, and a new tab wired through the existing `ENDPOINT`/`Tab`/`dataKey` machinery in `app/page.tsx`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma (Postgres), Vitest.

## Global Constraints

- Money formatting: always via `lib/format.ts` (`money`, `money0`) — never format currency inline.
- Dark theme only: use existing CSS variable-backed classes (`bg-surface`, `text-muted`, `border-border`, `bg-accent`, etc.) as already used in `components/ui/Card.tsx` and `components/nudge/CashPlacementNudge.tsx` — never hardcode colors.
- Single-user app: no multi-tenant logic, no auth/ownership fields on new models.
- This pass is simulation only — no real transfer is ever triggered; there is no transfer-initiation integration to call.
- Every `isIncome` transaction is treated uniformly by split rules — no irregular-income detection logic.
- Round-up increment is restricted to `{1, 5}` — no open-ended increment input.

---

### Task 1: `SavingsRule` Prisma model + migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: a `SavingsRule` Prisma model with fields `id: String @id`, `type: String`, `active: Boolean @default(true)`, `percent: Float?`, `increment: Int?`, `createdAt: DateTime @default(now())`. Later tasks read/write this via `prisma.savingsRule.*`.

- [ ] **Step 1: Add the model to the schema**

Add this model to `prisma/schema.prisma` (after the existing `AppSettings` model):

```prisma
model SavingsRule {
  id        String   @id @default(cuid())
  type      String   // "split" | "roundup"
  active    Boolean  @default(true)
  percent   Float?   // for "split": 0-100
  increment Int?     // for "roundup": 1 or 5
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_savings_rules`
Expected: a new folder appears under `prisma/migrations/` (e.g.
`prisma/migrations/<timestamp>_add_savings_rules/migration.sql`)
containing a `CREATE TABLE "SavingsRule" (...)` statement, and the command
exits with `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify the generated client**

Run: `grep -n "SavingsRule" node_modules/.prisma/client/index.d.ts | head -5`
Expected: matches referencing a `SavingsRule` model/type — confirms
`prisma generate` (run automatically by `migrate dev`) picked up the new
model.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add SavingsRule model"
```

---

### Task 2: Types + `savingsRulesSimulation` aggregation (TDD)

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/aggregations.ts`
- Modify: `tests/aggregations.test.ts`

**Interfaces:**
- Consumes: `Txn` type (already defined in `lib/types.ts`).
- Produces: `SavingsRuleType`, `SavingsRule`, `SavingsRulePerRule`,
  `SavingsSimulationResult`, `SavingsReport` types in `lib/types.ts`, and
  `savingsRulesSimulation(txns: Txn[], rules: SavingsRule[]):
  SavingsSimulationResult` in `lib/aggregations.ts`. Later tasks (3, 4, 5,
  6) import these exact names.

- [ ] **Step 1: Add the types**

Add to `lib/types.ts` (at the end of the file):

```ts
/** Automated Savings Rules */
export type SavingsRuleType = "split" | "roundup";
export type SavingsRule = {
  id: string;
  type: SavingsRuleType;
  active: boolean;
  percent: number | null; // for "split": 0-100
  increment: number | null; // for "roundup": 1 or 5
};
export type SavingsRulePerRule = {
  ruleId: string;
  type: SavingsRuleType;
  total: number;
};
export type SavingsSimulationResult = {
  perRule: SavingsRulePerRule[];
  combinedTotal: number;
};
export type SavingsReport = SavingsSimulationResult & {
  rules: SavingsRule[];
};
```

- [ ] **Step 2: Write the failing tests**

Add to `tests/aggregations.test.ts`. First, add `savingsRulesSimulation`
to the existing import from `@/lib/aggregations` and `SavingsRule` to the
existing import from `@/lib/types`:

```ts
import {
  incomeByMonth,
  incomeSummary,
  incomeReport,
  spendingByCategory,
  cashflowSankey,
  cashflowStats,
  investingSummary,
  cashPlacementNudge,
  savingsRulesSimulation,
} from "@/lib/aggregations";
import type {
  Txn,
  InvestmentAccount,
  CashPlacementAccount,
  SavingsRule,
} from "@/lib/types";
```

Then add this new `describe` block at the end of the file, inside the
outer `describe("aggregations", ...)` block (before its closing `});`):

```ts
  describe("savingsRulesSimulation", () => {
    const savingsTxns: Txn[] = [
      t({ isIncome: true, amount: 1000 }),
      t({ isIncome: true, amount: 500 }),
      t({ isIncome: false, amount: 4.3 }),
      t({ isIncome: false, amount: 12.5 }),
      t({ isIncome: false, amount: 9.0 }),
    ];

    it("split rule sums percent of income transactions only", () => {
      const rule: SavingsRule = {
        id: "r1",
        type: "split",
        active: true,
        percent: 10,
        increment: null,
      };
      const result = savingsRulesSimulation(savingsTxns, [rule]);
      expect(result.perRule).toEqual([{ ruleId: "r1", type: "split", total: 150 }]);
      expect(result.combinedTotal).toBe(150);
    });

    it("roundup rule sums round-up-to-nearest-$1 over expense transactions only", () => {
      const rule: SavingsRule = {
        id: "r2",
        type: "roundup",
        active: true,
        percent: null,
        increment: 1,
      };
      const result = savingsRulesSimulation(savingsTxns, [rule]);
      // 4.30 -> 0.70, 12.50 -> 0.50, 9.00 -> 0 (exact multiple)
      expect(result.perRule[0].total).toBeCloseTo(1.2, 5);
    });

    it("roundup rule at $5 increment", () => {
      const rule: SavingsRule = {
        id: "r3",
        type: "roundup",
        active: true,
        percent: null,
        increment: 5,
      };
      const result = savingsRulesSimulation(savingsTxns, [rule]);
      // 4.30 -> 0.70, 12.50 -> 2.50, 9.00 -> 1.00
      expect(result.perRule[0].total).toBeCloseTo(4.2, 5);
    });

    it("combines multiple active rules and excludes inactive ones", () => {
      const split: SavingsRule = {
        id: "r1",
        type: "split",
        active: true,
        percent: 10,
        increment: null,
      };
      const roundup: SavingsRule = {
        id: "r2",
        type: "roundup",
        active: true,
        percent: null,
        increment: 1,
      };
      const inactive: SavingsRule = {
        id: "r4",
        type: "split",
        active: false,
        percent: 50,
        increment: null,
      };
      const result = savingsRulesSimulation(savingsTxns, [split, roundup, inactive]);
      expect(result.perRule).toHaveLength(2);
      expect(result.combinedTotal).toBeCloseTo(151.2, 5);
    });

    it("returns zero totals for an empty transaction set", () => {
      const rule: SavingsRule = {
        id: "r1",
        type: "split",
        active: true,
        percent: 10,
        increment: null,
      };
      const result = savingsRulesSimulation([], [rule]);
      expect(result.perRule).toEqual([{ ruleId: "r1", type: "split", total: 0 }]);
      expect(result.combinedTotal).toBe(0);
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- tests/aggregations.test.ts`
Expected: FAIL — `savingsRulesSimulation is not a function` (or a
TypeScript error that it doesn't exist), since it isn't implemented yet.

- [ ] **Step 4: Implement `savingsRulesSimulation`**

Add to `lib/aggregations.ts`. First add `SavingsRule` and
`SavingsSimulationResult` to the existing type import at the top of the
file:

```ts
import type {
  Txn,
  IncomeMonth,
  IncomeSummary,
  IncomeReport,
  SpendingCategory,
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

Then add this function at the end of the file:

```ts
/** Simulates active automated-savings rules against real transactions.
 * Split rules apply percent% to income transactions; round-up rules round
 * each expense transaction up to the nearest $1/$5 and sum the difference.
 * Inactive rules are excluded from both perRule and combinedTotal. Uses
 * integer-cents math for the round-up remainder to avoid floating-point
 * drift. */
export function savingsRulesSimulation(
  txns: Txn[],
  rules: SavingsRule[]
): SavingsSimulationResult {
  const perRule: SavingsSimulationResult["perRule"] = [];
  let combinedTotal = 0;

  for (const rule of rules) {
    if (!rule.active) continue;

    let total = 0;
    if (rule.type === "split") {
      const percent = rule.percent ?? 0;
      for (const t of txns) {
        if (!t.isIncome) continue;
        total += (t.amount * percent) / 100;
      }
    } else {
      const incrementCents = Math.round((rule.increment ?? 1) * 100);
      for (const t of txns) {
        if (t.isIncome) continue;
        const amountCents = Math.round(t.amount * 100);
        const remainder = amountCents % incrementCents;
        if (remainder !== 0) total += (incrementCents - remainder) / 100;
      }
    }

    total = Math.round(total * 100) / 100;
    perRule.push({ ruleId: rule.id, type: rule.type, total });
    combinedTotal += total;
  }

  combinedTotal = Math.round(combinedTotal * 100) / 100;
  return { perRule, combinedTotal };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/aggregations.test.ts`
Expected: PASS — all tests in the file, including the 5 new
`savingsRulesSimulation` tests.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/aggregations.ts tests/aggregations.test.ts
git commit -m "feat: add savingsRulesSimulation aggregation"
```

---

### Task 3: Rule CRUD API routes

**Files:**
- Create: `app/api/savings-rules/route.ts`
- Create: `app/api/savings-rules/[id]/route.ts`

**Interfaces:**
- Consumes: `prisma.savingsRule` (Task 1).
- Produces: `GET /api/savings-rules` → `SavingsRule[]` (raw Prisma rows,
  same shape as the `SavingsRule` type from Task 2). `POST
  /api/savings-rules` body `{ type: "split" | "roundup", percent?: number,
  increment?: number }` → created row. `PATCH
  /api/savings-rules/:id` body `{ active?: boolean, percent?: number,
  increment?: number }` → updated row. `DELETE /api/savings-rules/:id` →
  `{ ok: true }`. Task 6 (`SavingsView`) calls these four endpoints.

- [ ] **Step 1: Create the collection route**

Create `app/api/savings-rules/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function validateNewRule(body: {
  type?: unknown;
  percent?: unknown;
  increment?: unknown;
}): string | null {
  if (body.type !== "split" && body.type !== "roundup") {
    return 'type must be "split" or "roundup"';
  }
  if (body.type === "split") {
    if (typeof body.percent !== "number" || body.percent < 0 || body.percent > 100) {
      return "percent must be a number between 0 and 100";
    }
  }
  if (body.type === "roundup") {
    if (body.increment !== 1 && body.increment !== 5) {
      return "increment must be 1 or 5";
    }
  }
  return null;
}

export async function GET() {
  const rules = await prisma.savingsRule.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rules);
}

export async function POST(req: Request) {
  const body = await req.json();
  const error = validateNewRule(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const rule = await prisma.savingsRule.create({
    data: {
      type: body.type,
      percent: body.type === "split" ? body.percent : null,
      increment: body.type === "roundup" ? body.increment : null,
    },
  });
  return NextResponse.json(rule);
}
```

- [ ] **Step 2: Create the single-rule route**

Create `app/api/savings-rules/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.savingsRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: { active?: boolean; percent?: number; increment?: number } = {};

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") {
      return NextResponse.json({ error: "active must be a boolean" }, { status: 400 });
    }
    data.active = body.active;
  }
  if (body.percent !== undefined) {
    if (typeof body.percent !== "number" || body.percent < 0 || body.percent > 100) {
      return NextResponse.json(
        { error: "percent must be a number between 0 and 100" },
        { status: 400 }
      );
    }
    data.percent = body.percent;
  }
  if (body.increment !== undefined) {
    if (body.increment !== 1 && body.increment !== 5) {
      return NextResponse.json({ error: "increment must be 1 or 5" }, { status: 400 });
    }
    data.increment = body.increment;
  }

  const rule = await prisma.savingsRule.update({ where: { id }, data });
  return NextResponse.json(rule);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const existing = await prisma.savingsRule.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.savingsRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev` (in one terminal), then in another:

```bash
curl -s -X POST http://localhost:3000/api/savings-rules \
  -H "Content-Type: application/json" \
  -d '{"type":"split","percent":10}'
```

Expected: JSON response with `id`, `type: "split"`, `active: true`,
`percent: 10`, `increment: null`.

```bash
curl -s http://localhost:3000/api/savings-rules
```

Expected: JSON array containing the rule just created.

```bash
curl -s -X PATCH http://localhost:3000/api/savings-rules/<id-from-above> \
  -H "Content-Type: application/json" -d '{"active":false}'
```

Expected: JSON response with `active: false`.

```bash
curl -s -X DELETE http://localhost:3000/api/savings-rules/<id-from-above>
```

Expected: `{"ok":true}`. A follow-up `GET` no longer includes that rule.

- [ ] **Step 4: Commit**

```bash
git add app/api/savings-rules
git commit -m "feat: add savings rule CRUD API routes"
```

---

### Task 4: Savings report API route

**Files:**
- Create: `app/api/reports/savings/route.ts`

**Interfaces:**
- Consumes: `parseRange`, `loadTxns` from `lib/reports.ts`;
  `savingsRulesSimulation` from `lib/aggregations.ts` (Task 2);
  `prisma.savingsRule` (Task 1).
- Produces: `GET /api/reports/savings?start=...&end=...` → `SavingsReport`
  (`{ rules: SavingsRule[], perRule: SavingsRulePerRule[], combinedTotal:
  number }`). Task 6 (`SavingsView`, via `app/page.tsx`'s `ENDPOINT` map)
  fetches this.

- [ ] **Step 1: Create the route**

Create `app/api/reports/savings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRange, loadTxns } from "@/lib/reports";
import { savingsRulesSimulation } from "@/lib/aggregations";
import type { SavingsReport, SavingsRule } from "@/lib/types";

export async function GET(req: Request) {
  const { start, end } = parseRange(req.url);
  const [txns, ruleRows] = await Promise.all([
    loadTxns(start, end),
    prisma.savingsRule.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  const rules: SavingsRule[] = ruleRows.map((r) => ({
    id: r.id,
    type: r.type as SavingsRule["type"],
    active: r.active,
    percent: r.percent,
    increment: r.increment,
  }));
  const result = savingsRulesSimulation(txns, rules);
  const report: SavingsReport = { rules, ...result };
  return NextResponse.json(report);
}
```

- [ ] **Step 2: Verify manually**

With `npm run dev` running and at least one rule created (from Task 3's
verification, or create a new one), run:

```bash
curl -s "http://localhost:3000/api/reports/savings?start=2026-01-01&end=2026-12-31"
```

Expected: JSON with `rules` (array including the created rule),
`perRule` (array with a `total` for each active rule), and
`combinedTotal` (sum of active rule totals).

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/savings
git commit -m "feat: add savings report API route"
```

---

### Task 5: `SavingsView` component

**Files:**
- Create: `components/savings/SavingsView.tsx`

**Interfaces:**
- Consumes: `SavingsReport`, `SavingsRuleType` from `lib/types.ts` (Task
  2); `money0` from `lib/format.ts`; `Card` from `components/ui/Card.tsx`.
  Calls `POST /api/savings-rules`, `PATCH /api/savings-rules/:id`,
  `DELETE /api/savings-rules/:id` (Task 3).
- Produces: `SavingsView({ data: SavingsReport, onChange: () => void })`
  — a client component. `onChange` is called after every successful
  rule mutation so the parent can refetch; it takes no arguments and
  returns nothing. Task 6 renders `<SavingsView data={...}
  onChange={load} />`.

- [ ] **Step 1: Create the component**

Create `components/savings/SavingsView.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import type { SavingsReport, SavingsRuleType } from "@/lib/types";
import { money0 } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function SavingsView({
  data,
  onChange,
}: {
  data: SavingsReport;
  onChange: () => void;
}) {
  const [type, setType] = useState<SavingsRuleType>("split");
  const [percent, setPercent] = useState("");
  const [increment, setIncrement] = useState<1 | 5>(1);

  const addRule = useCallback(async () => {
    if (type === "split") {
      const trimmed = percent.trim();
      const value = Number(trimmed);
      if (trimmed === "" || !Number.isFinite(value) || value < 0 || value > 100) return;
      await fetch("/api/savings-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "split", percent: value }),
      });
      setPercent("");
    } else {
      await fetch("/api/savings-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "roundup", increment }),
      });
    }
    onChange();
  }, [type, percent, increment, onChange]);

  const toggleActive = useCallback(
    async (id: string, active: boolean) => {
      await fetch(`/api/savings-rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      onChange();
    },
    [onChange]
  );

  const deleteRule = useCallback(
    async (id: string) => {
      await fetch(`/api/savings-rules/${id}`, { method: "DELETE" });
      onChange();
    },
    [onChange]
  );

  const totalByRuleId = new Map(data.perRule.map((r) => [r.ruleId, r.total]));
  const ruleLabel = (r: { type: SavingsRuleType; percent: number | null; increment: number | null }) =>
    r.type === "split" ? `${r.percent}% of deposits` : `Round up to $${r.increment}`;

  return (
    <div className="flex flex-col gap-4">
      {data.rules.some((r) => r.active) && (
        <Card>
          <div className="text-xs text-muted">Simulated this period</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {money0(data.combinedTotal)}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {data.rules
              .filter((r) => r.active)
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{ruleLabel(r)}</span>
                  <span className="tabular-nums text-foreground">
                    {money0(totalByRuleId.get(r.id) ?? 0)}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-2">
          {data.rules.length === 0 && (
            <div className="text-sm text-muted">No rules yet — add one below.</div>
          )}
          {data.rules.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 border-t border-border py-2.5 first:border-t-0"
            >
              <div className="min-w-0 flex-1 text-sm text-foreground">{ruleLabel(r)}</div>
              <button
                onClick={() => toggleActive(r.id, !r.active)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  r.active ? "bg-accent text-white" : "bg-surface-2 text-muted"
                }`}
              >
                {r.active ? "Active" : "Paused"}
              </button>
              <button
                onClick={() => deleteRule(r.id)}
                aria-label="Delete rule"
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex rounded-full bg-surface-2 p-1">
            <button
              onClick={() => setType("split")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                type === "split" ? "bg-surface text-foreground shadow-sm" : "text-muted"
              }`}
            >
              Deposit split
            </button>
            <button
              onClick={() => setType("roundup")}
              className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                type === "roundup" ? "bg-surface text-foreground shadow-sm" : "text-muted"
              }`}
            >
              Round-up
            </button>
          </div>
          {type === "split" ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="1"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="10"
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums"
              />
              <span className="text-xs text-muted">% of every deposit</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Round up to nearest</span>
              <select
                value={increment}
                onChange={(e) => setIncrement(Number(e.target.value) as 1 | 5)}
                className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
              >
                <option value={1}>$1</option>
                <option value={5}>$5</option>
              </select>
            </div>
          )}
          <button
            onClick={addRule}
            className="self-start rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white"
          >
            Add rule
          </button>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors involving `components/savings/SavingsView.tsx`
(it isn't imported anywhere yet, so this only checks the file's own
internal type correctness).

- [ ] **Step 3: Commit**

```bash
git add components/savings/SavingsView.tsx
git commit -m "feat: add SavingsView component"
```

---

### Task 6: Wire the "Savings" tab into the dashboard

**Files:**
- Modify: `components/ReportTabs.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `SavingsView` (Task 5), `SavingsReport` type (Task 2),
  `/api/reports/savings` (Task 4).
- Produces: nothing further downstream — this is the final integration
  task.

- [ ] **Step 1: Add the tab**

In `components/ReportTabs.tsx`, change the `Tab` type and `TABS` array:

```ts
export type Tab = "income" | "spending" | "cashflow" | "investing" | "savings";

const TABS: { id: Tab; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "spending", label: "Spending" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "investing", label: "Investing" },
  { id: "savings", label: "Savings" },
];
```

- [ ] **Step 2: Wire the endpoint, data type, and render branch**

In `app/page.tsx`:

Add `SavingsView` and `SavingsReport` to the existing imports:

```ts
import { SavingsView } from "@/components/savings/SavingsView";
```

```ts
import type {
  IncomeReport,
  SpendingReport,
  CashflowReport,
  InvestingReport,
  SavingsReport,
} from "@/lib/types";
```

Update the `ENDPOINT` map:

```ts
const ENDPOINT: Record<Tab, string> = {
  income: "/api/reports/income",
  spending: "/api/reports/spending",
  cashflow: "/api/reports/cashflow",
  investing: "/api/reports/investing",
  savings: "/api/reports/savings",
};
```

Update the `data` state's union type:

```ts
const [data, setData] = useState<
  IncomeReport | SpendingReport | CashflowReport | InvestingReport | SavingsReport | null
>(null);
```

Update the render branch — replace the final `InvestingView` fallback
with an explicit `investing` check plus a new `savings` branch:

```tsx
      ) : tab === "cashflow" ? (
        <CashflowView data={data as CashflowReport} />
      ) : tab === "investing" ? (
        <InvestingView data={data as InvestingReport} />
      ) : (
        <SavingsView data={data as SavingsReport} onChange={load} />
      )}
```

(This replaces the existing block that ends `) : (\n        <InvestingView data={data as InvestingReport} />\n      )}`.)

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open the app, click the new "Savings" tab.

Expected:
- Tab renders with an empty rule list and the add-rule form (no
  simulated-total card, since no rules exist yet — assumes a clean rule
  set; if rules already exist from Task 3/4's `curl` verification,
  they'll show instead, which is also correct behavior).
- Add a 10% deposit-split rule → it appears in the rule list as
  "Active", and the simulated-total card appears showing its
  contribution for the currently selected date range.
- Add a round-up rule at $1 → both rules now show in the totals card,
  with a combined total equal to their sum.
- Toggle a rule to "Paused" → it disappears from the totals card and its
  amount is no longer included in the combined total, but it remains
  visible (as "Paused") in the rule list.
- Delete a rule → it disappears from both the rule list and the totals
  card.
- Switch the date range picker → totals recompute for the new range.
- Switch to Income/Spending/Cash Flow/Investing tabs → unchanged
  behavior from before this change.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing tests plus the new
`savingsRulesSimulation` tests from Task 2.

- [ ] **Step 5: Commit**

```bash
git add components/ReportTabs.tsx app/page.tsx
git commit -m "feat: wire Savings tab into dashboard"
```
