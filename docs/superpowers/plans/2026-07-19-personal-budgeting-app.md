# Personal Budgeting App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-user Monarch-style budgeting PWA that syncs Plaid transactions into a local DB and renders Income, Spending, and Cash Flow pages.

**Architecture:** Next.js (App Router) full-stack app. API routes hold the Plaid backend and read/write the database via Prisma. `/transactions/sync` upserts transactions into the DB; report API routes run pure aggregation functions over those rows and return JSON that React chart components render. Installs to the iPhone home screen as a PWA behind a passcode gate.

**Tech Stack:** Next.js 14 + TypeScript, Tailwind CSS, Prisma (SQLite in dev, Postgres in prod), `plaid` + `react-plaid-link`, Recharts (bar/donut/line), d3-sankey (cash flow), Vitest (tests).

## Global Constraints

- **Single user only.** No multi-tenant logic. Auth is one shared passcode from `APP_PASSCODE` env var.
- **v1 is read-only.** Use Plaid's `personal_finance_category` as-is. No transaction editing / re-categorization.
- **Plaid secrets backend-only.** `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` never reach the client. `access_token`s stored in DB, never returned to client.
- **Env vars:** `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` (default `sandbox`), `APP_PASSCODE`, `DATABASE_URL`, `ENCRYPTION_KEY`.
- **Dev DB is SQLite** (`file:./dev.db`) for zero-setup local runs; production switches Prisma `provider` to `postgresql` + a Postgres `DATABASE_URL`. All queries go through Prisma so they are provider-agnostic.
- **Dark theme** matching Monarch reference screenshots. Money formatted `$1,234.56`.
- **Deviation from spec:** `category_map` is a static TypeScript module (`lib/categories.ts`), not a DB table — it is reference data, cleaner to version in code than seed. Noted intentionally.

---

## File Structure

```
app/
  layout.tsx                         # root html, dark theme, PWA meta
  globals.css                        # tailwind + theme tokens
  page.tsx                           # dashboard: tab state + date range, renders active report
  login/page.tsx                     # passcode entry
  api/
    auth/login/route.ts              # POST passcode -> set session cookie
    plaid/link-token/route.ts        # POST -> create_link_token
    plaid/exchange/route.ts          # POST public_token -> store item, initial sync
    plaid/sync/route.ts              # POST -> /transactions/sync all items
    reports/income/route.ts          # GET ?start&end -> income JSON
    reports/spending/route.ts        # GET ?start&end -> spending JSON
    reports/cashflow/route.ts        # GET ?start&end -> cashflow JSON
components/
  ReportTabs.tsx                     # Income | Spending | Cash Flow segmented control
  DateRangePicker.tsx                # range selector
  LinkButton.tsx                     # react-plaid-link trigger
  income/IncomeChart.tsx             # monthly stacked bar
  income/IncomeSummary.tsx           # totals block
  spending/SpendingDonut.tsx         # donut w/ center total
  spending/CategoryList.tsx          # ranked list + show more
  cashflow/SankeyChart.tsx           # d3-sankey svg
  cashflow/StatRow.tsx               # income/expense/net/savings-rate
  ui/Money.tsx, ui/Card.tsx          # shared primitives
lib/
  db.ts                              # prisma singleton
  plaid.ts                           # plaid client factory
  categories.ts                      # PFC -> {display, emoji, group, isIncome}
  aggregations.ts                    # pure report functions over Txn[]
  crypto.ts                          # encrypt/decrypt access tokens
  auth.ts                            # passcode verify + session cookie helpers
  format.ts                          # money/date formatting
  types.ts                          # shared TS types (Txn, report shapes)
prisma/
  schema.prisma
middleware.ts                        # redirect unauthenticated -> /login
public/
  manifest.webmanifest, sw.js, icons/
tests/
  categories.test.ts, aggregations.test.ts, crypto.test.ts
```

Build order rule: **Tasks 1–4 and 6 need no Plaid keys** (scaffold, DB, pure logic, auth). Tasks 5, 7–12 wire Plaid/UI; they can be coded against fixtures and only need real keys for live verification.

---

### Task 1: Scaffold Next.js + Tailwind + dark shell

**Files:**
- Create: `package.json`, `next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `.env.example`
- Test: manual run

**Interfaces:**
- Produces: a running Next.js app on `localhost:3000` with a dark full-screen shell.

- [ ] **Step 1: Scaffold**

```bash
cd "/Users/eastonlovell/Personal Budgeting App"
npx create-next-app@latest . --ts --tailwind --app --eslint --no-src-dir --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Add core deps**

