# Screen: Automated Savings Rules

## Purpose

Direct-deposit-split guidance, round-up simulation, and recurring transfer
scheduling — the "pay yourself first" automation loop that's the app's
primary philosophy (vs. manual budgeting). Vault vision doc's #2 priority.

## Status

Shipped (status corrected 2026-07-24 — this doc previously said "Planned,"
but `SavingsView` and the `/api/savings-rules` routes already exist and
work). Matches the originally-sketched simulation-first approach: rules are
replayed against historical transactions rather than triggering real
transfers, since v1 has no money-movement integration.

## Key Files

`components/savings/SavingsView.tsx`, `app/api/savings-rules/route.ts`,
`app/api/savings-rules/[id]/route.ts`, `prisma/schema.prisma`
(`SavingsRule` model).

## Layout / UI Spec

A "Simulated this period" summary card (shown once a rule is active) listing
each active rule's simulated total, a rules list with active/paused toggles
and delete, and an add-rule form supporting two rule types: deposit-split
(percent of every deposit) and round-up (to nearest $1 or $5).

## Data Contract

`SavingsRule` Prisma model: `type` (`split` | `roundup`), `percent`,
`increment`, `active`. CRUD via `/api/savings-rules` (list/create) and
`/api/savings-rules/[id]` (toggle active, delete). Simulated totals are
computed by replaying rules against `Transaction` rows, not stored.

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
