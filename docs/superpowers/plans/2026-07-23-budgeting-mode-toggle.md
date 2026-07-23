# Budgeting Mode Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings-level Automated/Envelope budgeting mode toggle. In Envelope mode, the Spending screen gains an "Envelope Caps" card showing spend-vs-monthly-cap progress for each of the 9 non-Income category groups, scaled to whatever date range is selected. Automated mode (default) leaves Spending exactly as it works today.

**Architecture:** One new Prisma model (`CategoryCap`, one row per group, created on demand) plus one new field on the existing `AppSettings` singleton (`budgetingMode`). A single pure function, `envelopeProgress(txns, caps, months)` in `lib/aggregations.ts`, does the group-bucketing *and* the cap-scaling/over-cap math in one testable unit (simpler than splitting bucketing and scaling across a pure function and the route handler). Three new API routes: `GET/PATCH /api/settings` (mode), `PATCH /api/category-caps` (upsert one group's monthly cap — no `GET` since no UI needs to list caps independently of the envelope report, which already returns each group's `monthlyCap`), and `GET /api/reports/envelope` (the report). Two new components: `SettingsPanel` (header gear icon + mode toggle, dropdown-panel pattern like `DateRangePicker`) and `EnvelopeCapsCard` (per-group rows with an inline-editable monthly cap, like `GoalsView`'s inline `currentAmount` edit). `SpendingView` and `app/page.tsx` are wired last.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma (Postgres), Vitest.

## Global Constraints

- Money formatting: always via `lib/format.ts` (`money`, `money0`) — never format currency inline.
- Dark theme only: use existing CSS variable-backed classes (`bg-surface`, `bg-surface-2`, `bg-accent`, `bg-negative`, `text-muted`, `text-foreground`, `text-negative`, `border-border`) as already used in `components/ui/Card.tsx`, `components/goals/GoalsView.tsx`, and `components/savings/SavingsView.tsx` — never hardcode colors.
- Single-user app: no multi-tenant logic, no auth/ownership fields on new models.
- Caps are per category group (the 9 non-`"Income"` entries in `GROUPS`, `lib/categories.ts:8`) — never per detailed category, never on the `"Income"` group.
- No rollover of unused cap into the next period, no notifications/alerts on over-cap — out of scope for this pass.
- The new Settings panel holds only the mode toggle — not a general preferences screen.
- Over-cap state must always show a label + icon (⚠️ "Over by $X"), never rely on the bar color alone.
- Automated mode must remain bit-for-bit unchanged from its current behavior — the Envelope Caps card simply doesn't render.

---

### Task 1: `CategoryCap` model + `AppSettings.budgetingMode` + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/settings.ts`

**Interfaces:**
- Produces: `prisma.categoryCap.*` (fields `group: String @id`, `monthlyCap: Float`); `AppSettings.budgetingMode: String` (default `"automated"`); `getAppSettings()` now resolves an object that always includes `budgetingMode: string`; `updateAppSettings(patch)` now accepts an optional `budgetingMode?: string` field. Tasks 5–7 read/write these.

- [ ] **Step 1: Update the schema**

In `prisma/schema.prisma`, add `budgetingMode` to the existing `AppSettings` model:

```prisma
model AppSettings {
  id                String    @id @default("singleton")
  referenceApy      Float?
  nudgeSnoozedUntil DateTime?
  budgetingMode     String    @default("automated")
}
```

Add a new model after `Goal`:

```prisma
model CategoryCap {
  group      String @id
  monthlyCap Float
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_budgeting_mode`
Expected: a new folder under `prisma/migrations/` containing an `ALTER TABLE "AppSettings" ADD COLUMN "budgetingMode" ...` and a `CREATE TABLE "CategoryCap" (...)` statement, exiting with `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify the generated client**

Run: `grep -n "model CategoryCap\|budgetingMode" node_modules/.prisma/client/index.d.ts | head -5`
Expected: matches referencing both `CategoryCap` and `budgetingMode`.

- [ ] **Step 4: Update `lib/settings.ts`**

Replace the file's contents with:

```ts
import { prisma } from "@/lib/db";

const SETTINGS_ID = "singleton";

export async function getAppSettings() {
  return (
    (await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } })) ?? {
      id: SETTINGS_ID,
      referenceApy: null,
      nudgeSnoozedUntil: null,
      budgetingMode: "automated",
    }
  );
}

