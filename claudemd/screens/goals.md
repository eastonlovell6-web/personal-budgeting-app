# Screen: Goals

## Purpose

Named savings goals with progress tracking (Emergency fund, Roth IRA
contribution target, discretionary "fun fund" as defaults) — cited across
nearly every competitor as a top retention driver. Vault vision doc's #3
priority.

## Status

Shipped (status corrected 2026-07-24 — this doc previously said "Planned,"
but `GoalsView` and the `/api/goals` routes already exist and work). Progress
bars currently use the generic `bg-accent` (orange) token; per
`claudemd/design-system.md` they should be Goals Magenta (`#CC3DC4`) — fixed
in the 2026-07-24 color pass, see that file's "Applied so far" list.

## Key Files

`components/goals/GoalsView.tsx`, `app/api/goals/route.ts`,
`app/api/goals/[id]/route.ts`, `prisma/schema.prisma` (`Goal` model).

## Layout / UI Spec

A goals list, each with name, target amount, current progress (horizontal
bar, editable inline), delete action, and an add-goal form below the list.
Uses `components/ui/Card.tsx`. Not yet using a ring/donut per the design
system's "Savings/goal ring" component spec — still a plain progress bar.

## Data Contract

`Goal` Prisma model: `name`, `targetAmount`, `currentAmount`, `createdAt`.
CRUD via `/api/goals` (list/create) and `/api/goals/[id]` (patch current
amount, delete).

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
