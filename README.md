# Money Moves

A personal, single-user budgeting app modeled on Monarch Money. Connects to your
bank via **Plaid**, syncs transactions into a local database, and shows three
reports — **Income**, **Spending**, and **Cash Flow** — in a dark, Monarch-style
UI. Installs to your iPhone home screen as a **PWA** (no App Store).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind v4
- Prisma (SQLite in dev → Postgres in prod)
- Plaid (`/transactions/sync`)
- Recharts (bars/donut) + d3-sankey (cash flow)
- Passcode auth with an HMAC-signed session cookie

## Setup

```bash
npm install
cp .env.example .env      # then fill in the values below
npx prisma migrate dev    # creates the local SQLite db
```

### Environment variables (`.env`)

| Var | What | Example |
|-----|------|---------|
| `DATABASE_URL` | Prisma connection string | `file:./dev.db` |
| `PLAID_CLIENT_ID` | From the Plaid dashboard | |
| `PLAID_SECRET` | Plaid **Sandbox** secret to start | |
| `PLAID_ENV` | `sandbox` now, `production` later | `sandbox` |
| `APP_PASSCODE` | The passcode you type to unlock the app | `1234` |
| `SESSION_SECRET` | Random string that signs your session cookie | (any long random string) |
| `ENCRYPTION_KEY` | Random string used to encrypt Plaid tokens at rest | (any long random string) |

Get Plaid keys at <https://dashboard.plaid.com> → **Developers → Keys**. Sandbox
keys work immediately; real-bank data needs Plaid **Production** access (a
separate request).

## Run

```bash
npm run dev          # http://localhost:3000
```

Unlock with your `APP_PASSCODE`, then **Connect a bank**. In Plaid Sandbox use
any institution with credentials `user_good` / `pass_good`.

### Try it with demo data (no Plaid needed)

```bash
npm run seed         # inserts 6 months of fake transactions
```

## Test

```bash
npm test             # vitest — categories, aggregations, crypto
```

## Install on your iPhone

Open the app's URL in Safari → Share → **Add to Home Screen**. It launches
full-screen with its own icon, behind the passcode.

## Deploying (later)

1. In `prisma/schema.prisma`, change `provider = "sqlite"` → `"postgresql"`.
2. Point `DATABASE_URL` at your host's Postgres and run `prisma migrate deploy`.
3. Set all env vars on the host; set `PLAID_ENV=production` once approved.
4. Deploy (Railway / Render / Fly).

## Project layout

- `lib/aggregations.ts` — income/spending/cash-flow math (unit-tested)
- `lib/categories.ts` — Plaid category → display name/emoji/group
- `lib/sync.ts` — Plaid `/transactions/sync` → DB
- `app/api/reports/*` — report endpoints the UI reads
- `components/{income,spending,cashflow}/*` — the three report views
- `docs/superpowers/` — design spec and implementation plan
