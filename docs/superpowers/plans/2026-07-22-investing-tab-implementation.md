# Investing Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only Investing tab showing portfolio value per connected
investment account, and an "Investing" leaf on the Cash Flow Sankey so
transfers to Robinhood show up instead of vanishing as an excluded internal
transfer.

**Architecture:** Two independent additions sharing no code path. (1) A new
`/api/reports/investing` route reads `Account` rows already synced by
`syncItem()` (no new Plaid calls, no schema changes) and a new
`InvestingView` renders them. (2) A narrow new query,
`loadInvestmentTransferTotal()`, sums `TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS`
transactions in range and is passed into `cashflowSankey()` /
`cashflowStats()` as an optional parameter — `loadTxns()` and the
Income/Spending reports are untouched.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma (Postgres),
Vitest, Tailwind v4 (existing tokens only).

## Global Constraints

- Single user only — no multi-tenant logic.
- v1 reports are read-only — no editing/re-categorization.
- No new Plaid product calls, no schema changes (reuse `Account.type`,
  `Account.currentBalance`, `Transaction.pfDetailed`).
- Money formatting via `lib/format.ts` (`money`, `money0`) — never format
  currency inline.
- Dark theme only — use existing CSS variables / `lib/palette.ts` /
  `components/ui/Card.tsx`; no new design language, no new colors.
- A `null` `Account.currentBalance` is excluded from totals (not coerced to
  `0`) but still rendered in lists as "—".
- Income and Spending reports must remain bit-for-bit unchanged; `loadTxns()`
  and its exclusion filter are not touched by this work.

---

### Task 1: Category helper + shared types

**Files:**
- Modify: `lib/categories.ts`
- Modify: `lib/types.ts`
- Test: `tests/categories.test.ts`

**Interfaces:**
- Produces: `INVESTMENT_TRANSFER_DETAILED: string` (exported constant),
  `isInvestmentTransferCategory(pfDetailed: string): boolean` from
  `lib/categories.ts`; `InvestmentAccount`, `InvestingSummary`,
  `InvestingReport` types and an `investing: number` field on
  `CashflowStats` from `lib/types.ts`.

- [ ] **Step 1: Write the failing test for the category helper**

Add to `tests/categories.test.ts` (append inside the existing `describe`
block, after the "flags transfers" test):

```ts
  it("flags only the investment transfer detailed category", () => {
    expect(
      isInvestmentTransferCategory("TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS")
    ).toBe(true);
    expect(isInvestmentTransferCategory("TRANSFER_OUT_SAVINGS")).toBe(false);
    expect(isInvestmentTransferCategory("TRANSFER_IN_DEPOSIT")).toBe(false);
    expect(isInvestmentTransferCategory("FOOD_AND_DRINK_GROCERIES")).toBe(false);
  });
```

Update the import line at the top of the file to include the new symbol:

```ts
import {
  categoryInfo,
  isIncomeCategory,
  isTransfer,
  isInvestmentTransferCategory,
  GROUPS,
} from "@/lib/categories";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/categories.test.ts`
Expected: FAIL — `isInvestmentTransferCategory` is not exported.

- [ ] **Step 3: Add the constant and helper to `lib/categories.ts`**

Append at the end of `lib/categories.ts`, after `isTransfer`:

```ts
/** The one detailed transfer category that represents money leaving for an
 * investment/retirement account, distinct from all other transfers. */
export const INVESTMENT_TRANSFER_DETAILED =
  "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS";

/** True only for the exact detailed category that funds investment accounts. */
export function isInvestmentTransferCategory(pfDetailed: string): boolean {
  return pfDetailed === INVESTMENT_TRANSFER_DETAILED;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/categories.test.ts`
Expected: PASS (5 tests → 6 tests, all green).

- [ ] **Step 5: Add the shared types to `lib/types.ts`**

Add the `investing` field to the existing `CashflowStats` type (around
`lib/types.ts:49-54`):

```ts
export type CashflowStats = {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
  investing: number;
};
```

Append a new "Investing report" section at the end of `lib/types.ts`, after
`CashflowReport`:

```ts

/** Investing report */
export type InvestmentAccount = {
  accountId: string;
  name: string;
  institution: string;
  currentBalance: number | null;
};
export type InvestingSummary = {
  accounts: InvestmentAccount[]; // sorted by balance desc, nulls last
  total: number; // sum of non-null balances only
};
export type InvestingReport = InvestingSummary;
```

