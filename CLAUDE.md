# Money Moves — Personal Budgeting App

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
- **Dark and light theme, manual toggle** — tokens in `app/globals.css`,
  keyed by `[data-theme="dark"|"light"]`; don't hardcode colors, use the CSS
  variables / `lib/palette.ts`. Theme state lives in `components/ThemeProvider.tsx`
  (`useTheme()`); the toggle is in the dashboard header
  (`components/ThemeToggle.tsx`). No system-preference auto-detection —
  the user's choice is explicit and persisted (`localStorage`). Follow
  `claudemd/design-system.md` (the "Money Moves" system) for anything
  color/type/component-related — it's the source of truth this repo's
  tokens are meant to match.
- **Don't hardcode financial figures that go stale** (APY rates, Roth IRA
  limits) once those features exist — pull from a source that can be
  updated. See `claudemd/best-practices.md`.

## Commands

- `npm run dev` — localhost:3000
- `npm run build` — production build
- `npm test` — Vitest (categories, aggregations, crypto)
- `npm run seed` — inserts 6 months of fake transactions (no Plaid needed)
- `npx prisma migrate dev` — apply schema changes

## Design System

`claudemd/design-system.md` is the "Money Moves" design system (colors, type
scale, spacing/radius, components) — read it before any UI change, alongside
the screen-specific doc below. `app/globals.css` and `lib/palette.ts` were
brought into alignment with it on 2026-07-24; see that file's "Applied so far
vs. still open" section for what's done and what's still ad-hoc.

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
| Cash Placement Nudge | Shipped | `claudemd/screens/cash-placement-nudge.md` |
| Automated Savings Rules | Shipped (corrected 2026-07-24 — doc said Planned, code has a working `SavingsView`) | `claudemd/screens/automated-savings-rules.md` |
| Goals (savings buckets) | Shipped (corrected 2026-07-24 — doc said Planned, code has a working `GoalsView`) | `claudemd/screens/goals.md` |
| Investing Education (Roth IRA) | Planned | `claudemd/screens/investing-education.md` |
| Budgeting Mode Toggle | Planned | `claudemd/screens/budgeting-mode-toggle.md` |
| Notifications | Planned | `claudemd/screens/notifications.md` |

Full product spec/plan history lives in `docs/superpowers/specs/` and
`docs/superpowers/plans/` — the screen docs point into those rather than
repeating them.
