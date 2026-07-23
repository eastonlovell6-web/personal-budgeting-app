# Cash Placement Nudge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dismissible dashboard card that flags checking/savings accounts earning meaningfully less than a user-set reference HYSA rate, with inline rate entry and a 30-day snooze.

**Architecture:** Two new persisted fields (`Account.apy`, singleton `AppSettings`) feed a pure aggregation function that decides, per depository account, whether it needs a rate entered or qualifies as an opportunity. Two API routes serve/update this data; a self-fetching client component renders the card above the existing report tabs in `app/page.tsx`, untouched by the tab/date-range fetch cycle.

**Tech Stack:** Next.js 16 App Router (route handlers), Prisma (Postgres), Vitest, React 19 client components, Tailwind v4 (existing tokens in `app/globals.css`).

## Global Constraints

- Money formatting via `lib/format.ts` (`money`, `money0`) — never format currency inline.
- Dark theme only — use existing CSS variable-backed Tailwind classes (`bg-surface`, `border-border`, `text-foreground`, `text-muted`, `bg-accent`, `text-white`, `bg-background`) — never hardcode colors.
- Never hardcode a financial figure that goes stale (the reference APY, or any account's APY) — both must live in the DB and be user-editable, never a literal in source.
- Single-user app — no multi-tenant/user-scoping logic; `AppSettings` is a fixed singleton row.
- v1 report data is otherwise read-only; this feature is the first to accept user writes (APY values), so all writes go through explicit `PATCH` routes with bounds validation (`0–20` percent), not open-ended input.
- Reuse existing patterns: report routes return plain JSON via `NextResponse.json`; `middleware.ts` already gates all `/api/*` routes behind the passcode session cookie — no auth code needed in the new routes.

---

### Task 1: Schema — `Account.apy` and singleton `AppSettings`

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `Account.apy: Float | null` on the generated Prisma `Account` model; new Prisma model `AppSettings` with fields `id: String` (always `"singleton"`), `referenceApy: Float | null`, `nudgeSnoozedUntil: DateTime | null`.

- [ ] **Step 1: Add `apy` to `Account` and the new `AppSettings` model**

In `prisma/schema.prisma`, add a field to the existing `Account` model (after `currentBalance`):

```prisma
model Account {
  accountId      String        @id
  itemId         String
  item           Item          @relation(fields: [itemId], references: [id], onDelete: Cascade)
  name           String
  type           String
  currentBalance Float?
  apy            Float?
  updatedAt      DateTime      @default(now())
  transactions   Transaction[]
}
```

Then append a new model at the end of the file:

```prisma
model AppSettings {
  id                String    @id @default("singleton")
  referenceApy      Float?
  nudgeSnoozedUntil DateTime?
}
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_cash_placement_nudge`
Expected: prompts create a new folder under `prisma/migrations/`, applies cleanly against the DB in `DATABASE_URL`, and regenerates the Prisma client with no errors.

- [ ] **Step 3: Verify the client picks up the new types**

Run: `npx tsc --noEmit`
Expected: no type errors (confirms `@prisma/client` regenerated with `Account.apy` and the `AppSettings` model).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add Account.apy and AppSettings for cash placement nudge"
```

---

### Task 2: Pure aggregation logic — `cashPlacementNudge()`

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/aggregations.ts`
- Modify: `tests/aggregations.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (pure function, no DB/Prisma dependency).
- Produces: `CashPlacementAccount`, `CashPlacementNeedsRate`, `CashPlacementOpportunity`, `CashPlacementNudgeResult` types (from `lib/types.ts`); `cashPlacementNudge(accounts: CashPlacementAccount[], referenceApy: number | null, opts?: { minGapPP?: number; minBalance?: number }): CashPlacementNudgeResult` (from `lib/aggregations.ts`). Task 4's API route calls this directly.

- [ ] **Step 1: Add the shared types**

In `lib/types.ts`, append:

```ts
/** Cash Placement Nudge */
export type CashPlacementAccount = {
  accountId: string;
  name: string;
  currentBalance: number | null;
  apy: number | null; // user-entered current APY, percent (e.g. 0.4 = 0.4%)
};
export type CashPlacementNeedsRate = {
  accountId: string;
  name: string;
  balance: number;
};
export type CashPlacementOpportunity = {
  accountId: string;
  name: string;
  balance: number;
  apy: number;
  gapPP: number; // referenceApy - apy, in percentage points
  annualOpportunityCost: number; // balance * gapPP / 100
};
export type CashPlacementNudgeResult = {
  needsRate: CashPlacementNeedsRate[];
  opportunities: CashPlacementOpportunity[];
};
```

- [ ] **Step 2: Write the failing tests**

In `tests/aggregations.test.ts`, add `CashPlacementAccount` to the existing type-only import from `@/lib/types`, add `cashPlacementNudge` to the existing import from `@/lib/aggregations`, and append this new `describe` block at the end of the file (inside or after the existing `describe("aggregations", ...)` block — add as a new top-level `describe`):

```ts
describe("cashPlacementNudge", () => {
  const acc = (o: Partial<CashPlacementAccount>): CashPlacementAccount => ({
    accountId: Math.random().toString(),
    name: "Checking",
    currentBalance: 1000,
    apy: null,
    ...o,
  });

  it("returns nothing when no reference rate is set yet", () => {
    const result = cashPlacementNudge(
      [acc({ apy: null }), acc({ apy: 0.1 })],
      null
    );
    expect(result.needsRate).toEqual([]);
    expect(result.opportunities).toEqual([]);
  });

  it("excludes accounts below the minimum balance", () => {
    const result = cashPlacementNudge([acc({ currentBalance: 400, apy: null })], 4.0);
    expect(result.needsRate).toEqual([]);
  });

  it("flags accounts with no APY entered as needing a rate", () => {
    const result = cashPlacementNudge(
      [acc({ accountId: "a1", name: "Savings", currentBalance: 1000, apy: null })],
      4.0
    );
    expect(result.needsRate).toEqual([{ accountId: "a1", name: "Savings", balance: 1000 }]);
  });

  it("excludes accounts whose gap is below the threshold", () => {
    const result = cashPlacementNudge(
      [acc({ currentBalance: 1000, apy: 3.6 })],
      4.0
    );
    expect(result.opportunities).toEqual([]);
    expect(result.needsRate).toEqual([]);
  });

  it("includes accounts at/above the gap threshold with correct gapPP and annualOpportunityCost", () => {
    const result = cashPlacementNudge(
      [acc({ accountId: "a2", name: "Old Savings", currentBalance: 10000, apy: 0.1 })],
      4.1
    );
    expect(result.opportunities).toEqual([
      {
        accountId: "a2",
        name: "Old Savings",
        balance: 10000,
        apy: 0.1,
        gapPP: 4.0,
        annualOpportunityCost: 400,
      },
    ]);
  });

  it("sorts opportunities by annual opportunity cost descending", () => {
    const result = cashPlacementNudge(
      [
        acc({ accountId: "small", currentBalance: 1000, apy: 0 }), // gap 4.0, cost 40
        acc({ accountId: "big", currentBalance: 50000, apy: 0 }), // gap 4.0, cost 2000
      ],
      4.0
    );
    expect(result.opportunities.map((o) => o.accountId)).toEqual(["big", "small"]);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/aggregations.test.ts -t cashPlacementNudge`
Expected: FAIL — `cashPlacementNudge is not a function` (or import error).

- [ ] **Step 4: Implement `cashPlacementNudge()`**

In `lib/aggregations.ts`, the existing type-only import block at the top of the file (`import type { Txn, IncomeMonth, ... } from "@/lib/types";`) already lists several types — add `CashPlacementAccount` and `CashPlacementNudgeResult` to that same list. Then append:

```ts
/** Per-account cash placement check: which accounts need a rate entered,
 * and which have a meaningful, user-actionable gap vs. the reference rate.
 * Only considers accounts at/above minBalance; returns nothing at all when
 * referenceApy hasn't been set yet (the UI shows a one-time setup prompt
 * instead). Accounts whose gap is below minGapPP are dropped entirely —
 * not "fine", just not worth surfacing. */
export function cashPlacementNudge(
  accounts: CashPlacementAccount[],
  referenceApy: number | null,
  opts?: { minGapPP?: number; minBalance?: number }
): CashPlacementNudgeResult {
  if (referenceApy == null) return { needsRate: [], opportunities: [] };

  const minGapPP = opts?.minGapPP ?? 0.5;
  const minBalance = opts?.minBalance ?? 500;

  const eligible = accounts.filter(
    (a) => a.currentBalance != null && a.currentBalance >= minBalance
  );

  const needsRate: CashPlacementNudgeResult["needsRate"] = [];
  const opportunities: CashPlacementNudgeResult["opportunities"] = [];

  for (const a of eligible) {
    const balance = a.currentBalance!;
    if (a.apy == null) {
      needsRate.push({ accountId: a.accountId, name: a.name, balance });
      continue;
    }
    const gapPP = referenceApy - a.apy;
    if (gapPP >= minGapPP) {
      opportunities.push({
        accountId: a.accountId,
        name: a.name,
        balance,
        apy: a.apy,
        gapPP,
        annualOpportunityCost: (balance * gapPP) / 100,
      });
    }
  }

  opportunities.sort((a, b) => b.annualOpportunityCost - a.annualOpportunityCost);

  return { needsRate, opportunities };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/aggregations.test.ts`
Expected: PASS — all tests in the file, including the new `cashPlacementNudge` block.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/aggregations.ts tests/aggregations.test.ts
git commit -m "feat: add cashPlacementNudge aggregation"
```

---

### Task 3: Settings helpers + `/api/nudges/cash-placement` route

**Files:**
- Create: `lib/settings.ts`
- Create: `app/api/nudges/cash-placement/route.ts`

**Interfaces:**
- Consumes: `cashPlacementNudge()` and `CashPlacementAccount` from Task 2 (`@/lib/aggregations`, `@/lib/types`); `prisma` from `@/lib/db`.
- Produces: `getAppSettings(): Promise<{ id: string; referenceApy: number | null; nudgeSnoozedUntil: Date | null }>` and `updateAppSettings(patch: { referenceApy?: number; nudgeSnoozedUntil?: Date }): Promise<...>` from `lib/settings.ts` — consumed by Task 4's route. `GET`/`PATCH` handlers at `/api/nudges/cash-placement` — consumed by Task 5's component.

No unit tests for this task — it's DB-backed I/O with no existing DB-test pattern in this repo (`app/api/reports/investing/route.ts` and `lib/sync.ts` are likewise untested; verified manually). Verify via the dev server in Step 3.

- [ ] **Step 1: Write the settings helpers**

Create `lib/settings.ts`:

```ts
import { prisma } from "@/lib/db";

const SETTINGS_ID = "singleton";

export async function getAppSettings() {
  return (
    (await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } })) ?? {
      id: SETTINGS_ID,
      referenceApy: null,
      nudgeSnoozedUntil: null,
    }
  );
}

export async function updateAppSettings(patch: {
  referenceApy?: number;
  nudgeSnoozedUntil?: Date;
}) {
  return prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...patch },
    update: patch,
  });
}
```

- [ ] **Step 2: Write the route**

Create `app/api/nudges/cash-placement/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAppSettings, updateAppSettings } from "@/lib/settings";
import { cashPlacementNudge } from "@/lib/aggregations";
import type { CashPlacementAccount } from "@/lib/types";

export async function GET() {
  const settings = await getAppSettings();
  const snoozed =
    settings.nudgeSnoozedUntil != null && settings.nudgeSnoozedUntil > new Date();

  if (snoozed) {
    return NextResponse.json({
      referenceApy: settings.referenceApy,
      snoozedUntil: settings.nudgeSnoozedUntil,
      needsRate: [],
      opportunities: [],
    });
  }

  const rows = await prisma.account.findMany({ where: { type: "depository" } });
  const accounts: CashPlacementAccount[] = rows.map((r) => ({
    accountId: r.accountId,
    name: r.name,
    currentBalance: r.currentBalance,
    apy: r.apy,
  }));

  const result = cashPlacementNudge(accounts, settings.referenceApy);

  return NextResponse.json({
    referenceApy: settings.referenceApy,
    snoozedUntil: settings.nudgeSnoozedUntil,
    ...result,
  });
}

export async function PATCH(req: Request) {
  const body = await req.json();

  if (body.referenceApy !== undefined) {
    if (typeof body.referenceApy !== "number" || body.referenceApy < 0 || body.referenceApy > 20) {
      return NextResponse.json({ error: "referenceApy must be between 0 and 20" }, { status: 400 });
    }
    await updateAppSettings({ referenceApy: body.referenceApy });
  }

  if (body.snooze === true) {
    const nudgeSnoozedUntil = new Date();
    nudgeSnoozedUntil.setDate(nudgeSnoozedUntil.getDate() + 30);
    await updateAppSettings({ nudgeSnoozedUntil });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Manually verify against the dev server**

Run: `npm run dev` (in one terminal), then in another:

```bash
curl -s http://localhost:3000/api/nudges/cash-placement -H "Cookie: $(cat /tmp/session-cookie 2>/dev/null)"
```

Since `middleware.ts` requires a session cookie, this will 401 without logging in first through the browser — that's expected and fine. Instead verify by opening `http://localhost:3000` in a browser (already logged in from prior work), then in the browser devtools console:

```js
fetch("/api/nudges/cash-placement").then((r) => r.json()).then(console.log)
```

Expected: `{ referenceApy: null, snoozedUntil: null, needsRate: [], opportunities: [] }` on a fresh DB. Then:

```js
fetch("/api/nudges/cash-placement", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ referenceApy: 4.1 }) }).then((r) => r.json()).then(console.log)
fetch("/api/nudges/cash-placement").then((r) => r.json()).then(console.log)
```

Expected: second call now returns `referenceApy: 4.1` and, if any depository accounts exist with `apy: null`, they appear in `needsRate`.

- [ ] **Step 4: Commit**

```bash
git add lib/settings.ts app/api/nudges/cash-placement/route.ts
git commit -m "feat: add cash placement nudge settings + API route"
```

---

### Task 4: `/api/accounts/[accountId]` route for setting an account's APY

**Files:**
- Create: `app/api/accounts/[accountId]/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`.
- Produces: `PATCH /api/accounts/:accountId` with body `{ apy: number }` — consumed by Task 5's component.

No unit tests (same reasoning as Task 3 — DB-backed route, no existing DB-test pattern). Verify manually in Step 2.

- [ ] **Step 1: Write the route**

Create `app/api/accounts/[accountId]/route.ts`. Next.js 16 route handlers receive dynamic params as a `Promise`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await params;
  const body = await req.json();

  if (typeof body.apy !== "number" || body.apy < 0 || body.apy > 20) {
    return NextResponse.json(
      { error: "apy must be a number between 0 and 20" },
      { status: 400 }
    );
  }

  const account = await prisma.account.findUnique({ where: { accountId } });
  if (!account) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await prisma.account.update({ where: { accountId }, data: { apy: body.apy } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Manually verify**

With `npm run dev` running and logged in via the browser, in devtools console (replace `ACCOUNT_ID` with a real `accountId` from the `needsRate` list returned in Task 3's verification):

```js
fetch("/api/accounts/ACCOUNT_ID", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apy: 0.4 }) }).then((r) => r.json()).then(console.log)
```

Expected: `{ ok: true }`. Then re-fetch `/api/nudges/cash-placement` and confirm that account no longer appears in `needsRate` (and appears in `opportunities` if the gap vs. the reference rate set in Task 3 is ≥ 0.5).

- [ ] **Step 3: Commit**

```bash
git add app/api/accounts/[accountId]/route.ts
git commit -m "feat: add PATCH /api/accounts/:accountId for setting APY"
```

---

### Task 5: `CashPlacementNudge` component + wire into the dashboard

**Files:**
- Create: `components/nudge/CashPlacementNudge.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `GET`/`PATCH /api/nudges/cash-placement` and `PATCH /api/accounts/:accountId` (Tasks 3–4); `Card` from `@/components/ui/Card`; `money0` from `@/lib/format`.
- Produces: `CashPlacementNudge` component (default export not needed — named export), rendered once in `app/page.tsx`.

No unit tests — this repo has no component-test setup (Vitest config here covers only `lib/*` pure functions); verify manually per Step 3.

- [ ] **Step 1: Write the component**

Create `components/nudge/CashPlacementNudge.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { money0 } from "@/lib/format";
import type {
  CashPlacementNeedsRate,
  CashPlacementOpportunity,
} from "@/lib/types";

type NudgeData = {
  referenceApy: number | null;
  snoozedUntil: string | null;
  needsRate: CashPlacementNeedsRate[];
  opportunities: CashPlacementOpportunity[];
};

export function CashPlacementNudge() {
  const [data, setData] = useState<NudgeData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [referenceInput, setReferenceInput] = useState("");
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/nudges/cash-placement");
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveReferenceApy = useCallback(async () => {
    const value = Number(referenceInput);
    if (!Number.isFinite(value)) return;
    await fetch("/api/nudges/cash-placement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referenceApy: value }),
    });
    setReferenceInput("");
    load();
  }, [referenceInput, load]);

  const saveAccountApy = useCallback(
    async (accountId: string) => {
      const value = Number(rateInputs[accountId]);
      if (!Number.isFinite(value)) return;
      await fetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apy: value }),
      });
      setRateInputs((prev) => ({ ...prev, [accountId]: "" }));
      load();
    },
    [rateInputs, load]
  );

  const dismiss = useCallback(async () => {
    setDismissed(true);
    await fetch("/api/nudges/cash-placement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snooze: true }),
    });
  }, []);

  if (dismissed || !data) return null;
  const hasContent =
    data.referenceApy == null ||
    data.needsRate.length > 0 ||
    data.opportunities.length > 0;
  if (!hasContent) return null;

  return (
    <Card className="relative">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-3 top-3 text-muted hover:text-foreground"
      >
        ✕
      </button>
      {data.referenceApy == null ? (
        <div className="pr-6">
          <div className="text-sm font-medium text-foreground">
            See if your cash is earning what it could
          </div>
          <div className="mt-1 text-xs text-muted">
            Enter today&rsquo;s typical high-yield savings rate to compare
            against your accounts.
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              value={referenceInput}
              onChange={(e) => setReferenceInput(e.target.value)}
              placeholder="4.10"
              className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums"
            />
            <span className="text-xs text-muted">%</span>
            <button
              onClick={saveReferenceApy}
              className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pr-6">
          {data.needsRate.map((a) => (
            <div
              key={a.accountId}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1 text-sm text-foreground">
                What does &ldquo;{a.name}&rdquo; currently earn?
              </div>
              <input
                type="number"
                step="0.01"
                value={rateInputs[a.accountId] ?? ""}
                onChange={(e) =>
                  setRateInputs((prev) => ({
                    ...prev,
                    [a.accountId]: e.target.value,
                  }))
                }
                placeholder="0.40"
                className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-sm tabular-nums"
              />
              <button
                onClick={() => saveAccountApy(a.accountId)}
                className="rounded-full bg-accent px-3 py-1.5 text-xs font-medium text-white"
              >
                Save
              </button>
            </div>
          ))}
          {data.opportunities.map((o) => (
            <div
              key={o.accountId}
              className="flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">
                  {o.name}
                </div>
                <div className="text-xs text-muted">
                  Earning {o.apy.toFixed(2)}% vs. {data.referenceApy!.toFixed(2)}%
                  reference
                </div>
              </div>
              <div className="text-right text-sm font-medium tabular-nums text-foreground">
                +{money0(o.annualOpportunityCost)}/yr
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
```

- [ ] **Step 2: Wire it into the dashboard**

In `app/page.tsx`, add the import alongside the other view imports:

```ts
import { CashPlacementNudge } from "@/components/nudge/CashPlacementNudge";
```

Then render it once, inside the `<main>` returned by `Dashboard()`, right after the `<header>` block and before `<ReportTabs value={tab} onChange={setTab} />`:

```tsx
      <ReportTabs value={tab} onChange={setTab} />
```

becomes:

```tsx
      <CashPlacementNudge />

      <ReportTabs value={tab} onChange={setTab} />
```

- [ ] **Step 3: Manually verify end-to-end**

Run: `npm run dev`, log in, load the dashboard.

Expected, in order as you exercise it:
1. With no reference rate set: the card shows the "See if your cash is earning what it could" setup prompt (assuming at least one depository account with balance ≥ $500 exists — if not, the card renders nothing, which is also correct).
2. Enter a reference rate (e.g. `4.10`) and Save — card switches to showing "What does '<account name>' currently earn?" rows for any depository account without an `apy` set.
3. Enter a low APY (e.g. `0.10`) for one such account and Save — that account moves from a "needs rate" row to an opportunity row showing the gap and an estimated `+$X/yr`.
4. Enter an APY close to the reference rate (e.g. `3.90` when reference is `4.10`, a 0.2pp gap) for another account — confirm it disappears entirely (below the 0.5pp threshold), not shown in either list.
5. Click the ✕ dismiss button — card disappears immediately.
6. Reload the page — card stays hidden (still snoozed).

- [ ] **Step 4: Commit**

```bash
git add components/nudge/CashPlacementNudge.tsx app/page.tsx
git commit -m "feat: add Cash Placement Nudge card to dashboard"
```

---

### Task 6: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the existing `income`/`spending`/`cashflow`/`investingSummary` tests (untouched) and the new `cashPlacementNudge` tests from Task 2.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: builds successfully with no type errors across the new routes/component.

- [ ] **Step 3: Confirm no regression on other tabs**

In the running dev server, switch through Income / Spending / Cash Flow / Investing tabs and date ranges — confirm they behave exactly as before (the nudge card sits above the tab bar and doesn't refetch or reset on tab/range changes).