```bash
npm i plaid react-plaid-link recharts d3-sankey d3-shape
npm i -D vitest @types/d3-sankey @types/d3-shape prisma
```

- [ ] **Step 3: Dark theme shell** — replace `app/globals.css` theme tokens (Monarch dark: bg `#0f1115`, card `#1a1d24`, text `#e6e8eb`, accent orange `#f2683c`, green `#3fb98a`, red `#e0574a`) and set `app/layout.tsx` `<html className="dark">` with viewport `viewport-fit=cover`, `theme-color #0f1115`.

- [ ] **Step 4: Placeholder dashboard** — `app/page.tsx` renders a centered "Budget" header on dark bg.

- [ ] **Step 5: Run**

Run: `npm run dev` → open localhost:3000. Expected: dark page renders.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "chore: scaffold next.js + tailwind dark shell"
```

---

### Task 2: Database schema (Prisma)

**Files:**
- Create: `prisma/schema.prisma`, `lib/db.ts`, `lib/types.ts`
- Modify: `.env` (`DATABASE_URL="file:./dev.db"`)

**Interfaces:**
- Produces: Prisma models `Item`, `Account`, `Transaction`; `prisma` client from `lib/db.ts`; `Txn` type in `lib/types.ts`.

- [ ] **Step 1: schema.prisma**

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }

model Item {
  id            String   @id @default(cuid())
  itemId        String   @unique
  accessToken   String   // encrypted at rest
  institution   String
  cursor        String?
  createdAt     DateTime @default(now())
  accounts      Account[]
}
model Account {
  accountId     String   @id
  itemId        String
  item          Item     @relation(fields: [itemId], references: [id])
  name          String
  type          String
  currentBalance Float?
  updatedAt     DateTime @default(now())
  transactions  Transaction[]
}
model Transaction {
  transactionId String   @id
  accountId     String
  account       Account  @relation(fields: [accountId], references: [accountId])
  date          DateTime
  amount        Float
  merchantName  String?
  name          String
  pfPrimary     String
  pfDetailed    String
  isIncome      Boolean
  pending       Boolean  @default(false)
  @@index([date])
}
```

- [ ] **Step 2: types.ts** — export `Txn` (subset used by aggregations):

```ts
export type Txn = {
  transactionId: string; date: Date; amount: number;
  merchantName: string | null; name: string;
  pfPrimary: string; pfDetailed: string; isIncome: boolean;
};
```

- [ ] **Step 3: db.ts** — Prisma singleton (guard against dev hot-reload duplicates).

- [ ] **Step 4: Migrate**

Run: `npx prisma migrate dev --name init`
Expected: `dev.db` created, migration applied.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: prisma schema for items/accounts/transactions"
```

---

### Task 3: Category mapping module (TDD)

**Files:**
- Create: `lib/categories.ts`, `tests/categories.test.ts`, `vitest.config.ts`

**Interfaces:**
- Produces:
  - `categoryInfo(pfDetailed: string): { display: string; emoji: string; group: string }`
  - `isIncomeCategory(pfPrimary: string): boolean`
  - `GROUPS: string[]` (ordered expense group names)

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { categoryInfo, isIncomeCategory } from "@/lib/categories";

describe("categories", () => {
  it("maps a known detailed category to display/emoji/group", () => {
    const c = categoryInfo("FOOD_AND_DRINK_RESTAURANT");
    expect(c.display).toBe("Restaurants");
    expect(c.group).toBe("Food & Dining");
    expect(c.emoji).toBeTruthy();
  });
  it("falls back gracefully for unknown categories", () => {
    const c = categoryInfo("SOMETHING_WEIRD_XYZ");
    expect(c.display).toBeTruthy();
    expect(c.group).toBe("Other");
  });
  it("classifies income primary categories", () => {
    expect(isIncomeCategory("INCOME")).toBe(true);
    expect(isIncomeCategory("FOOD_AND_DRINK")).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run tests/categories.test.ts`)

- [ ] **Step 3: Implement `lib/categories.ts`** — a `Record<string, {display,emoji,group}>` keyed by Plaid `personal_finance_category` detailed values (cover the common set: INCOME_*, RENT_AND_UTILITIES_*, FOOD_AND_DRINK_*, TRANSPORTATION_*, GENERAL_MERCHANDISE_*, TRAVEL_*, ENTERTAINMENT_*, LOAN_PAYMENTS_*, HOME_IMPROVEMENT_*, PERSONAL_CARE_*, MEDICAL_*, GENERAL_SERVICES_*). Prefix-match on primary for fallback; unknown → `{display: titleCase(primary), emoji:"💸", group:"Other"}`. `isIncomeCategory` = primary starts with `INCOME` or is `TRANSFER_IN`. Export `GROUPS` in display order: Income, Housing, Bills & Utilities, Food & Dining, Transportation, Shopping, Travel & Vacation, Entertainment, Health & Wellness, Other.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** (`feat: plaid category → display/group mapping`)