- [ ] **Step 6: Verify the project still typechecks**

Run: `npx tsc --noEmit`
Expected: Errors only about `cashflowStats`/`cashflowSankey` call sites and
`CashflowStats` object literals missing the new `investing` field (those are
fixed in Tasks 4 and 6) — no errors related to `lib/types.ts` or
`lib/categories.ts` themselves. If `tsc` reports anything else in those two
files, fix before continuing.

- [ ] **Step 7: Commit**

```bash
git add lib/categories.ts lib/types.ts tests/categories.test.ts
git commit -m "feat: add investment-transfer category helper and investing types"
```

---

### Task 2: `loadInvestmentTransferTotal` query

**Files:**
- Modify: `lib/reports.ts`

**Interfaces:**
- Consumes: `INVESTMENT_TRANSFER_DETAILED` from `lib/categories.ts` (Task 1).
- Produces: `loadInvestmentTransferTotal(start: Date, end: Date):
  Promise<number>`, consumed by `app/api/reports/cashflow/route.ts` (Task 6).

This is an I/O function (like the existing `loadTxns`), so per this repo's
existing convention it has no unit test — only pure functions in
`lib/aggregations.ts` are unit tested. It's covered by the manual
verification in Task 10.

- [ ] **Step 1: Add the import**

At the top of `lib/reports.ts`, update the import from `lib/types` isn't
needed here, but add the categories import:

```ts
import { INVESTMENT_TRANSFER_DETAILED } from "@/lib/categories";
```

- [ ] **Step 2: Add the function**

Append to `lib/reports.ts`, after `loadTxns`:

```ts

/** Sum of transfers into investment/retirement accounts in [start, end].
 * Independent of loadTxns() — Income/Spending reports never see this. */
export async function loadInvestmentTransferTotal(
  start: Date,
  end: Date
): Promise<number> {
  const result = await prisma.transaction.aggregate({
    where: {
      date: { gte: start, lte: end },
      pfDetailed: INVESTMENT_TRANSFER_DETAILED,
    },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No new errors introduced by `lib/reports.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/reports.ts
