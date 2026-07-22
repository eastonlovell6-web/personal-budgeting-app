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
