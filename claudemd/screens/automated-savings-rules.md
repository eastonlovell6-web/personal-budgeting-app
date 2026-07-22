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