git commit -m "feat: add loadInvestmentTransferTotal query"
```

---

### Task 3: `investingSummary()` pure function

**Files:**
- Modify: `lib/aggregations.ts`
- Test: `tests/aggregations.test.ts`

**Interfaces:**
- Consumes: `InvestmentAccount`, `InvestingSummary` from `lib/types.ts` (Task 1).
- Produces: `investingSummary(accounts: InvestmentAccount[]):
  InvestingSummary`, consumed by `app/api/reports/investing/route.ts`
  (Task 5).

- [ ] **Step 1: Write the failing tests**

Append to `tests/aggregations.test.ts`, inside the `describe("aggregations")`
block (after the last existing `it`), and add `investingSummary` to the
import list at the top of the file:

```ts
import {
  incomeByMonth,
  incomeSummary,
  incomeReport,
  spendingByCategory,
  cashflowSankey,
  cashflowStats,
  investingSummary,
} from "@/lib/aggregations";
import type { Txn, InvestmentAccount } from "@/lib/types";
```

```ts
  it("investingSummary sorts by balance descending", () => {
    const accounts: InvestmentAccount[] = [
      { accountId: "a1", name: "Brokerage", institution: "Robinhood", currentBalance: 5000 },
      { accountId: "a2", name: "IRA", institution: "Robinhood", currentBalance: 20000 },
      { accountId: "a3", name: "Crypto", institution: "Robinhood", currentBalance: 1200 },
    ];
    const s = investingSummary(accounts);
    expect(s.accounts.map((a) => a.accountId)).toEqual(["a2", "a1", "a3"]);
    expect(s.total).toBe(26200);
  });

  it("investingSummary excludes null balances from the total but keeps them in the list", () => {
    const accounts: InvestmentAccount[] = [
      { accountId: "a1", name: "Brokerage", institution: "Robinhood", currentBalance: 5000 },
      { accountId: "a2", name: "Just linked", institution: "Robinhood", currentBalance: null },
    ];
    const s = investingSummary(accounts);
    expect(s.total).toBe(5000);
    expect(s.accounts).toHaveLength(2);
    expect(s.accounts.find((a) => a.accountId === "a2")!.currentBalance).toBeNull();
    // null balances sort last regardless of magnitude
    expect(s.accounts[s.accounts.length - 1].accountId).toBe("a2");
  });

  it("investingSummary handles an empty account list", () => {
    const s = investingSummary([]);
    expect(s.accounts).toEqual([]);
    expect(s.total).toBe(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/aggregations.test.ts`
Expected: FAIL — `investingSummary` is not exported from `lib/aggregations.ts`.

- [ ] **Step 3: Implement `investingSummary`**

Append to `lib/aggregations.ts`, after `cashflowSankey`, and add
`InvestmentAccount`, `InvestingSummary` to the type import at the top of the
file (`lib/aggregations.ts:3-11`):

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
} from "@/lib/types";
```

```ts

/** Portfolio summary: accounts sorted by balance descending (nulls last),
 * total excludes null balances rather than coercing them to 0. */
export function investingSummary(accounts: InvestmentAccount[]): InvestingSummary {
  const sorted = [...accounts].sort((a, b) => {
    if (a.currentBalance == null) return 1;
    if (b.currentBalance == null) return -1;
    return b.currentBalance - a.currentBalance;
  });
  const total = accounts.reduce(
    (sum, a) => (a.currentBalance == null ? sum : sum + a.currentBalance),
    0
  );
  return { accounts: sorted, total };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/aggregations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/aggregations.ts tests/aggregations.test.ts
git commit -m "feat: add investingSummary aggregation"
```

---

### Task 4: Extend `cashflowSankey` and `cashflowStats` with `investingTotal`

**Files:**
- Modify: `lib/aggregations.ts`
- Test: `tests/aggregations.test.ts`

**Interfaces:**
- Consumes: existing `cashflowSankey(txns: Txn[])` and `cashflowStats(txns:
  Txn[])` at `lib/aggregations.ts:85-95` and `lib/aggregations.ts:102-161`.
- Produces: `cashflowSankey(txns: Txn[], investingTotal = 0): SankeyData`
  and `cashflowStats(txns: Txn[], investingTotal = 0): CashflowStats` (both
  backward compatible — the param is optional and defaults to `0`),
  consumed by `app/api/reports/cashflow/route.ts` (Task 6).

- [ ] **Step 1: Write the failing tests**

Append to `tests/aggregations.test.ts`, inside `describe("aggregations")`:

```ts
  it("cashflow stats include the investing total and default to 0", () => {
    const withDefault = cashflowStats(fixture);
    expect(withDefault.investing).toBe(0);

    const withInvesting = cashflowStats(fixture, 1000);
    expect(withInvesting.investing).toBe(1000);
    // income/expenses/net/savingsRate are unaffected by investingTotal
    expect(withInvesting.income).toBe(8050);
    expect(withInvesting.net).toBe(5630);
  });

  it("cashflow sankey adds an Investing leaf and reduces Savings when investingTotal > 0", () => {
    const withoutInvesting = cashflowSankey(fixture);
    expect(withoutInvesting.nodes.some((n) => n.name === "Investing")).toBe(false);
    const savingsLinkBefore = withoutInvesting.links.find(
      (l) => withoutInvesting.nodes[l.target].name === "Savings"
    )!;
    expect(savingsLinkBefore.value).toBe(5630);

    const withInvesting = cashflowSankey(fixture, 1000);
    expect(withInvesting.nodes.some((n) => n.name === "Investing")).toBe(true);
    const investingLink = withInvesting.links.find(
      (l) => withInvesting.nodes[l.target].name === "Investing"
    )!;
    expect(investingLink.value).toBe(1000);
    const savingsLinkAfter = withInvesting.links.find(
      (l) => withInvesting.nodes[l.target].name === "Savings"
    )!;
    expect(savingsLinkAfter.value).toBe(4630); // 5630 net - 1000 invested
  });

  it("cashflow sankey omits the Investing leaf when investingTotal is 0", () => {
    const s = cashflowSankey(fixture, 0);
    expect(s.nodes.some((n) => n.name === "Investing")).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/aggregations.test.ts`
Expected: FAIL — `cashflowStats(fixture, 1000)`/`cashflowSankey(fixture,
1000)` ignore the second argument (stats.investing is `undefined`, no
Investing node is added).

- [ ] **Step 3: Update `cashflowStats`**

Replace the existing function at `lib/aggregations.ts:85-95`:

```ts
/** Top-level cash flow numbers. */
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

- [ ] **Step 4: Update `cashflowSankey`**

In `lib/aggregations.ts`, change the function signature at line 102 from
`export function cashflowSankey(txns: Txn[]): SankeyData {` to:

```ts
export function cashflowSankey(txns: Txn[], investingTotal = 0): SankeyData {
```

Then replace the tail of the function (currently `lib/aggregations.ts:156-161`):

```ts
  // Savings (positive net) as a leaf off the hub
  const net = totalIncome - totalExpense;
  if (net > 0) addLink(hub, addNode("sav:Savings", "Savings"), net);

  return { nodes, links };
}
```

with:

```ts
  // Investing (money transferred to investment accounts) as a leaf off the
  // hub, added before Savings so Savings reflects the true leftover.
  if (investingTotal > 0) {
    addLink(hub, addNode("inv:Investing", "Investing"), investingTotal);
  }

  // Savings (positive net, minus what was invested) as a leaf off the hub
  const net = totalIncome - totalExpense;
  const savings = net - investingTotal;
  if (savings > 0) addLink(hub, addNode("sav:Savings", "Savings"), savings);

  return { nodes, links };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/aggregations.test.ts`
Expected: PASS — all aggregation tests green, including the pre-existing
`cashflow stats compute net and savings rate` and `cashflow sankey builds
valid node/link indices` tests (regression check: they call the functions
with one argument, which still works because `investingTotal` defaults to
`0`).

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: All test files pass (categories, aggregations, and any others in
`tests/`).

- [ ] **Step 7: Commit**

```bash
git add lib/aggregations.ts tests/aggregations.test.ts
git commit -m "feat: add Investing leaf to cashflow sankey and stats"
```

---

### Task 5: `GET /api/reports/investing` route

**Files:**
- Create: `app/api/reports/investing/route.ts`

**Interfaces:**
- Consumes: `investingSummary()` from `lib/aggregations.ts` (Task 3),
  `InvestmentAccount`, `InvestingReport` from `lib/types.ts` (Task 1),
  `prisma` from `lib/db.ts`.
- Produces: `GET` handler returning `InvestingReport` JSON, consumed by
  `app/page.tsx` (Task 8).

No new Plaid calls — this reads `Account` rows already populated by
`syncItem()` in `lib/sync.ts:39-54`, which stores Plaid's account `type`
(e.g. `"investment"`) as a plain string via `type: String(a.type)`.

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { investingSummary } from "@/lib/aggregations";
import type { InvestmentAccount, InvestingReport } from "@/lib/types";

export async function GET() {
  const rows = await prisma.account.findMany({
    where: { type: "investment" },
    include: { item: true },
  });
  const accounts: InvestmentAccount[] = rows.map((r) => ({
    accountId: r.accountId,
    name: r.name,
    institution: r.item.institution,
    currentBalance: r.currentBalance,
  }));
  const report: InvestingReport = investingSummary(accounts);
  return NextResponse.json(report);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `app/api/reports/investing/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/reports/investing/route.ts
git commit -m "feat: add GET /api/reports/investing route"
```

---

### Task 6: Wire `investingTotal` into the cashflow route

**Files:**
- Modify: `app/api/reports/cashflow/route.ts`

**Interfaces:**
- Consumes: `loadInvestmentTransferTotal` from `lib/reports.ts` (Task 2),
  the updated `cashflowSankey`/`cashflowStats` signatures from `lib/aggregations.ts` (Task 4).

- [ ] **Step 1: Replace the route**

Replace the full contents of `app/api/reports/cashflow/route.ts`:

```ts
import { NextResponse } from "next/server";
import { parseRange, loadTxns, loadInvestmentTransferTotal } from "@/lib/reports";
import { cashflowSankey, cashflowStats } from "@/lib/aggregations";
import type { CashflowReport } from "@/lib/types";

export async function GET(req: Request) {
  const { start, end } = parseRange(req.url);
  const [txns, investingTotal] = await Promise.all([
    loadTxns(start, end),
    loadInvestmentTransferTotal(start, end),
  ]);
  const report: CashflowReport = {
    sankey: cashflowSankey(txns, investingTotal),
    stats: cashflowStats(txns, investingTotal),
  };
  return NextResponse.json(report);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `app/api/reports/cashflow/route.ts`.

- [ ] **Step 3: Run the full test suite as a regression check**

Run: `npm test`
Expected: All tests still pass (this route has no direct unit tests, but
confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add app/api/reports/cashflow/route.ts
git commit -m "feat: pass investment transfer total into cashflow report"
```

---

### Task 7: `InvestingView` component

**Files:**
- Create: `components/investing/InvestingView.tsx`

**Interfaces:**
- Consumes: `InvestingReport` from `lib/types.ts` (Task 1), `money`/`money0`
  from `lib/format.ts`, `Card` from `components/ui/Card.tsx`.
- Produces: `InvestingView({ data }: { data: InvestingReport })`, consumed
  by `app/page.tsx` (Task 8).

Modeled on `components/spending/SpendingView.tsx`'s composition style
(a `Card` for the headline stat, a `Card` with a bordered row list below),
reusing existing card/row CSS classes — no new styles introduced. The empty
state (no investment accounts) is rendered inline here rather than via the
shared `ConnectEmptyState` in `components/LinkButton.tsx`, because that
component's copy and CTA ("Connect a bank") are about having zero accounts
of any kind; here the user may already have bank accounts connected but
simply no `investment`-type ones yet.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import type { InvestingReport } from "@/lib/types";
import { money, money0 } from "@/lib/format";
import { Card } from "@/components/ui/Card";

export function InvestingView({ data }: { data: InvestingReport }) {
  if (data.accounts.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="text-4xl">📈</div>
        <div>
          <p className="font-medium">No investment accounts yet</p>
          <p className="mt-1 text-sm text-muted">
            Connect a brokerage or retirement account to see your portfolio
            here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="text-xs text-muted">Total portfolio value</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">
          {money0(data.total)}
        </div>
      </Card>
      <Card>
        <div className="flex flex-col">
          {data.accounts.map((a) => (
            <div
              key={a.accountId}
              className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-foreground">{a.name}</div>
                <div className="text-xs text-muted">{a.institution}</div>
              </div>
              <div className="tabular-nums text-sm text-foreground">
                {a.currentBalance == null ? "—" : money(a.currentBalance)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `components/investing/InvestingView.tsx` (it isn't
referenced from `app/page.tsx` yet, but should still typecheck standalone).

- [ ] **Step 3: Commit**

```bash
git add components/investing/InvestingView.tsx
git commit -m "feat: add InvestingView component"
```

---

### Task 8: Wire the Investing tab into the dashboard shell

**Files:**
- Modify: `components/ReportTabs.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `InvestingView` from `components/investing/InvestingView.tsx`
  (Task 7), `InvestingReport` from `lib/types.ts` (Task 1).
- Produces: `Tab` now includes `"investing"`, consumed by both files below.

- [ ] **Step 1: Add the tab to `components/ReportTabs.tsx`**

Replace lines 3-9 of `components/ReportTabs.tsx`:

```ts
export type Tab = "income" | "spending" | "cashflow" | "investing";

const TABS: { id: Tab; label: string }[] = [
  { id: "income", label: "Income" },
  { id: "spending", label: "Spending" },
  { id: "cashflow", label: "Cash Flow" },
  { id: "investing", label: "Investing" },
];
```

- [ ] **Step 2: Wire it into `app/page.tsx`**

Update the imports at the top of `app/page.tsx` (lines 13-21):

```ts
import { IncomeView } from "@/components/income/IncomeView";
import { SpendingView } from "@/components/spending/SpendingView";
import { CashflowView } from "@/components/cashflow/CashflowView";
import { InvestingView } from "@/components/investing/InvestingView";
import {
  ConnectEmptyState,
  AddAccountButton,
  PlaidOAuthResume,
} from "@/components/LinkButton";
import type {
  IncomeReport,
  SpendingReport,
  CashflowReport,
  InvestingReport,
} from "@/lib/types";
```

Update the `ENDPOINT` map (lines 23-27):

```ts
const ENDPOINT: Record<Tab, string> = {
  income: "/api/reports/income",
  spending: "/api/reports/spending",
  cashflow: "/api/reports/cashflow",
  investing: "/api/reports/investing",
};
```

Update the `data` state type (line 49-51):

```ts
  const [data, setData] = useState<
    IncomeReport | SpendingReport | CashflowReport | InvestingReport | null
  >(null);
```

Update the `empty` computation (lines 81-88) to add an `investing` branch
that always evaluates to `false` — the Investing tab renders its own
"No investment accounts yet" empty state (Task 7) rather than the generic
"Connect a bank" prompt, since a user viewing this tab may already have
non-investment accounts connected:

```ts
  const empty =
    ready &&
    (tab === "income"
      ? (data as IncomeReport).summary.count === 0
      : tab === "spending"
        ? (data as SpendingReport).total === 0
        : tab === "cashflow"
          ? (data as CashflowReport).stats.income === 0 &&
            (data as CashflowReport).stats.expenses === 0
          : false);
```

Update the render switch (lines 102-114):

```tsx
      {!ready ? (
        <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted">
          Loading…
        </div>
      ) : empty ? (
        <ConnectEmptyState onLinked={load} />
      ) : tab === "income" ? (
        <IncomeView data={data as IncomeReport} range={range} />
      ) : tab === "spending" ? (
        <SpendingView data={data as SpendingReport} />
      ) : tab === "cashflow" ? (
        <CashflowView data={data as CashflowReport} />
      ) : (
        <InvestingView data={data as InvestingReport} />
      )}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `app/page.tsx` or `components/ReportTabs.tsx`.

- [ ] **Step 4: Run the full test suite as a regression check**

Run: `npm test`
Expected: All tests still pass.

- [ ] **Step 5: Commit**

```bash
git add components/ReportTabs.tsx app/page.tsx
git commit -m "feat: add Investing tab to dashboard shell"
```

---

### Task 9: "Investing" stat cell on the Cash Flow tab

**Files:**
- Modify: `components/cashflow/StatRow.tsx`

**Interfaces:**
- Consumes: `CashflowStats.investing` from `lib/types.ts` (Task 1, already
  populated by Task 4/6).

- [ ] **Step 1: Add the 5th stat cell**

Replace the `items` array in `components/cashflow/StatRow.tsx` (lines 6-11):

```ts
  const items = [
    { label: "Total income", value: money0(stats.income), color: CHART.positive },
    { label: "Total expenses", value: money0(stats.expenses), color: CHART.negative },
    { label: "Net income", value: money0(stats.net), color: stats.net >= 0 ? CHART.positive : CHART.negative },
    { label: "Savings rate", value: `${(stats.savingsRate * 100).toFixed(1)}%`, color: CHART.textPrimary },
    { label: "Investing", value: money0(stats.investing), color: CHART.textPrimary },
  ];
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: No errors in `components/cashflow/StatRow.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/cashflow/StatRow.tsx
git commit -m "feat: show Investing total in cashflow stat row"
```

---

### Task 10: Manual verification

**Files:** none (verification only, per the spec's Testing section).

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: All test files pass — `tests/categories.test.ts` and
`tests/aggregations.test.ts` (plus any others already in the repo).

- [ ] **Step 2: Run a full typecheck**

Run: `npx tsc --noEmit`
Expected: No errors anywhere in the project.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: Production build succeeds (catches any Next.js App Router route
or client/server boundary issues the typecheck alone wouldn't).

- [ ] **Step 4: Start the dev server and sync real data**

Run: `npm run dev`

In the browser at `localhost:3000`:
1. Log in with the passcode.
2. Confirm the Plaid background sync completes (existing behavior,
   unchanged).
3. Open the **Investing** tab. Confirm it shows the real linked Robinhood
   accounts (individual / crypto / IRA) with balances matching what
   Robinhood/Plaid report, sorted largest balance first.
4. Switch to **Cash Flow**. Confirm the Sankey shows an **Investing** leaf
   off the Income hub sized to actual Wells Fargo → Robinhood transfers in
   the selected date range, and that the **Savings** leaf is reduced by
   that same amount. Confirm the new **Investing** stat cell in the row
   above the chart matches the leaf's value.
5. Switch to **Income** and **Spending**. Confirm both look exactly as they
   did before this change (same totals, same categories) — this is the
   regression check for the "Income/Spending unaffected" success
   criterion.
6. Change the date range to one with no investment transfers (e.g. a very
   short recent window). Confirm the Sankey omits the Investing leaf
   entirely and the Investing stat cell shows $0.

- [ ] **Step 5: Confirm no residual changes are uncommitted**

Run: `git status`
Expected: Clean working tree (aside from any pre-existing unrelated
in-progress work you started this plan with, e.g. the
`LOAN_PAYMENTS_CREDIT_CARD_PAYMENT` fix already on disk before this plan
began — do not commit that here; it belongs to its own prior change).
