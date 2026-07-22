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
