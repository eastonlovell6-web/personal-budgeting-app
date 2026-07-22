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