---

### Task 4: Aggregation logic (TDD) — the analytical core

**Files:**
- Create: `lib/aggregations.ts`, `tests/aggregations.test.ts`

**Interfaces:**
- Consumes: `Txn` (Task 2), `categoryInfo`/`isIncomeCategory`/`GROUPS` (Task 3).
- Produces:
  - `incomeByMonth(txns: Txn[]): { month: string; sources: Record<string, number>; total: number }[]`
  - `incomeSummary(txns): { total: number; count: number; largest: number }`
  - `spendingByCategory(txns): { detailed: string; display: string; emoji: string; amount: number }[]` (desc by amount)
  - `cashflowSankey(txns): { nodes: {name:string}[]; links: {source:number;target:number;value:number}[] }`
  - `cashflowStats(txns): { income: number; expenses: number; net: number; savingsRate: number }`
- Convention: expense amounts stored positive in outputs; Plaid outflow `amount > 0`, inflow `amount < 0` (Plaid sign convention — verify in Task 5 and normalize on ingest so `isIncome` + positive magnitude are the source of truth).

- [ ] **Step 1: Failing tests** (fixture of ~6 txns across 2 months, income + several categories):

```ts
import { describe, it, expect } from "vitest";
import { incomeSummary, spendingByCategory, cashflowStats } from "@/lib/aggregations";
import type { Txn } from "@/lib/types";

const t = (o: Partial<Txn>): Txn => ({
  transactionId: Math.random().toString(), date: new Date("2026-01-15"),
  amount: 0, merchantName: null, name: "x",
  pfPrimary: "GENERAL_MERCHANDISE", pfDetailed: "GENERAL_MERCHANDISE_OTHER",
  isIncome: false, ...o,
});

const fixture: Txn[] = [
  t({ isIncome: true, pfPrimary: "INCOME", pfDetailed: "INCOME_WAGES", amount: 4000 }),
  t({ isIncome: true, pfPrimary: "INCOME", pfDetailed: "INCOME_INTEREST_EARNED", amount: 50 }),
  t({ pfPrimary: "RENT_AND_UTILITIES", pfDetailed: "RENT_AND_UTILITIES_RENT", amount: 2000 }),
  t({ pfPrimary: "FOOD_AND_DRINK", pfDetailed: "FOOD_AND_DRINK_GROCERIES", amount: 300 }),
  t({ pfPrimary: "FOOD_AND_DRINK", pfDetailed: "FOOD_AND_DRINK_RESTAURANT", amount: 120 }),
];

describe("aggregations", () => {
  it("income summary sums inflows", () => {
    const s = incomeSummary(fixture);
    expect(s.total).toBe(4050); expect(s.count).toBe(2); expect(s.largest).toBe(4000);
  });
  it("spending groups by category desc", () => {
    const rows = spendingByCategory(fixture);
    expect(rows[0].amount).toBe(2000);
    expect(rows.find(r => r.detailed === "FOOD_AND_DRINK_GROCERIES")!.amount).toBe(300);
  });
  it("cashflow stats compute savings rate", () => {
    const c = cashflowStats(fixture);
    expect(c.income).toBe(4050); expect(c.expenses).toBe(2420);
    expect(c.net).toBe(1630); expect(c.savingsRate).toBeCloseTo(1630/4050);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `lib/aggregations.ts`** — pure functions. Income fns filter `isIncome`; spending/cashflow filter `!isIncome`. `incomeByMonth` buckets by `YYYY-MM`, sums per `categoryInfo(pfDetailed).display`. `spendingByCategory` groups by `pfDetailed`, attaches display/emoji, sorts desc. `cashflowSankey` builds nodes: income source displays → "Income" → expense group → (optionally leaf); links weighted by summed amounts; add "Savings" leaf = net if positive. `cashflowStats`: income=Σ income, expenses=Σ expense, net, savingsRate = income ? net/income : 0.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** (`feat: income/spending/cashflow aggregations`)

---

### Task 5: Plaid client + link/exchange/sync API routes

**Files:**
- Create: `lib/plaid.ts`, `lib/crypto.ts`, `tests/crypto.test.ts`, `app/api/plaid/link-token/route.ts`, `app/api/plaid/exchange/route.ts`, `app/api/plaid/sync/route.ts`

**Interfaces:**
- Consumes: `prisma` (Task 2), `isIncomeCategory` (Task 3).
- Produces: `POST /api/plaid/link-token` → `{ link_token }`; `POST /api/plaid/exchange {public_token}` → `{ ok }` (stores encrypted item + runs first sync); `POST /api/plaid/sync` → `{ added, modified, removed }`.

- [ ] **Step 1: crypto TDD** — `encrypt(s)`/`decrypt(s)` via AES-256-GCM from `ENCRYPTION_KEY`. Test: `decrypt(encrypt("tok")) === "tok"`. Run fail → implement → pass.

- [ ] **Step 2: plaid.ts** — `plaidClient()` builds `PlaidApi` with `PLAID_ENV` basePath + `PLAID-CLIENT-ID`/`PLAID-SECRET` headers.

- [ ] **Step 3: link-token route** — `linkTokenCreate` with `products:["transactions"]`, `country_codes:["US"]`, `language:"en"`, `client_name:"Budget"`, `user.client_user_id:"me"`.

- [ ] **Step 4: exchange route** — `itemPublicTokenExchange` → get `access_token`+`item_id` → `institutionsGetById`/item name → `prisma.item.create` with `encrypt(access_token)` → call sync helper.

- [ ] **Step 5: sync route + helper** — for each item: `transactionsSync` loop over `has_more` with stored `cursor`; upsert `added`/`modified` (map fields; `isIncome = isIncomeCategory(pf.primary)`; normalize amount magnitude), delete `removed`; save `next_cursor`; upsert `accounts` + balances via `accountsGet`.

- [ ] **Step 6: Verify** — with sandbox keys in `.env`, exchange a sandbox public token (Plaid sandbox `/sandbox/public_token/create`) and confirm rows land in `dev.db` (`npx prisma studio`).

- [ ] **Step 7: Commit** (`feat: plaid link/exchange/sync with encrypted tokens`)

---

### Task 6: Passcode auth + middleware

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/login/route.ts`, `app/login/page.tsx`, `middleware.ts`