export async function updateAppSettings(patch: {
  referenceApy?: number;
  nudgeSnoozedUntil?: Date;
  budgetingMode?: string;
}) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...patch },
    update: patch,
  });
}
```

- [ ] **Step 5: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/settings.ts
git commit -m "feat: add CategoryCap model and budgetingMode setting"
```

---

### Task 2: `BudgetingMode` / `EnvelopeGroupProgress` / `EnvelopeReport` types

**Files:**
- Modify: `lib/types.ts`

**Interfaces:**
- Produces: `BudgetingMode = "automated" | "envelope"`; `EnvelopeGroupProgress = { group: string; emoji: string; actual: number; monthlyCap: number | null; cap: number | null; overBy: number | null }`; `EnvelopeReport = { groups: EnvelopeGroupProgress[]; months: number }`. Task 4's `envelopeProgress()` returns `EnvelopeGroupProgress[]`; Task 7's route returns `EnvelopeReport`; Task 9's `EnvelopeCapsCard` and Task 10's `SpendingView`/`app/page.tsx` consume `BudgetingMode`/`EnvelopeReport`.

- [ ] **Step 1: Add the types**

Add to the end of `lib/types.ts`:

```ts
/** Budgeting Mode Toggle */
export type BudgetingMode = "automated" | "envelope";

export type EnvelopeGroupProgress = {
  group: string;
  emoji: string;
  actual: number; // spend in the selected range
  monthlyCap: number | null; // raw user-entered monthly cap, null = not set
  cap: number | null; // monthlyCap * months in the selected range, null if monthlyCap is null
  overBy: number | null; // max(0, actual - cap), null if cap is null
};

export type EnvelopeReport = {
  groups: EnvelopeGroupProgress[]; // always all 9 non-Income GROUPS entries
  months: number; // number of calendar months the selected range touches
};
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add BudgetingMode and envelope report types"
```

---

### Task 3: `monthsInRange` helper

**Files:**
- Modify: `lib/format.ts`
- Create: `tests/format.test.ts`

**Interfaces:**
- Produces: `monthsInRange(start: Date, end: Date): number` — count of distinct calendar (year, month) pairs touched by `[start, end]`, inclusive. Task 4's `envelopeProgress` and Task 7's envelope route call this.

- [ ] **Step 1: Write the failing test**

Create `tests/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { monthsInRange } from "@/lib/format";

describe("monthsInRange", () => {
  it("counts a single partial month as 1", () => {
    expect(monthsInRange(new Date("2026-07-01"), new Date("2026-07-23"))).toBe(1);
  });

  it("counts a 3-month preset span", () => {
    expect(monthsInRange(new Date("2026-05-01"), new Date("2026-07-23"))).toBe(3);
  });

  it("counts a year-to-date span", () => {
    expect(monthsInRange(new Date("2026-01-01"), new Date("2026-07-23"))).toBe(7);
  });

  it("counts a 12-month preset span", () => {
    expect(monthsInRange(new Date("2025-08-01"), new Date("2026-07-23"))).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/format.test.ts`
Expected: FAIL — `monthsInRange` is not exported from `@/lib/format`.

- [ ] **Step 3: Implement the helper**

Add to the end of `lib/format.ts`:

```ts
/** Distinct calendar months (UTC) touched by [start, end], inclusive —
 * e.g. Jan 15 to Mar 3 -> 3. Used to scale a monthly $ cap to whatever
 * date range is selected. */
export function monthsInRange(start: Date, end: Date): number {
  const startIndex = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const endIndex = end.getUTCFullYear() * 12 + end.getUTCMonth();
  return endIndex - startIndex + 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/format.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts tests/format.test.ts
git commit -m "feat: add monthsInRange helper"
```

---

### Task 4: `envelopeProgress` aggregation

**Files:**
- Modify: `lib/categories.ts`
- Modify: `lib/aggregations.ts`
- Modify: `tests/aggregations.test.ts`

**Interfaces:**
- Consumes: `categoryInfo`, `GROUPS` (`lib/categories.ts`, existing); `Txn`, `EnvelopeGroupProgress` (`lib/types.ts`, Task 2).
- Produces: `GROUP_EMOJI: Record<(typeof GROUPS)[number], string>` (`lib/categories.ts`); `envelopeProgress(txns: Txn[], caps: Record<string, number>, months: number): EnvelopeGroupProgress[]` (`lib/aggregations.ts`) — always returns all 9 non-`"Income"` groups. Task 7's route calls `envelopeProgress`.

