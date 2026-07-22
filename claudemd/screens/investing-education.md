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