**Interfaces:**
- Produces: session cookie `budget_session` (signed) set on correct `APP_PASSCODE`; `middleware.ts` redirects unauthenticated non-`/login`, non-`/api/auth` requests to `/login`.

- [ ] **Step 1** login page: single passcode field → `POST /api/auth/login`.
- [ ] **Step 2** login route: compare to `APP_PASSCODE`, set HTTP-only signed cookie (HMAC of a server secret), 30-day expiry.
- [ ] **Step 3** `auth.ts`: `verifySession(req)` reads+validates cookie.
- [ ] **Step 4** middleware: guard all routes except `/login`, `/api/auth/*`, static.
- [ ] **Step 5** Manual verify: hitting `/` unauthenticated → `/login`; correct passcode → dashboard.
- [ ] **Step 6** Commit (`feat: passcode gate + session middleware`)

---

### Task 7: Report API routes

**Files:**
- Create: `app/api/reports/income/route.ts`, `.../spending/route.ts`, `.../cashflow/route.ts`

**Interfaces:**
- Consumes: `prisma`, aggregations (Task 4), `verifySession` (Task 6).
- Produces: each `GET ?start=YYYY-MM-DD&end=YYYY-MM-DD` loads `Txn[]` in range and returns the matching aggregation JSON.

- [ ] **Step 1** shared query: `prisma.transaction.findMany({ where: { date: { gte, lte } } })` → map to `Txn`.
- [ ] **Step 2** income route → `{ byMonth: incomeByMonth(txns), summary: incomeSummary(txns) }`.
- [ ] **Step 3** spending route → `{ total, categories: spendingByCategory(txns) }`.
- [ ] **Step 4** cashflow route → `{ sankey: cashflowSankey(txns), stats: cashflowStats(txns) }`.
- [ ] **Step 5** Verify with `curl` against seeded/sandbox data.
- [ ] **Step 6** Commit (`feat: income/spending/cashflow report endpoints`)

---

### Task 8: UI shell — tabs, date range, theme primitives

**Files:**
- Create: `components/ReportTabs.tsx`, `components/DateRangePicker.tsx`, `components/ui/Card.tsx`, `components/ui/Money.tsx`, `lib/format.ts`
- Modify: `app/page.tsx` (client component holding `tab` + `range` state, fetches active report, renders section)

**Interfaces:**
- Consumes: report endpoints (Task 7).
- Produces: `app/page.tsx` with segmented `Income | Spending | Cash Flow` control + date range, calling the right endpoint on change.
- **Skill:** apply `ui-ux-pro-max` for the segmented control + dark dashboard layout; `dataviz` palette for chart tokens defined here.