- [ ] **Step 1: Add `GROUP_EMOJI` to `lib/categories.ts`**

Add after the `GROUPS` export (`lib/categories.ts:19`):

```ts
// One emoji per group, for the Envelope Caps card (lib/aggregations.ts's
// envelopeProgress). Distinct from each detailed category's own emoji.
export const GROUP_EMOJI: Record<(typeof GROUPS)[number], string> = {
  Income: "💵",
  Housing: "🏠",
  "Bills & Utilities": "🔌",
  "Food & Dining": "🍽️",
  Transportation: "🚗",
  Shopping: "🛍️",
  "Travel & Vacation": "🧳",
  Entertainment: "🎬",
  "Health & Wellness": "🏥",
  Other: "💸",
};
```

- [ ] **Step 2: Write the failing test**

Add to `tests/aggregations.test.ts`, extend the existing import from `@/lib/aggregations` to include `envelopeProgress`:

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
  envelopeProgress,
} from "@/lib/aggregations";
```

Add a new test in the `describe("aggregations", ...)` block:

```ts
  it("envelope progress covers all 9 expense groups and scales caps by months", () => {
    const rows = envelopeProgress(fixture, { "Food & Dining": 100 }, 2);

    expect(rows).toHaveLength(9);
    expect(rows.some((r) => r.group === "Income")).toBe(false);

    const dining = rows.find((r) => r.group === "Food & Dining")!;
    expect(dining.actual).toBe(420); // groceries 300 + restaurant 120
    expect(dining.monthlyCap).toBe(100);
    expect(dining.cap).toBe(200); // 100 * 2 months
    expect(dining.overBy).toBe(220); // 420 - 200

    const housing = rows.find((r) => r.group === "Housing")!;
    expect(housing.actual).toBe(2000);
    expect(housing.monthlyCap).toBeNull();
    expect(housing.cap).toBeNull();
    expect(housing.overBy).toBeNull();

    const transportation = rows.find((r) => r.group === "Transportation")!;
    expect(transportation.actual).toBe(0);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/aggregations.test.ts`
Expected: FAIL — `envelopeProgress` is not exported from `@/lib/aggregations`.

- [ ] **Step 4: Implement `envelopeProgress`**

In `lib/aggregations.ts`, update the import line to include `GROUP_EMOJI`:

```ts
import { categoryInfo, GROUPS, GROUP_EMOJI } from "@/lib/categories";
```

Add `EnvelopeGroupProgress` to the type import block:

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
  EnvelopeGroupProgress,
} from "@/lib/types";
```

Add this function at the end of the file:

```ts
const EXPENSE_GROUPS = GROUPS.filter((g) => g !== "Income");

/** Per-group spend vs. monthly cap (scaled to the range's month count), for
 * Envelope budgeting mode. Always returns all 9 expense groups (Income
 * excluded), even ones with no activity or no cap set, so the Envelope
 * Caps card has a stable row set regardless of the selected range. */
export function envelopeProgress(
  txns: Txn[],
  caps: Record<string, number>,
  months: number
): EnvelopeGroupProgress[] {
  const actualByGroup = new Map<string, number>();
  for (const t of txns) {
    if (t.isIncome) continue;
    const group = categoryInfo(t.pfDetailed).group;
    if (group === "Income") continue;
    actualByGroup.set(group, (actualByGroup.get(group) ?? 0) + t.amount);
  }

  return EXPENSE_GROUPS.map((group) => {
    const actual = actualByGroup.get(group) ?? 0;
    const monthlyCap = caps[group] ?? null;
    const cap = monthlyCap != null ? monthlyCap * months : null;
    const overBy = cap != null && actual > cap ? actual - cap : null;
    return {
      group,
      emoji: GROUP_EMOJI[group],
      actual,
      monthlyCap,
      cap,
      overBy,
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/aggregations.test.ts`
Expected: PASS (all tests in the file, including the new one).

- [ ] **Step 6: Commit**

```bash
git add lib/categories.ts lib/aggregations.ts tests/aggregations.test.ts
git commit -m "feat: add envelopeProgress aggregation"
```

---

### Task 5: `/api/settings` route

**Files:**
- Create: `app/api/settings/route.ts`

**Interfaces:**
- Consumes: `getAppSettings`, `updateAppSettings` (`lib/settings.ts`, Task 1).
- Produces: `GET /api/settings` → `{ budgetingMode: string }`. `PATCH /api/settings` body `{ budgetingMode: "automated" | "envelope" }` → `{ ok: true }`, 400 on any other value. Task 8 (`SettingsPanel`) and Task 10 (`app/page.tsx`) call both.

- [ ] **Step 1: Create the route**

Create `app/api/settings/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getAppSettings, updateAppSettings } from "@/lib/settings";

export async function GET() {
  const settings = await getAppSettings();
  return NextResponse.json({ budgetingMode: settings.budgetingMode });
}

export async function PATCH(req: Request) {
  const body = await req.json();

  if (body.budgetingMode !== "automated" && body.budgetingMode !== "envelope") {
    return NextResponse.json(
      { error: 'budgetingMode must be "automated" or "envelope"' },
      { status: 400 }
    );
  }

  await updateAppSettings({ budgetingMode: body.budgetingMode });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev` (in one terminal), then in another:

```bash
curl -s http://localhost:3000/api/settings
```

Expected: `{"budgetingMode":"automated"}` (default, assuming no prior mode was set).

```bash
curl -s -X PATCH http://localhost:3000/api/settings \
  -H "Content-Type: application/json" -d '{"budgetingMode":"envelope"}'
```

Expected: `{"ok":true}`.

```bash
curl -s http://localhost:3000/api/settings
```

Expected: `{"budgetingMode":"envelope"}` — persisted.

```bash
curl -s -X PATCH http://localhost:3000/api/settings \
  -H "Content-Type: application/json" -d '{"budgetingMode":"bogus"}'
```

Expected: 400 with `{"error":"budgetingMode must be \"automated\" or \"envelope\""}`.

Reset back to `"automated"` before continuing:

```bash
curl -s -X PATCH http://localhost:3000/api/settings \
  -H "Content-Type: application/json" -d '{"budgetingMode":"automated"}'
```

- [ ] **Step 3: Commit**

```bash
git add app/api/settings
git commit -m "feat: add settings API route for budgeting mode"
```

---

### Task 6: `/api/category-caps` route

**Files:**
- Create: `app/api/category-caps/route.ts`

**Interfaces:**
- Consumes: `GROUPS` (`lib/categories.ts`, existing).
- Produces: `PATCH /api/category-caps` body `{ group: string, monthlyCap: number }` → upserted `{ group, monthlyCap }` row; 400 if `group` isn't one of the 9 non-Income `GROUPS` entries or `monthlyCap <= 0`. Task 9 (`EnvelopeCapsCard`) calls this.

- [ ] **Step 1: Create the route**

Create `app/api/category-caps/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { GROUPS } from "@/lib/categories";

const EXPENSE_GROUPS: readonly string[] = GROUPS.filter((g) => g !== "Income");

function validateCap(body: {
  group?: unknown;
  monthlyCap?: unknown;
}): string | null {
  if (typeof body.group !== "string" || !EXPENSE_GROUPS.includes(body.group)) {
    return `group must be one of: ${EXPENSE_GROUPS.join(", ")}`;
  }
  if (typeof body.monthlyCap !== "number" || body.monthlyCap <= 0) {
    return "monthlyCap must be a number greater than 0";
  }
  return null;
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const error = validateCap(body);
  if (error) return NextResponse.json({ error }, { status: 400 });

  const cap = await prisma.categoryCap.upsert({
    where: { group: body.group },
    create: { group: body.group, monthlyCap: body.monthlyCap },
    update: { monthlyCap: body.monthlyCap },
  });
  return NextResponse.json(cap);
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev` (if not already running), then:

```bash
curl -s -X PATCH http://localhost:3000/api/category-caps \
  -H "Content-Type: application/json" -d '{"group":"Food & Dining","monthlyCap":500}'
```

Expected: `{"group":"Food & Dining","monthlyCap":500}`.

```bash
curl -s -X PATCH http://localhost:3000/api/category-caps \
  -H "Content-Type: application/json" -d '{"group":"Food & Dining","monthlyCap":600}'
```

Expected: `{"group":"Food & Dining","monthlyCap":600}` — same row updated, not duplicated (upsert on the `group` primary key).

```bash
curl -s -X PATCH http://localhost:3000/api/category-caps \
  -H "Content-Type: application/json" -d '{"group":"Income","monthlyCap":100}'
```

Expected: 400 (`"Income"` is not a valid expense group).

```bash
curl -s -X PATCH http://localhost:3000/api/category-caps \
  -H "Content-Type: application/json" -d '{"group":"Shopping","monthlyCap":-5}'
```

Expected: 400 (`monthlyCap` must be greater than 0).

- [ ] **Step 3: Commit**

```bash
git add app/api/category-caps
git commit -m "feat: add category-caps API route"
```

---

### Task 7: `/api/reports/envelope` route

**Files:**
- Create: `app/api/reports/envelope/route.ts`

**Interfaces:**
- Consumes: `parseRange`, `loadTxns` (`lib/reports.ts`, existing); `envelopeProgress` (`lib/aggregations.ts`, Task 4); `monthsInRange` (`lib/format.ts`, Task 3); `prisma.categoryCap` (Task 1); `EnvelopeReport` (`lib/types.ts`, Task 2).
- Produces: `GET /api/reports/envelope?start=&end=` → `EnvelopeReport`. Task 10 (`SpendingView`) calls this.

- [ ] **Step 1: Create the route**

Create `app/api/reports/envelope/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseRange, loadTxns } from "@/lib/reports";
import { envelopeProgress } from "@/lib/aggregations";
import { monthsInRange } from "@/lib/format";
import type { EnvelopeReport } from "@/lib/types";

export async function GET(req: Request) {
  const { start, end } = parseRange(req.url);
  const txns = await loadTxns(start, end);

  const capRows = await prisma.categoryCap.findMany();
  const caps: Record<string, number> = {};
  for (const c of capRows) caps[c.group] = c.monthlyCap;

  const months = monthsInRange(start, end);
  const groups = envelopeProgress(txns, caps, months);

  const report: EnvelopeReport = { groups, months };
  return NextResponse.json(report);
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev` (if not already running), then (assuming Task 6's `"Food & Dining": 600` cap is still set):

```bash
curl -s "http://localhost:3000/api/reports/envelope?start=2026-01-01&end=2026-07-23"
```

Expected: JSON with `"months"` equal to the number of calendar months between January and July (7), and `"groups"` containing exactly 9 entries, one with `"group":"Food & Dining"` whose `"monthlyCap"` is `600` and `"cap"` is `4200` (600 × 7).

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/envelope
git commit -m "feat: add envelope report API route"
```

---

### Task 8: `SettingsPanel` component

**Files:**
- Create: `components/SettingsPanel.tsx`

**Interfaces:**
- Consumes: `BudgetingMode` (`lib/types.ts`, Task 2).
- Produces: `SettingsPanel({ value: BudgetingMode, onChange: (mode: BudgetingMode) => void })` — a client component, controlled (mirrors `DateRangePicker`'s `value`/`onChange` shape). Task 10 renders `<SettingsPanel value={budgetingMode} onChange={handleModeChange} />` in the dashboard header.

- [ ] **Step 1: Create the component**

Create `components/SettingsPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { BudgetingMode } from "@/lib/types";

export function SettingsPanel({
  value,
  onChange,
}: {
  value: BudgetingMode;
  onChange: (mode: BudgetingMode) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Settings"
        className="flex items-center justify-center rounded-full border border-border bg-surface px-2.5 py-1.5 text-sm text-muted"
      >
        ⚙️
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-border bg-surface-2 p-3 shadow-lg">
            <div className="mb-2 text-xs text-muted">Budgeting mode</div>
            <div className="flex rounded-full bg-surface p-1">
              <button
                onClick={() => onChange("automated")}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  value === "automated"
                    ? "bg-surface-2 text-foreground shadow-sm"
                    : "text-muted"
                }`}
              >
                Automated
              </button>
              <button
                onClick={() => onChange("envelope")}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  value === "envelope"
                    ? "bg-surface-2 text-foreground shadow-sm"
                    : "text-muted"
                }`}
              >
                Envelope
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors (the component isn't imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add components/SettingsPanel.tsx
git commit -m "feat: add SettingsPanel component"
```

---

### Task 9: `EnvelopeCapsCard` component

**Files:**
- Create: `components/spending/EnvelopeCapsCard.tsx`

**Interfaces:**
- Consumes: `EnvelopeGroupProgress` (`lib/types.ts`, Task 2); `money0` (`lib/format.ts`, existing); `Card` (`components/ui/Card.tsx`, existing). Calls `PATCH /api/category-caps` (Task 6).
- Produces: `EnvelopeCapsCard({ groups: EnvelopeGroupProgress[], onCapChange: () => void })` — a client component. `onCapChange` is called after every successful cap edit so the parent can refetch (same contract as `GoalsView`'s `onChange`). Task 10 renders `<EnvelopeCapsCard groups={envelope.groups} onCapChange={loadEnvelope} />`.

- [ ] **Step 1: Create the component**

Create `components/spending/EnvelopeCapsCard.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import type { EnvelopeGroupProgress } from "@/lib/types";
import { money0 } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function EnvelopeCapsCard({
  groups,
  onCapChange,
}: {
  groups: EnvelopeGroupProgress[];
  onCapChange: () => void;
}) {
  const [editing, setEditing] = useState<Record<string, string>>({});

  const saveCap = useCallback(
    async (group: string, raw: string) => {
      setEditing((prev) => {
        const next = { ...prev };
        delete next[group];
        return next;
      });
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) return;
      await fetch("/api/category-caps", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group, monthlyCap: value }),
      });
      onCapChange();
    },
    [onCapChange]
  );

  return (
    <Card>
      <div className="mb-1 text-sm font-medium text-foreground">Envelope Caps</div>
      <div className="flex flex-col">
        {groups.map((g) => {
          const pct = g.cap != null && g.cap > 0 ? Math.min(g.actual / g.cap, 1) * 100 : 0;
          const editValue = editing[g.group] ?? String(g.monthlyCap ?? "");
          const over = g.overBy != null && g.overBy > 0;
          return (
            <div key={g.group} className="border-t border-border py-2.5 first:border-t-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm">
                    {g.emoji}
                  </span>
                  <div className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {g.group}
                  </div>
                </div>
                <div className="tabular-nums text-sm text-foreground">
                  {money0(g.actual)}
                </div>
              </div>

              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${over ? "bg-negative" : "bg-accent"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-xs text-muted">
                  <span>Cap: $</span>
                  <input
                    type="number"
                    step="1"
                    value={editValue}
                    onChange={(e) =>
                      setEditing((prev) => ({ ...prev, [g.group]: e.target.value }))
                    }
                    onBlur={(e) => saveCap(g.group, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    placeholder="Set"
                    className="w-14 rounded-lg border border-border bg-background px-1.5 py-0.5 text-right tabular-nums text-foreground"
                  />
                  <span>/mo</span>
                </div>
                {over && (
                  <span className="text-xs text-negative">
                    ⚠️ Over by {money0(g.overBy!)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors (the component isn't imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add components/spending/EnvelopeCapsCard.tsx
git commit -m "feat: add EnvelopeCapsCard component"
```

---

### Task 10: Wire Envelope mode into Spending and the dashboard header

**Files:**
- Modify: `components/spending/SpendingView.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `SettingsPanel` (Task 8), `EnvelopeCapsCard` (Task 9), `BudgetingMode`/`EnvelopeReport` types (Task 2), `/api/settings` (Task 5), `/api/reports/envelope` (Task 7), `Range` type (`components/DateRangePicker.tsx`, existing).
- Produces: nothing further downstream — this is the final integration task.

- [ ] **Step 1: Update `SpendingView` to accept `range`/`budgetingMode` and render the caps card**

In `components/spending/SpendingView.tsx`, replace the import block at the top of the file with:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type {
  SpendingReport,
  SpendingCategory,
  BudgetingMode,
  EnvelopeReport,
} from "@/lib/types";
import type { Range } from "@/components/DateRangePicker";
import { CATEGORICAL, OTHER_COLOR } from "@/lib/palette";
import { money, isoDate } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { EnvelopeCapsCard } from "@/components/spending/EnvelopeCapsCard";
```

Replace the `SpendingView` function signature and its opening lines:

```tsx
export function SpendingView({
  data,
  range,
  budgetingMode,
}: {
  data: SpendingReport;
  range: Range;
  budgetingMode: BudgetingMode;
}) {
  const [expanded, setExpanded] = useState(false);
  const [envelope, setEnvelope] = useState<EnvelopeReport | null>(null);

  const loadEnvelope = useCallback(async () => {
    if (budgetingMode !== "envelope") {
      setEnvelope(null);
      return;
    }
    const qs = `?start=${isoDate(range.start)}&end=${isoDate(range.end)}`;
    const res = await fetch(`/api/reports/envelope${qs}`);
    setEnvelope(await res.json());
  }, [budgetingMode, range]);

  useEffect(() => {
    loadEnvelope();
  }, [loadEnvelope]);

  // Donut: top N distinct slices + a folded "Other".
```

(This replaces the old opening `export function SpendingView({ data }: { data: SpendingReport }) {\n  const [expanded, setExpanded] = useState(false);\n\n  // Donut: top N distinct slices + a folded "Other".` block.)

Add the caps card at the end of the returned JSX, immediately before the closing `</div>` of the top-level `<div className="flex flex-col gap-4">`:

```tsx
      {budgetingMode === "envelope" && envelope && (
        <EnvelopeCapsCard groups={envelope.groups} onCapChange={loadEnvelope} />
      )}
    </div>
  );
}
```

(This replaces the existing final two lines of the function, `    </div>\n  );\n}`.)

- [ ] **Step 2: Wire `budgetingMode` and `SettingsPanel` into `app/page.tsx`**

Add `SettingsPanel` to the component imports:

```ts
import { SettingsPanel } from "@/components/SettingsPanel";
```

Add `BudgetingMode` to the type import from `@/lib/types`:

```ts
import type {
  IncomeReport,
  SpendingReport,
  CashflowReport,
  InvestingReport,
  SavingsReport,
  Goal,
  BudgetingMode,
} from "@/lib/types";
```

Inside the `Dashboard` function, add mode state and its fetch/update logic right after the existing `dataKey` state declaration:

```ts
  const [budgetingMode, setBudgetingMode] = useState<BudgetingMode>("automated");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setBudgetingMode(s.budgetingMode));
  }, []);

  const handleModeChange = useCallback(async (mode: BudgetingMode) => {
    setBudgetingMode(mode);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetingMode: mode }),
    });
  }, []);
```

Update the header to render `SettingsPanel` next to the date range picker — replace:

```tsx
        <div className="flex items-center gap-2">
          {!empty && <AddAccountButton onLinked={load} />}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
```

with:

```tsx
        <div className="flex items-center gap-2">
          {!empty && <AddAccountButton onLinked={load} />}
          <SettingsPanel value={budgetingMode} onChange={handleModeChange} />
          <DateRangePicker value={range} onChange={setRange} />
        </div>
```

Update the spending render branch — replace:

```tsx
      ) : tab === "spending" ? (
        <SpendingView data={data as SpendingReport} />
```

with:

```tsx
      ) : tab === "spending" ? (
        <SpendingView
          data={data as SpendingReport}
          range={range}
          budgetingMode={budgetingMode}
        />
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open the app.

Expected, starting in Automated mode (default):
- Spending tab looks exactly as it did before this change — donut, category list, no caps card.
- Click the new ⚙️ icon in the header → a panel opens with an Automated/Envelope segmented toggle, "Automated" highlighted.

Switch to Envelope mode:
- Click "Envelope" in the panel, close it.
- On the Spending tab, an "Envelope Caps" card appears below the existing category list, listing 9 rows (Housing, Bills & Utilities, Food & Dining, Transportation, Shopping, Travel & Vacation, Entertainment, Health & Wellness, Other), each with an actual amount, an empty progress bar, and a "Cap: $[Set] /mo" input.
- Type `100` into the Food & Dining cap input and click away → the bar fills in proportionally and the value persists across a page reload (re-check with mode still on Envelope).
- Change the date range from "Last 3 months" to "Last 6 months" → the bar's fill fraction updates (cap scales from `100 × 3` to `100 × 6` months while actual updates to the new range's total).
- If actual spend exceeds the scaled cap, "⚠️ Over by $X" appears next to the bar.
- Switch back to Automated mode → the Envelope Caps card disappears; donut/list unchanged.
- Switch to Income/Cash Flow/Investing/Savings/Goals tabs → all behave exactly as before this change, regardless of budgeting mode.
- Reload the page → the previously-selected budgeting mode is remembered (persisted via `AppSettings.budgetingMode`).

- [ ] **Step 4: Run the full test suite and type-check**

Run: `npm test`
Expected: PASS — all existing tests plus the new `tests/format.test.ts` and the new `envelopeProgress` test in `tests/aggregations.test.ts`.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/spending/SpendingView.tsx app/page.tsx
git commit -m "feat: wire Budgeting Mode Toggle into Spending and dashboard header"
```
