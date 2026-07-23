# Screen: Cash Placement Nudge

## Purpose

Detect (or ask) where the user's cash currently sits and flag the gap
against current high-yield savings rates — e.g. "Your savings account is
earning ~0.6% APY — a high-yield account pays 3.8-4.15% right now." Vault
vision doc's #1 priority: cited across all product research as a
near-zero-effort, high-conviction win.

## Status

Shipped. Source: `Projects/budgeting-app.md` ("Cash Placement Nudge"
section) in the Obsidian vault.

## Key Files

- `components/nudge/CashPlacementNudge.tsx` — dashboard card
- `app/api/nudges/cash-placement/route.ts` — nudge data endpoint
- `app/api/accounts/[accountId]/route.ts` — PATCH for setting an account's APY
- `lib/aggregations.ts` — `cashPlacementNudge` aggregation
- `lib/settings.ts` — snooze/dismiss state (`AppSettings`)
- `lib/types.ts` — nudge-related types
- `app/page.tsx` — wires the card into the dashboard

## Layout / UI Spec

Dismissible card on the dashboard surfacing the user's current cash-account
APY vs. a reference HYSA rate, with a clear informational CTA — no specific
bank/product recommendation, per the Trust principle below. Fully hides
(not just collapses) while snoozed.

## Data Contract

Manual entry: `Account.apy` is a user-entered field (Plaid doesn't expose
APY), set via `PATCH /api/accounts/:accountId`. Snooze state lives in
`AppSettings`.

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