- [ ] Steps: build segmented control (pill highlight like reference), month/range picker (default: last 6 months), `format.ts` money/date helpers, wire fetch-on-change + loading state, commit (`feat: dashboard shell with report tabs + date range`).

---

### Task 9: Income page

**Files:** Create `components/income/IncomeChart.tsx`, `components/income/IncomeSummary.tsx`

**Interfaces:** Consumes income endpoint. Produces stacked monthly `BarChart` (Recharts) colored by source + summary block (date range, total income, total transactions, largest transaction).

- [ ] Build stacked bar (one `<Bar>` per income source, `dataviz` categorical palette), legend with per-source totals, summary card; verify against sandbox/seed; commit (`feat: income page`).

---

### Task 10: Spending page

**Files:** Create `components/spending/SpendingDonut.tsx`, `components/spending/CategoryList.tsx`

**Interfaces:** Consumes spending endpoint. Produces donut (Recharts `PieChart` innerRadius) with center total, ranked category list (emoji + name + amount) with "Show more" past top 8.

- [ ] Build donut + centered total overlay, category rows, show-more toggle; `dataviz` palette shared with chart; verify; commit (`feat: spending page`).

---

### Task 11: Cash Flow page (Sankey)

**Files:** Create `components/cashflow/SankeyChart.tsx`, `components/cashflow/StatRow.tsx`

**Interfaces:** Consumes cashflow endpoint. Produces `StatRow` (Total income · Total expenses · Net income · Savings rate %) + Sankey via `d3-sankey` rendered as SVG (nodes as rects, links as `sankeyLinkHorizontal` paths, labels with amount + %).

- [ ] **Step 1** StatRow four-stat header.
- [ ] **Step 2** Sankey: run `d3-sankey` layout on `{nodes,links}`, render SVG rects+paths, color links by group (`dataviz` palette), label each node `name — $amount (x.x%)`. Make horizontally scrollable on narrow screens.
- [ ] **Step 3** Verify visual vs reference screenshot 4; commit (`feat: cash flow sankey page`).

---

### Task 12: Plaid Link button (connect a bank)

**Files:** Create `components/LinkButton.tsx`; Modify `app/page.tsx` (empty-state "Connect a bank")

**Interfaces:** Consumes `/api/plaid/link-token`, `/api/plaid/exchange`. Uses `react-plaid-link` `usePlaidLink`.

- [ ] Fetch link token → open Plaid Link → on success POST public_token to exchange → trigger sync → refetch reports. Show a "＋ Add account" affordance and an empty state when no items exist. Commit (`feat: plaid link connect flow`).

---

### Task 13: PWA (installable, full-screen)

**Files:** Create `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*`; Modify `app/layout.tsx` (manifest link, apple-touch-icon, `apple-mobile-web-app-capable`)

- [ ] Manifest: `display:standalone`, `theme_color`/`background_color` `#0f1115`, name "Budget", 192/512 icons (generate simple orange butterfly-ish mark or "$" glyph). Register minimal `sw.js` (network-first, offline shell). Verify Lighthouse "installable". Commit (`feat: PWA manifest + service worker`).

---

### Task 14: End-to-end verification pass

- [ ] With sandbox keys: login → connect sandbox bank (`user_good`/`pass_good`) → sync → all three pages render sandbox data → install to iOS home screen from Safari and confirm full-screen behind passcode. Fix issues. Commit (`test: e2e sandbox verification`).

---

## Deployment (post-v1, when moving off localhost)

Switch Prisma `provider` to `postgresql`, set `DATABASE_URL` to the host's Postgres, `PLAID_ENV=production` once Plaid Production is approved, set all env vars on the host, deploy. (Own task/plan later.)

## Self-Review

- **Spec coverage:** Income/Spending/Cash Flow pages (T9–11), Plaid link+sync into DB (T5,12), Postgres/Prisma model (T2), sync-to-DB strategy (T5,7), passcode security (T6), encrypted tokens (T5), PWA install (T13), savings rate + stat row (T4,11), monthly income history (T4,9) — all mapped. ✓
- **Placeholders:** none; core logic (categories, aggregations, crypto) fully coded with tests. UI tasks specify exact components/props (chart internals are legitimately iterative and covered by concrete library + data-shape specs). ✓
- **Type consistency:** `Txn` defined T2, consumed T4/T7; aggregation return shapes defined once in T4 interfaces and consumed by matching endpoints T7 and components T9–11; `categoryInfo`/`isIncomeCategory`/`GROUPS` names consistent T3→T4. ✓
