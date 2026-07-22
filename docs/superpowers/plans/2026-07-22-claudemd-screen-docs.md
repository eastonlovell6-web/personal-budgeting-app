# CLAUDE.md Screen-by-Screen Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a root `CLAUDE.md` plus a `claudemd/` folder (best practices reference, per-screen doc template, and one doc per screen — 5 shipped, 6 planned) so Claude Code has accurate, screen-scoped context for continued buildout of this budgeting app.

**Architecture:** Pure documentation change, no app code touched. Root `CLAUDE.md` stays short/universal (stack, constraints, commands, screen index) per Claude Code's progressive-disclosure guidance; each screen gets its own file under `claudemd/screens/` that Claude reads on demand when working on that screen.

**Tech Stack:** Markdown only. No build step — "testing" a task means verifying the file exists, is under the line budget, and (for shipped screens) that its `file:line` pointers still match the real source.

## Global Constraints

- Every file goes in `/Users/eastonlovell/Personal Budgeting App/` (this repo), not the Obsidian vault.
- Root `CLAUDE.md` stays under ~150 lines — universal content only (stack, global constraints, commands, screen index). No screen-specific detail.
- Each `claudemd/screens/*.md` file targets 60-120 lines.
- Use `file:line` pointers into real source, never inlined code blocks that can drift out of date.
- No lint/style rules go into any of these files — that's `eslint.config.mjs`'s job.
- Shipped-screen docs must cite the actual commit(s) that built them (from `git log --oneline`) and real file:line references verified against current source — not guessed.
- Planned-screen docs must be seeded from `Projects/budgeting-app.md` (the vault's product vision doc, path: `/Users/eastonlovell/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Second Brain/Projects/budgeting-app.md`) and must NOT invent implementation details that vault doc doesn't support.
- Design spec of record: `docs/superpowers/specs/2026-07-22-claudemd-screen-docs-design.md`.

---

### Task 1: Root `CLAUDE.md`

**Files:**
- Create: `CLAUDE.md`

**Interfaces:**
- Produces: the project-wide auto-loaded file every session reads; other tasks' files are referenced from its screen-index table.

- [ ] **Step 1: Write `CLAUDE.md`**

```markdown
# Budget — Personal Budgeting App

A personal, single-user budgeting PWA modeled on Monarch Money. Connects to
the user's bank via Plaid, syncs transactions into a local database, and
renders Income, Spending, and Cash Flow reports. Installs to the iPhone home
screen as a PWA — no App Store.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4 (Monarch-style dark theme, tokens in `app/globals.css`)
- Prisma — SQLite in dev (`prisma/dev.db`), Postgres in prod
- Plaid (`plaid` + `react-plaid-link`) for bank connectivity
- Recharts (bar/donut) + `d3-sankey` (cash flow diagram)
- Vitest for unit tests

## Global Constraints

- **Single user only** — no multi-tenant logic; one shared `APP_PASSCODE`.
- **v1 reports are read-only** — categories come straight from Plaid's
  `personal_finance_category`; no editing/re-categorization yet.
- **Plaid secrets never reach the client** — `PLAID_CLIENT_ID`/`PLAID_SECRET`
  stay server-side; `access_token`s are encrypted at rest (`lib/crypto.ts`)
  and never returned to the client.
- **Money formatting**: `$1,234.56` via `lib/format.ts` (`money`, `money0`,
  `moneyCompact`) — never format currency inline.
- **Dark theme only** — tokens in `app/globals.css`; don't hardcode colors,
  use the CSS variables / `lib/palette.ts`.
- **Don't hardcode financial figures that go stale** (APY rates, Roth IRA
  limits) once those features exist — pull from a source that can be
  updated. See `claudemd/best-practices.md`.

## Commands

- `npm run dev` — localhost:3000
- `npm run build` — production build
- `npm test` — Vitest (categories, aggregations, crypto)
- `npm run seed` — inserts 6 months of fake transactions (no Plaid needed)
- `npx prisma migrate dev` — apply schema changes

## Screen-by-Screen Docs

Before making UI changes to a screen, read its file in `claudemd/screens/`.
Each covers purpose, layout, data contract, and the fintech UX principles
(see `claudemd/best-practices.md`) that screen should honor.

| Screen | Status | Doc |
|---|---|---|
| Login (passcode gate) | Shipped | `claudemd/screens/login.md` |
| Dashboard shell (tabs, date range, empty state) | Shipped | `claudemd/screens/dashboard-shell.md` |
| Income | Shipped | `claudemd/screens/income.md` |
| Spending | Shipped | `claudemd/screens/spending.md` |
| Cash Flow | Shipped | `claudemd/screens/cashflow.md` |
| Cash Placement Nudge | Planned | `claudemd/screens/cash-placement-nudge.md` |
| Automated Savings Rules | Planned | `claudemd/screens/automated-savings-rules.md` |
| Goals (savings buckets) | Planned | `claudemd/screens/goals.md` |
| Investing Education (Roth IRA) | Planned | `claudemd/screens/investing-education.md` |
| Budgeting Mode Toggle | Planned | `claudemd/screens/budgeting-mode-toggle.md` |
| Notifications | Planned | `claudemd/screens/notifications.md` |

Full product spec/plan history lives in `docs/superpowers/specs/` and
`docs/superpowers/plans/` — the screen docs point into those rather than
repeating them.
```

- [ ] **Step 2: Verify line budget**

Run: `wc -l CLAUDE.md`
Expected: under 150.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add root CLAUDE.md with stack, constraints, and screen-doc index"
```

---

### Task 2: `claudemd/best-practices.md`

**Files:**
- Create: `claudemd/best-practices.md`

**Interfaces:**
- Produces: shared reference other screen docs point to for CLAUDE.md-authoring rules and the four fintech UX principles (Trust, Clarity, Empowerment, Continuity).

- [ ] **Step 1: Create directory and write the file**

```bash
mkdir -p claudemd/screens
```

```markdown
# Best Practices Reference

Distilled from research done 2026-07-22 (see
`docs/superpowers/specs/2026-07-22-claudemd-screen-docs-design.md`). Screen
docs point here instead of repeating this content.

## Writing/using these docs (CLAUDE.md authoring)

- Root `CLAUDE.md` stays short and universal — stack, constraints, commands,
  and the screen-doc index. Nothing screen-specific goes there.
- Each screen doc uses **progressive disclosure**: read it only when working
  on that screen, not preloaded every session.
- **Point, don't paste.** Reference source with `file:line`, not inlined
  code blocks — code changes; a stale inline copy misleads faster than a
  missing one.
- Don't put lint/style rules here — that's what `eslint.config.mjs` and
  `npm run lint` are for. Claude should infer conventions from the existing
  code, not a style guide.
- When a screen doc's file:line pointers drift after a refactor, fix the
  doc in the same commit as the refactor — don't let it go stale.

## Fintech UX principles (apply per-screen)

**Trust** — Users are taking a leap of faith with financial data. Show
security/permission context explicitly (e.g. the passcode gate, "your data
stays local"), never hide fees or what a Plaid connection can see, avoid
dark patterns (no pre-checked opt-ins, no disguised buttons).

**Clarity** — One primary number per screen (Income's total, Spending's
donut-center total, Cash Flow's stat row). Progressive disclosure for
secondary detail (Spending's "Show more" past the top 8 categories). Never
rely on color alone for positive/negative — pair with a label or icon,
since not everyone reads red/green the same way (Cash Flow's stat row
already does this via explicit labels, keep that pattern).

**Empowerment** — Frame behavioral insights positively, not as judgment.
"You spent 20% more on dining this month" beats "You're overspending on
dining." Applies most to the not-yet-built nudge/automation/notification
screens.

**Continuity** — Preserve state across the flows that already exist (tab +
date range selection while switching reports, session cookie across app
opens) and any new screen should do the same — don't reset user context on
navigation.

## Fintech data-integrity rule

Never hardcode a financial figure that changes over time (APY rates, Roth
IRA contribution limits/phase-outs) directly in app copy. Pull from a
source that can be updated, or refresh manually every tax year — called out
as an explicit risk in `Projects/budgeting-app.md` (Obsidian vault).
```

- [ ] **Step 2: Verify line budget**

Run: `wc -l claudemd/best-practices.md`
Expected: under 120.

- [ ] **Step 3: Commit**

```bash
git add claudemd/best-practices.md
git commit -m "docs: add fintech UX + CLAUDE.md authoring best-practices reference"
```

---

### Task 3: `claudemd/_template.md`

**Files:**
- Create: `claudemd/_template.md`

**Interfaces:**
- Produces: the template copied for every screen doc in this plan and for any future screen.

- [ ] **Step 1: Write the file**

```markdown
# Screen: <Name>

## Purpose

<One paragraph: what this screen is for and who uses it.>

## Status

<Shipped | Planned> — <if shipped: which commit(s) built it>

## Key Files

- `path/to/file.tsx:LINE` — <what it does>

(Point at real files/lines. Don't inline code here — it goes stale.)

## Layout / UI Spec

<Structure, hierarchy, one primary value for this screen, states shown:
loading / empty / error.>

## Data Contract

<The API/report shape this screen consumes — name the type and point at
`lib/types.ts`, don't repeat the full shape here.>

## Fintech UX Principles Applied

<Which of Trust / Clarity / Empowerment / Continuity (see
`claudemd/best-practices.md`) matter most here, and how this screen
embodies them.>

## Open Questions / Risks

<Pulled from `Projects/budgeting-app.md` or `docs/superpowers/specs/` where
applicable. Leave "None currently open" if there aren't any yet.>

## How to Verify

<Manual check or `npm test` file specific to this screen. "N/A until
built" for planned screens.>
```

- [ ] **Step 2: Verify it exists**

Run: `test -f claudemd/_template.md && echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add claudemd/_template.md
git commit -m "docs: add screen-doc template for future screens"
```

---

### Task 4: `claudemd/screens/login.md` (shipped)

**Files:**
- Create: `claudemd/screens/login.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure, `claudemd/best-practices.md` (Trust principle).

- [ ] **Step 1: Write the file**

```markdown
# Screen: Login

## Purpose

Passcode gate — the only entry point to the app when unauthenticated.
Protects financial data since the PWA may be reachable on the public
internet (single shared passcode, no per-user accounts).

## Status

Shipped — commit `ad32424` ("feat: passcode gate + HMAC session middleware").

## Key Files

- `app/login/page.tsx:6` — passcode entry form; single numeric input,
  posts to `/api/auth/login`, clears input and shows an error on failure.
- `app/api/auth/login/route.ts:4` — POST handler: `checkPasscode()` against
  `APP_PASSCODE`, creates an HMAC-signed session token, sets the
  `budget_session` cookie (httpOnly, sameSite lax, 30-day maxAge).
- `lib/auth.ts:41` — `createSessionToken`/`verifySessionToken`: HMAC-SHA256
  over Web Crypto (works in both Edge middleware and Node routes),
  constant-time signature comparison via `timingSafeEqual` (`lib/auth.ts:33`).
- `lib/auth.ts:63` — `checkPasscode()`: constant-time compare against
  `APP_PASSCODE`.
- `middleware.ts:7` — redirects unauthenticated page requests to `/login`;
  API requests get a 401 instead of a redirect (`middleware.ts:20`).

## Layout / UI Spec

Centered column, `max-w-xs`. Butterfly emoji + "Budget" title, one numeric
password input (autoFocus, `inputMode="numeric"`, letter-spaced), "Unlock"
button disabled while loading or empty. States:

- **Idle** — empty input, button disabled.
- **Loading** — button shows "…", input mid-POST.
- **Error** — "Incorrect passcode" in the negative color below the input,
  passcode field cleared for retry.

## Data Contract

`POST /api/auth/login` body `{ passcode: string }` → response `{ ok: boolean }`.
No shared type in `lib/types.ts` — this is intentionally the one endpoint
outside the report-shape system.

## Fintech UX Principles Applied

**Trust** is the whole point of this screen — a visible passcode gate is
the app's baseline security signal on a personal-finance PWA. **Clarity** —
single input, single action, no distractions.

## Open Questions / Risks

None currently open. Note (not a bug): `sessionSecret()` (`lib/auth.ts:7`)
falls back to `APP_PASSCODE` or a hardcoded dev string if `SESSION_SECRET`
isn't set — intentional dev convenience, set `SESSION_SECRET` explicitly in
any real deployment.

## How to Verify

`npm run dev` → hit `/` unauthenticated → redirected to `/login`. Enter a
wrong passcode → "Incorrect passcode" shown, input cleared. Enter the
correct `APP_PASSCODE` → redirected to `/`, dashboard renders.
```

- [ ] **Step 2: Verify file:line pointers match real source**

Run:
```bash
sed -n '6p' app/login/page.tsx
sed -n '4p' app/api/auth/login/route.ts
sed -n '41p;63p;33p;7p' lib/auth.ts
sed -n '7p;20p' middleware.ts
```
Expected: each line's content is consistent with what the doc says it is (function/component signature at that line). If a line has drifted, fix the doc's line number before committing.

- [ ] **Step 3: Verify line budget**

Run: `wc -l claudemd/screens/login.md`
Expected: 60-120 lines.

- [ ] **Step 4: Commit**

```bash
git add claudemd/screens/login.md
git commit -m "docs: add login screen doc"
```

---

### Task 5: `claudemd/screens/dashboard-shell.md` (shipped)

**Files:**
- Create: `claudemd/screens/dashboard-shell.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure.

- [ ] **Step 1: Write the file**

```markdown
# Screen: Dashboard Shell

## Purpose

The app's single page — owns tab state (Income/Spending/Cash Flow) and
date-range state, fetches the active report, triggers a background Plaid
sync on open, and renders the loading/empty/report states.

## Status

Shipped — commit `1b05a89` ("feat: dashboard shell + income, spending, cash
flow views").

## Key Files

- `app/page.tsx:24` — `Home` component: tab/range state, `ENDPOINT` map
  (`app/page.tsx:18`), `load()` fetch, sync-on-open effect
  (`app/page.tsx:50-56`).
- `components/ReportTabs.tsx:11` — segmented pill control (Income |
  Spending | Cash Flow), `role="tablist"`/`"tab"` for accessibility.
- `components/DateRangePicker.tsx:33` — dropdown of 4 presets (Last 3/6/12
  months, Year to date), default "Last 6 months" (`DEFAULT_RANGE_INDEX = 1`,
  `components/DateRangePicker.tsx:31`).
- `components/LinkButton.tsx:66` — `ConnectEmptyState` (empty-state CTA) and
  `AddAccountButton` (header "+ Account" button), both driving the shared
  `usePlaidConnect` hook (`components/LinkButton.tsx:12`).
- `lib/format.ts:52` — `isoDate()` used to build report query params.

## Layout / UI Spec

Header row (title + `AddAccountButton` + `DateRangePicker`) unless in the
empty state, then `ReportTabs`, then one of: "Loading…" placeholder,
`ConnectEmptyState` (no linked accounts), or the active report view.
`dataKey` (`app/page.tsx:32-34`) guards against rendering stale data from a
previous tab/range while a new fetch is in flight.

## Data Contract

`IncomeReport | SpendingReport | CashflowReport` from `lib/types.ts`,
selected by whichever tab is active. Empty-state detection is per-report-
shape (`app/page.tsx:59-66`) — each report type has its own "zero data"
check.

## Fintech UX Principles Applied

**Continuity** — tab and range state persist across a fetch, and `dataKey`
guarantees the UI never shows one tab's chart with another tab's data
mid-switch. **Clarity** — the segmented control makes three distinct report
types feel like one continuous "Reports" surface.

## Open Questions / Risks

Sync runs once per app open (`app/page.tsx:50-56`) via
`POST /api/plaid/sync` — there's no periodic background refresh yet. Noted
as an open follow-up in
`docs/superpowers/specs/2026-07-19-personal-budgeting-app-design.md`.

## How to Verify

`npm run dev`, log in, switch tabs and date ranges — chart updates without
flashing stale data. With a fresh `dev.db` (no linked accounts),
`ConnectEmptyState` renders instead of a chart.
```

- [ ] **Step 2: Verify file:line pointers match real source**

Run:
```bash
sed -n '24p;18p;50,56p;32,34p;59,66p' app/page.tsx
sed -n '11p' components/ReportTabs.tsx
sed -n '33p;31p' components/DateRangePicker.tsx
sed -n '66p;12p' components/LinkButton.tsx
sed -n '52p' lib/format.ts
```
Expected: consistent with the doc's descriptions; fix line numbers if drifted.

- [ ] **Step 3: Verify line budget**

Run: `wc -l claudemd/screens/dashboard-shell.md`
Expected: 60-120 lines.

- [ ] **Step 4: Commit**

```bash
git add claudemd/screens/dashboard-shell.md
git commit -m "docs: add dashboard shell screen doc"
```

---

### Task 6: `claudemd/screens/income.md` (shipped)

**Files:**
- Create: `claudemd/screens/income.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure.

- [ ] **Step 1: Write the file**

```markdown
# Screen: Income

## Purpose

Shows income over the selected date range: a stacked monthly bar chart by
source, plus a totals summary.

## Status

Shipped — commit `d081540` (report endpoint) + `1b05a89` (view).

## Key Files

- `components/income/IncomeView.tsx:42` — main component; builds `Row[]`
  from `data.byMonth` (`IncomeView.tsx:50-53`).
- `components/income/IncomeView.tsx:80-89` — one stacked `<Bar>` per income
  source, colored via `colorMap()`.
- `components/income/IncomeView.tsx:106-114` — Summary card: total income,
  total transactions, largest transaction.
- `app/api/reports/income/route.ts:5` — GET handler → `incomeReport(txns)`.
- `lib/aggregations.ts:18` — `incomeByMonth()`: buckets by UTC month, sums
  per category display name.
- `lib/aggregations.ts:36` — `incomeSummary()`: total/count/largest.
- `lib/palette.ts:33` — `colorMap()` assigns the 8-color `CATEGORICAL`
  palette by stable source order, not by value.

## Layout / UI Spec

Two cards: chart card (stacked bar + legend), then summary card (date range
label, 3 rows: Total income (bold), Total transactions, Largest
transaction). One primary value: Total income, bolded in the summary.

## Data Contract

`IncomeReport` (`lib/types.ts:26`) = `{ byMonth: IncomeMonth[], sources:
string[], summary: IncomeSummary }`.

## Fintech UX Principles Applied

**Clarity** — bold "Total income" is the one number that matters most;
everything else is supporting detail. Legend colors are stable per source
(assigned by position in a fixed list, not by value/rank) so a source
doesn't change color between date ranges.

## Open Questions / Risks

None currently open.

## How to Verify

`npm test tests/aggregations.test.ts` covers `incomeSummary`. Visually
confirm bar stacking/legend against seeded data: `npm run seed`, then open
the Income tab.
```

- [ ] **Step 2: Verify file:line pointers match real source**

Run:
```bash
sed -n '42p;50,53p;80,89p;106,114p' components/income/IncomeView.tsx
sed -n '5p' app/api/reports/income/route.ts
sed -n '18p;36p' lib/aggregations.ts
sed -n '33p' lib/palette.ts
sed -n '26p' lib/types.ts
```
Expected: consistent with the doc; fix any drifted line numbers.

- [ ] **Step 3: Verify line budget**

Run: `wc -l claudemd/screens/income.md`
Expected: 60-120 lines.

- [ ] **Step 4: Commit**

```bash
git add claudemd/screens/income.md
git commit -m "docs: add income screen doc"
```

---

### Task 7: `claudemd/screens/spending.md` (shipped)

**Files:**
- Create: `claudemd/screens/spending.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure.

- [ ] **Step 1: Write the file**

```markdown
# Screen: Spending

## Purpose

Shows spending by category for the selected range: a donut with a centered
total, and a ranked category list below.

## Status

Shipped — commit `d081540` (report endpoint) + `1b05a89` (view).

## Key Files

- `components/spending/SpendingView.tsx:23` — main component; `TOP_N = 8`
  (`SpendingView.tsx:10`).
- `components/spending/SpendingView.tsx:27-33` — top-8 distinct slices +
  folded "Other" for the tail.
- `components/spending/SpendingView.tsx:63-68` — centered total overlay on
  the donut.
- `components/spending/SpendingView.tsx:83-90` — "Show more"/"Show less"
  toggle past the top 8.
- `app/api/reports/spending/route.ts:6` — GET handler →
  `spendingByCategory(txns)` + summed total.
- `lib/aggregations.ts:64` — `spendingByCategory()`: groups by detailed
  category, sorted descending by amount.
- `lib/categories.ts:22` — `MAP`: Plaid detailed category → `{display,
  emoji, group}`.

## Layout / UI Spec

Donut card (center total, "Total" label) then category-list card, each row
= emoji + name + % of total + amount, sorted descending. One primary value:
the centered total.

## Data Contract

`SpendingReport` (`lib/types.ts:39`) = `{ total: number, categories:
SpendingCategory[] }`.

## Fintech UX Principles Applied

**Clarity** — center-total donut plus progressive disclosure ("Show more")
keeps the long tail of small categories from overwhelming the screen; emoji
+ percentage make category weight scannable without reading exact dollar
amounts.

## Open Questions / Risks

v1 categories are read-only, straight from Plaid — no re-categorization UI.
Explicit non-goal in
`docs/superpowers/specs/2026-07-19-personal-budgeting-app-design.md`.

## How to Verify

`npm test tests/categories.test.ts tests/aggregations.test.ts`. Visually
confirm donut/list against seeded data.
```

- [ ] **Step 2: Verify file:line pointers match real source**

Run:
```bash
sed -n '23p;10p;27,33p;63,68p;83,90p' components/spending/SpendingView.tsx
sed -n '6p' app/api/reports/spending/route.ts
sed -n '64p' lib/aggregations.ts
sed -n '22p' lib/categories.ts
sed -n '39p' lib/types.ts
```
Expected: consistent with the doc; fix any drifted line numbers.

- [ ] **Step 3: Verify line budget**

Run: `wc -l claudemd/screens/spending.md`
Expected: 60-120 lines.

- [ ] **Step 4: Commit**

```bash
git add claudemd/screens/spending.md
git commit -m "docs: add spending screen doc"
```

---

### Task 8: `claudemd/screens/cashflow.md` (shipped)

**Files:**
- Create: `claudemd/screens/cashflow.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure.

- [ ] **Step 1: Write the file**

```markdown
# Screen: Cash Flow

## Purpose

Shows the full picture of where money comes from and goes: a Sankey diagram
(income sources → Income hub → expense groups → Savings) plus a 4-stat
header row.

## Status

Shipped — commit `d081540` (report endpoint) + `1b05a89` (view) + `ad48451`
(chart animation fix for React 19) + `105b16f` (exclude internal transfers).

## Key Files

- `components/cashflow/CashflowView.tsx:8` — composes `StatRow` +
  `SankeyChart`.
- `components/cashflow/StatRow.tsx:5` — 4-stat grid: Total income, Total
  expenses, Net income (colored by sign), Savings rate %.
- `components/cashflow/SankeyChart.tsx:45` — d3-sankey layout + SVG render;
  `nodeColors()` (`SankeyChart.tsx:22`) colors by role (income/hub/savings
  green, expense groups by stable categorical hue, leaves inherit parent).
- `components/cashflow/SankeyChart.tsx:49-58` — `ResizeObserver` keeps the
  diagram full-width and horizontally scrollable on narrow screens.
- `app/api/reports/cashflow/route.ts:6` — GET handler → `{ sankey, stats }`.
- `lib/aggregations.ts:102` — `cashflowSankey()`: builds the 3-level
  node/link graph, adds a "Savings" leaf when net > 0.
- `lib/aggregations.ts:85` — `cashflowStats()`: income/expenses/net/
  savingsRate.

## Layout / UI Spec

`StatRow` (2x2 grid of stat cards) above a Sankey card; each Sankey node is
labeled with name + amount + percentage of the Income hub total; links are
colored by target node, translucent.

## Data Contract

`CashflowReport` (`lib/types.ts:55`) = `{ sankey: SankeyData, stats:
CashflowStats }`.

## Fintech UX Principles Applied

**Clarity** — `StatRow`'s Net income cell changes color by sign (green/red)
but always pairs it with the number and the "Net income" label, never
color alone. **Trust** — savings rate is shown plainly as a percentage, not
obscured behind a score or grade.

## Open Questions / Risks

Internal transfers between the user's own accounts are excluded from
reports as of commit `105b16f` — verify that exclusion logic stays correct
if new account types are added later.

## How to Verify

`npm test tests/aggregations.test.ts` (cashflowStats savings-rate case).
Visually confirm the Sankey against the Monarch reference screenshot
mentioned in `docs/superpowers/plans/2026-07-19-personal-budgeting-app.md`
Task 11.
```

- [ ] **Step 2: Verify file:line pointers match real source**

Run:
```bash
sed -n '8p' components/cashflow/CashflowView.tsx
sed -n '5p' components/cashflow/StatRow.tsx
sed -n '45p;22p;49,58p' components/cashflow/SankeyChart.tsx
sed -n '6p' app/api/reports/cashflow/route.ts
sed -n '102p;85p' lib/aggregations.ts
sed -n '55p' lib/types.ts
```
Expected: consistent with the doc; fix any drifted line numbers.

- [ ] **Step 3: Verify line budget**

Run: `wc -l claudemd/screens/cashflow.md`
Expected: 60-120 lines.

- [ ] **Step 4: Commit**

```bash
git add claudemd/screens/cashflow.md
git commit -m "docs: add cash flow screen doc"
```

---

### Task 9: `claudemd/screens/cash-placement-nudge.md` (planned)

**Files:**
- Create: `claudemd/screens/cash-placement-nudge.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure; content seeded from
  `Projects/budgeting-app.md` in the Obsidian vault (path:
  `/Users/eastonlovell/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Second Brain/Projects/budgeting-app.md`).

- [ ] **Step 1: Write the file**

```markdown
# Screen: Cash Placement Nudge

## Purpose

Detect (or ask) where the user's cash currently sits and flag the gap
against current high-yield savings rates — e.g. "Your savings account is
earning ~0.6% APY — a high-yield account pays 3.8-4.15% right now." Vault
vision doc's #1 priority: cited across all product research as a
near-zero-effort, high-conviction win.

## Status

Planned — not started in code. Source: `Projects/budgeting-app.md`
("Cash Placement Nudge" section) in the Obsidian vault.

## Key Files

None yet. First implementation should follow the same
`superpowers:brainstorming` → `writing-plans` flow used for v1 — see
`docs/superpowers/plans/2026-07-19-personal-budgeting-app.md` as the plan-
structure template.

## Layout / UI Spec

Sketch only: likely a dismissible card on the dashboard (or its own tab)
surfacing the user's current cash-account APY vs. a reference HYSA rate,
with a clear informational CTA — no specific bank/product recommendation,
per the Trust principle below.

## Data Contract

Not yet defined. Open question: whether this needs a manually-entered
"what does your account currently earn" input, or can be inferred from
Plaid `account.type`/`subtype` (Plaid generally doesn't expose APY, so
manual entry is the likely path).

## Fintech UX Principles Applied

**Trust** (no dark pattern nudging toward a specific product — informational
only) and **Empowerment** (frame as an opportunity, not a criticism) matter
most here.

## Open Questions / Risks

Never hardcode the specific APY figures from the vault's rate table into
app copy — they go stale (see `claudemd/best-practices.md`). Need a
strategy for keeping the "current HYSA rate" comparison current, per the
vault doc's own risk callout on this exact point.

## How to Verify

N/A until built.
```

- [ ] **Step 2: Verify line budget**

Run: `wc -l claudemd/screens/cash-placement-nudge.md`
Expected: 60-120 lines.

- [ ] **Step 3: Commit**

```bash
git add claudemd/screens/cash-placement-nudge.md
git commit -m "docs: add cash placement nudge screen doc (planned)"
```

---

### Task 10: `claudemd/screens/automated-savings-rules.md` (planned)

**Files:**
- Create: `claudemd/screens/automated-savings-rules.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure; content seeded from
  `Projects/budgeting-app.md`.

- [ ] **Step 1: Write the file**

```markdown
# Screen: Automated Savings Rules

## Purpose

Direct-deposit-split guidance, round-up simulation, and recurring transfer
scheduling — the "pay yourself first" automation loop that's the app's
primary philosophy (vs. manual budgeting). Vault vision doc's #2 priority.

## Status

Planned — not started in code. Source: `Projects/budgeting-app.md`
("Automated Savings Rules" section).

## Key Files

None yet.

## Layout / UI Spec

Sketch only: a rules screen where the user sets one or more automation
rules (e.g. "auto-route 15% of any deposit to savings", simulated
round-ups). Since v1 is read-only with no money-movement integration, an
early version is likely a *simulation/recommendation* UI — showing what
automation would have saved historically from real transaction data —
before any real transfer-triggering exists.

## Data Contract

Not yet defined. Would need a new Prisma model for user-defined rules, plus
a way to replay rules against historical `Transaction` rows for the
simulation.

## Fintech UX Principles Applied

**Empowerment** is central — this screen is the app's core differentiator.
**Clarity** in showing exactly what a rule would do before it's "live".

## Open Questions / Risks

**Irregular income handling is an explicitly unresolved open question** —
none of the research in `Projects/budgeting-app.md` answered how automated
rules should behave with seasonal/part-time income rather than a steady
paycheck. This needs original design work (the vault doc suggests a small
user survey, same pattern as other vault projects) before an
implementation plan is written for this screen.

## How to Verify

N/A until built.
```

- [ ] **Step 2: Verify line budget**

Run: `wc -l claudemd/screens/automated-savings-rules.md`
Expected: 60-120 lines.

- [ ] **Step 3: Commit**

```bash
git add claudemd/screens/automated-savings-rules.md
git commit -m "docs: add automated savings rules screen doc (planned)"
```

---

### Task 11: `claudemd/screens/goals.md` (planned)

**Files:**
- Create: `claudemd/screens/goals.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure; content seeded from
  `Projects/budgeting-app.md`.

- [ ] **Step 1: Write the file**

```markdown
# Screen: Goals

## Purpose

Named savings goals with progress tracking (Emergency fund, Roth IRA
contribution target, discretionary "fun fund" as defaults) — cited across
nearly every competitor as a top retention driver. Vault vision doc's #3
priority.

## Status

Planned — not started in code. Source: `Projects/budgeting-app.md`
("Goal-Based Savings Buckets" section).

## Key Files

None yet.

## Layout / UI Spec

Sketch only: a goals list/grid, each with name, target amount, current
progress (bar or ring), and a way to add/edit a goal. Reuse
`components/ui/Card.tsx` and the `CATEGORICAL` palette
(`lib/palette.ts:5`) rather than introducing new visual primitives.

## Data Contract

Not yet defined. Needs a new Prisma model (`Goal`: name, targetAmount,
currentAmount or a derived contribution log, createdAt).

## Fintech UX Principles Applied

**Empowerment** — progress visualization (bar/ring, % complete) is the core
mechanic; light gamification (milestone callouts) is worth considering per
the fintech UX research, without tipping into a dark pattern.

## Open Questions / Risks

**Mode-choice-at-onboarding is unresolved** (per the vault doc) — whether
goals are offered to everyone by default or gated behind an onboarding
choice. Decide before writing an implementation plan for this screen.

## How to Verify

N/A until built.
```

- [ ] **Step 2: Verify line budget**

Run: `wc -l claudemd/screens/goals.md`
Expected: 60-120 lines.

- [ ] **Step 3: Commit**

```bash
git add claudemd/screens/goals.md
git commit -m "docs: add goals screen doc (planned)"
```

---

### Task 12: `claudemd/screens/investing-education.md` (planned)

**Files:**
- Create: `claudemd/screens/investing-education.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure; content seeded from
  `Projects/budgeting-app.md` and the vault's
  `wiki/concepts/roth-ira-for-young-investors.md`.

- [ ] **Step 1: Write the file**

```markdown
# Screen: Investing Education

## Purpose

Surface Roth IRA guidance as the natural next step once savings goals are
funded beyond an emergency-fund threshold — an educational on-ramp, not a
brokerage. Vault vision doc's #5 priority.

## Status

Planned — not started in code. Source: `Projects/budgeting-app.md`
("Investing Education Layer") and `wiki/concepts/roth-ira-for-young-investors.md`
in the vault.

## Key Files

None yet.

## Layout / UI Spec

Sketch only: educational content (not a transaction/investing feature) —
mechanics explainer, contribution-limit display, and a link from the Goals
screen once a Roth IRA goal exists.

## Data Contract

Not yet defined.

## Fintech UX Principles Applied

**Trust** and **Clarity** dominate — this screen must be unambiguous that
it's education, not investment advice or execution, and default toward
diversified guidance rather than stock-picking, per the vault doc's
"Common Mistakes To Design Against" section.

## Open Questions / Risks

**Never hardcode Roth IRA contribution limits or MAGI phase-outs** — must
be pulled from irs.gov as the source of truth before any number ships
in-app; the vault doc explicitly flags this as unresolved (its source
articles disagreed on exact current-year figures). Also unresolved: how far
this layer goes (education only vs. eventual brokerage integration) — a
scope decision to make before Phase 2, per the vault doc.

## How to Verify

N/A until built.
```

- [ ] **Step 2: Verify line budget**

Run: `wc -l claudemd/screens/investing-education.md`
Expected: 60-120 lines.

- [ ] **Step 3: Commit**

```bash
git add claudemd/screens/investing-education.md
git commit -m "docs: add investing education screen doc (planned)"
```

---

### Task 13: `claudemd/screens/budgeting-mode-toggle.md` (planned)

**Files:**
- Create: `claudemd/screens/budgeting-mode-toggle.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure; content seeded from
  `Projects/budgeting-app.md` and `wiki/concepts/budgeting-frameworks.md`.

- [ ] **Step 1: Write the file**

```markdown
# Screen: Budgeting Mode Toggle

## Purpose

Optional zero-based or digital-envelope mode for users who want more manual
control than the default automation-first philosophy. Vault vision doc's
#6 priority — explicitly secondary; build after the automation core.

## Status

Planned — not started in code. Source: `Projects/budgeting-app.md`
("Budgeting Mode Toggle") and `wiki/concepts/budgeting-frameworks.md`.

## Key Files

None yet.

## Layout / UI Spec

Sketch only: a settings-level toggle/switch between "Automated" (default)
and "Zero-based/Envelope" modes. Envelope mode needs its own category-cap
UI distinct from the existing read-only Spending screen.

## Data Contract

Not yet defined. Envelope mode implies per-category budget caps, a concept
not present in the current read-only `SpendingCategory` shape
(`lib/types.ts:33`).

## Fintech UX Principles Applied

**Clarity** and **Continuity** — switching modes shouldn't feel like
switching apps; existing transaction/category data should carry over
cleanly into whichever mode is active.

## Open Questions / Risks

Build order matters — per the vault doc, this should come after the
automation core (Cash Placement Nudge, Automated Savings Rules, Goals), not
before.

## How to Verify

N/A until built.
```

- [ ] **Step 2: Verify line budget**

Run: `wc -l claudemd/screens/budgeting-mode-toggle.md`
Expected: 60-120 lines.

- [ ] **Step 3: Commit**

```bash
git add claudemd/screens/budgeting-mode-toggle.md
git commit -m "docs: add budgeting mode toggle screen doc (planned)"
```

---

### Task 14: `claudemd/screens/notifications.md` (planned)

**Files:**
- Create: `claudemd/screens/notifications.md`

**Interfaces:**
- Consumes: `claudemd/_template.md` structure; content seeded from
  `Projects/budgeting-app.md`.

- [ ] **Step 1: Write the file**

```markdown
# Screen: Notifications

## Purpose

Push reminders and pre-emptive overspend alerts before a category/goal is
blown, not after — named as a retention driver across the vault's product
research. Vault vision doc's #7 priority (last, since it depends on Goals
and Budgeting Mode existing).

## Status

Planned — not started in code. Source: `Projects/budgeting-app.md`
("Notifications & Overspend Alerts").

## Key Files

None yet. Note: `public/sw.js` (service worker) exists today only for PWA
installability, not push messaging — adding Web Push would extend that
file, not replace it.

## Layout / UI Spec

Sketch only: in-app alert banners at minimum; native push notifications
require Web Push (VAPID keys, subscription storage) layered onto the
existing service worker.

## Data Contract

Not yet defined — depends on which screens (Goals, Budgeting Mode Toggle)
it alerts against, since both are also unbuilt.

## Fintech UX Principles Applied

**Empowerment** — alerts should be pre-emptive and framed as a heads-up,
not a scold, consistent with the "20% more on dining" framing example in
`claudemd/best-practices.md`.

## Open Questions / Risks

This screen depends on Goals and Budgeting Mode Toggle existing first —
nothing to alert against otherwise. Sequence it last among the planned
screens, matching its #7 priority in the vault doc.

## How to Verify

N/A until built.
```

- [ ] **Step 2: Verify line budget**

Run: `wc -l claudemd/screens/notifications.md`
Expected: 60-120 lines.

- [ ] **Step 3: Commit**

```bash
git add claudemd/screens/notifications.md
git commit -m "docs: add notifications screen doc (planned)"
```

---

### Task 15: Final verification pass

**Files:**
- None created; verification only.

**Interfaces:**
- Consumes: every file created in Tasks 1-14.

- [ ] **Step 1: Confirm full file tree**

Run: `find claudemd CLAUDE.md -type f | sort`
Expected:
```
CLAUDE.md
claudemd/_template.md
claudemd/best-practices.md
claudemd/screens/automated-savings-rules.md
claudemd/screens/budgeting-mode-toggle.md
claudemd/screens/cash-placement-nudge.md
claudemd/screens/cashflow.md
claudemd/screens/dashboard-shell.md
claudemd/screens/goals.md
claudemd/screens/income.md
claudemd/screens/investing-education.md
claudemd/screens/login.md
claudemd/screens/notifications.md
claudemd/screens/spending.md
```

- [ ] **Step 2: Confirm root CLAUDE.md loads**

Run: `claude -p "/context"` from the repo root (or open a session and run
`/context` interactively).
Expected: `CLAUDE.md` appears under **Memory files**.

- [ ] **Step 3: Line-budget sweep**

Run: `wc -l CLAUDE.md claudemd/*.md claudemd/screens/*.md`
Expected: `CLAUDE.md` under 150; every other file between 60-120 (a few
lines over is fine, but flag anything past ~150).

- [ ] **Step 4: Confirm no working-tree changes remain uncommitted**

Run: `git status --short`
Expected: empty (everything from Tasks 1-14 was committed per-task).

## Self-Review

- **Spec coverage:** folder structure (Task 1-14 create every file listed
  in the design spec's tree) ✓. Root CLAUDE.md content matches the spec's
  outline (stack, constraints, commands, pointer table) ✓. Per-screen
  template applied consistently to all 11 screen docs ✓. `best-practices.md`
  covers both CLAUDE.md-authoring and the four fintech UX principles ✓.
- **Placeholders:** none — every screen doc has concrete content sourced
  from either the real codebase (shipped screens) or `Projects/budgeting-app.md`
  (planned screens), not "TBD" stubs. Planned screens explicitly say "N/A
  until built" for How to Verify, which is accurate status, not a
  placeholder.
- **Type consistency:** `IncomeReport`/`SpendingReport`/`CashflowReport`
  field names in the screen docs match `lib/types.ts` exactly (verified by
  reading the file during plan authoring).
