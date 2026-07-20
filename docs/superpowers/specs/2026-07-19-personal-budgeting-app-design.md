# Personal Budgeting App — Design Spec

**Date:** 2026-07-19
**Status:** Approved (pending final spec review)
**Author:** Easton Lovell (with Claude)

## Summary

A personal, single-user budgeting app modeled visually on Monarch Money. It
connects to the user's bank and financial accounts via **Plaid**, syncs
transactions into a local database, and presents three views: **Income**,
**Spending**, and **Cash Flow**. It runs as a **PWA** installed to the user's
iPhone home screen. Not distributed through the App Store; for personal use only.

## Goals

- Look and feel like Monarch Money (dark theme, the three reference pages).
- Pull live financial data from the user's real accounts via Plaid.
- Ship three pages for v1: Income, Spending, Cash Flow.
- Install to iPhone home screen as an app-like PWA.

## Non-Goals (v1 — explicitly out of scope)

- Budgets / budget-vs-actual tracking (Groceries $200/$250 style cards).
- Editing or re-categorizing transactions (v1 is read-only, uses Plaid's
  categories as-is). Custom category rename/merge is a future iteration.
- Investments, goals, net worth, recurring detection, advice.
- Multi-user / accounts for other people. Single user only.
- App Store distribution or native app packaging.

## Decisions (locked during brainstorming)

1. **Delivery:** PWA (home-screen web app). No App Store, no Xcode, no Apple
   developer account.
2. **Hosting:** Cloud host (Railway / Render / Fly). Always-on, reachable from
   the phone anywhere. Plaid webhooks work out of the box.
3. **Data strategy:** Sync Plaid data into our own Postgres DB (Approach B);
   pages read from Postgres, not live Plaid calls. Needed for monthly history
   and speed/robustness.
4. **Categorization:** Auto from Plaid, read-only for v1.

## Architecture & Stack

- **Framework:** Next.js (single app: React frontend + API routes for the
  Plaid backend).
- **Database:** Postgres.
- **Charts:** Recharts (bar, donut, line); **d3-sankey** for the Cash Flow
  diagram (Recharts' Sankey is too limited for the Monarch look).
- **Bank connectivity:** Plaid (`/link/token`, `/item/public_token/exchange`,
  `/transactions/sync`).
- **Deploy target:** Cloud host as a web service + managed Postgres.
- **PWA:** web manifest + service worker so it installs to the home screen,
  opens full-screen with a custom icon.

### Security

- Single passcode/login gate — the app is on the public internet with financial
  data, so only the owner can open it.
- Plaid `client_secret` and `access_token`s live **only** on the backend.
- `access_token`s stored encrypted at rest in Postgres.

## Data Model (Postgres)

- **`items`** — one row per Plaid connection (bank login):
  `id`, `item_id`, `access_token` (encrypted), `institution_name`,
  `cursor` (for `/transactions/sync`), `created_at`.
- **`accounts`** — each account under an item:
  `account_id`, `item_id` (fk), `name`, `type` (checking/savings/credit),
  `current_balance`, `updated_at`.
- **`transactions`** — core table:
  `transaction_id`, `account_id` (fk), `date`, `amount`, `merchant_name`,
  `pf_category_primary` (e.g. `FOOD_AND_DRINK`),
  `pf_category_detailed` (e.g. `FOOD_AND_DRINK_RESTAURANTS`),
  `is_income` (derived boolean), `pending`.
- **`category_map`** — static seed data mapping a Plaid category →
  display name, emoji, and Sankey group. Example:
  `FOOD_AND_DRINK_RESTAURANTS` → name "Restaurants", emoji 🍽️,
  group "Food & Dining".

## Data Flow

1. **Link a bank:** Plaid Link (in-app) → `public_token` → backend exchanges for
   `access_token` → store encrypted → run initial `/transactions/sync`.
2. **Sync:** backend calls `/transactions/sync` with the saved cursor → upserts
   added/modified transactions, removes deleted ones → updates account balances.
   Triggered on app open and on a periodic refresh.
3. **Render:** each page runs a Postgres aggregation query over `transactions`
   for the selected date range → returns JSON → React charts render it.

### Derived logic

- **Income vs expense:** from Plaid amount sign + `personal_finance_category`
  primary (`INCOME*` → income). Income page = inflows grouped by source;
  Spending & Cash Flow = outflows grouped by category/group.
- **Savings rate:** `(income − expenses) / income`, shown on the Cash Flow stat
  row.

## Pages (v1)

All pages share: a top segmented toggle (Income · Spending · Cash Flow), a
date-range selector, and the dark Monarch theme.

### 1. Income
- Monthly **bar chart** across the selected range, bars segmented by income type.
- Legend with per-source totals: Paychecks, Business, Interest (whatever income
  categories Plaid returns as inflows).
- **Summary** block: date range, Total income, Total transactions,
  Largest transaction.

### 2. Spending
- **Donut chart** with total spend in the center.
- Ranked **category list** below (emoji, name, amount) — Rent, Groceries,
  Shopping, Dining Out, etc. — with "Show more" to expand the long tail.
- Categories straight from Plaid (read-only).

### 3. Cash Flow
- **Sankey diagram**: income sources (Paychecks, Business) → **Income** node →
  expense groups (Housing, Food & Dining, Bills & Utilities…) → leaf categories
  (Mortgage, Groceries, Restaurants…), plus a **Savings** branch for leftover.
- Top stat row: Total income · Total expenses · Net income · Savings rate %.
- Amounts + percentages on nodes, matching the reference screenshot.

## Success Criteria

- User can link at least one real bank account via Plaid from the phone.
- Real transactions sync into Postgres and survive app restarts.
- All three pages render the user's real data in the Monarch-style visuals.
- App installs to the iPhone home screen and opens full-screen behind a passcode.

## Open Questions / Follow-ups (not blocking v1)

- **Plaid Production access:** real-bank data requires Plaid Production approval
  (Sandbox is for fake data). Build against Sandbox first, then request
  Production. May involve a Plaid application review and cost.
- Encryption key management for `access_token`s on the chosen host.
- Periodic sync mechanism (Plaid webhook vs. cron vs. on-open only).
