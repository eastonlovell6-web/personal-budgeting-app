# Automated Savings Rules — Design Spec

**Date:** 2026-07-23
**Status:** Approved (pending final spec review)
**Author:** Easton Lovell (with Claude)

## Summary

Adds a new "Savings" tab where the user defines one or more automation
rules (a fixed-percent deposit split, or a round-up on spending) and sees
what those rules would have moved to savings over the selected date range,
replayed against real historical `Transaction` rows. This is the vault
vision doc's #2-priority "pay yourself first" automation loop
(`claudemd/screens/automated-savings-rules.md`). Because v1 has no
money-movement integration (Plaid access is read-only; there is no
transfer-initiation capability anywhere in this app), this pass is scoped
as simulation/recommendation only — no real transfer is ever triggered.

## Goals

- Let the user create, toggle, and delete savings rules of two kinds:
  a percent-of-deposit split, and a round-up-on-spending.
- Simulate each active rule against the transactions in the selected date
  range and show its individual contribution plus a combined total.
- Support multiple simultaneous active rules (e.g. a split rule and a
  round-up rule running together), each shown with its own line plus a
  combined total.
- Frame results positively — "this would have moved ~$X to savings" — per
  the Empowerment principle, since this screen is the app's core
  differentiator.

## Non-Goals (this pass)

- No real transfer execution or scheduling — simulation only. Building
  actual recurring transfers would require a transfer-initiation
  integration (e.g. Plaid Transfer) that doesn't exist in this app yet;
  that's a prerequisite for a future pass, not part of this one.
- No smart/irregular-income detection. The screen doc flagged seasonal/
  part-time income handling as an unresolved open question; this pass
  resolves it by treating every `isIncome` transaction uniformly (no
  distinction between a regular paycheck and a one-off deposit). The
  simulation is historical and non-binding, so the user can see the
  ragged month-to-month result themselves rather than the app guessing
  at regularity.
- No per-transaction exclusion UI (e.g. "don't count this one gift
  deposit") — deferred; see Open Questions.
- No rule-editing history or period-over-period comparison — just the
  current date-range simulation, same scoping as the other report tabs.
- No configurable round-up increment beyond $1/$5.

## Architecture

One new Prisma model, `SavingsRule` — a single polymorphic table with a
`type` discriminator (`"split" | "roundup"`) and nullable type-specific
fields, rather than separate tables per rule type. With only two rule
kinds and no execution state to track (simulation only), a discriminator
column is simplest and avoids CRUD boilerplate duplication for no
type-safety benefit yet.

Everything else follows the existing report-tab pattern exactly: a pure
aggregation function computes the simulation from `Transaction` rows on
each request (no caching/materialized results — consistent with
`incomeReport`/`cashflowReport`), and the new tab is wired through the
same `ENDPOINT`/`Tab`/`dataKey` machinery in `app/page.tsx` that Investing
already uses — no changes to that machinery's shape, just one more entry.

## Components & Data Flow

### Data Model (`prisma/schema.prisma`)

```prisma
model SavingsRule {
  id        String   @id @default(cuid())
  type      String   // "split" | "roundup"
  active    Boolean  @default(true)
  percent   Float?   // for "split": 0-100
  increment Int?     // for "roundup": 1 or 5
  createdAt DateTime @default(now())
}
```

### Backend

- `lib/aggregations.ts` — add `savingsRulesSimulation(transactions:
  Transaction[], rules: SavingsRule[]): SavingsSimulationResult`, a pure
  function:
  - Iterates the date-range-scoped transactions once per call.
  - For each *active* rule of type `"split"`: sums `percent / 100 *
    amount` over transactions where `isIncome === true`.
  - For each *active* rule of type `"roundup"`: sums `increment -
    (amount % increment)` (0 when `amount % increment === 0`) over
    transactions where `isIncome === false`.
  - Inactive rules are excluded entirely from both per-rule and combined
    results.
  - Returns `{ perRule: { ruleId, type, total }[], combinedTotal }`.
- `app/api/savings-rules/route.ts`:
  - `GET`: returns all `SavingsRule` rows.
  - `POST`: body `{ type, percent? , increment? }` — creates a rule.
    Validates `percent` in `0–100` (for `"split"`) and `increment` in
    `{1, 5}` (for `"roundup"`); 400 on invalid input.
- `app/api/savings-rules/[id]/route.ts`:
  - `PATCH`: body `{ active?, percent?, increment? }` — updates the rule.
    Same bounds validation as `POST`. 404 if the rule doesn't exist.
  - `DELETE`: permanently removes the rule. 404 if it doesn't exist.
- `app/api/reports/savings/route.ts`:
  - `GET`: query params `start`/`end` (same convention as the other report
    routes) — loads transactions in range + all `SavingsRule` rows,
    returns `{ rules, ...savingsRulesSimulation(transactions, rules) }`.

### Frontend

- `Tab` type (`components/ReportTabs.tsx`) gains `"savings"`; `ENDPOINT`
  in `app/page.tsx` gains `savings: "/api/reports/savings"` — same
  pattern used when Investing was added.
- `components/savings/SavingsView.tsx` — new, receives the fetched report
  data like the other view components:
  - Rule list: each row shows type, its config (percent or increment),
    an active/inactive toggle, and a delete control.
  - Add-rule form: choose split or round-up, then the relevant config
    input (percent field, or increment selector between $1/$5).
  - Results section: one line per active rule with its simulated
    contribution over the selected range, plus a combined total. Framed
    as "this would have moved ~$X to savings this period," using
    `money`/`money0` from `lib/format.ts`.

## Error Handling & Edge Cases

- **No rules created yet:** results section doesn't render — just the
  empty rule list and the add-rule form. No "$0 saved" placeholder.
- **Rule active but zero qualifying transactions in range** (e.g. a
  round-up rule with no expense transactions that period): its line
  still renders, showing `$0` — the user should see the rule ran and had
  nothing to act on, not wonder if it silently failed.
- **Deleting a rule** is immediate and permanent (no soft-delete/undo) —
  consistent with this being a simulation tool with no real money
  movement at stake.
- **Invalid rule input** (percent outside 0–100, increment not in
  `{1, 5}`): rejected with a 400 in `POST`/`PATCH`, same fat-finger-guard
  pattern as the Cash Placement Nudge's APY bounds check.
- **Multiple rules of the same type:** allowed — e.g. two separate split
  rules at different percentages both contribute to the combined total.
  Not deduplicated or merged; this is a deliberate simplification, not
  validated against (YAGNI — no evidence yet that this needs blocking).

## Testing

- `tests/aggregations.test.ts`: `savingsRulesSimulation()` covering:
  - Split rule over income-only transactions (correct percent-of-amount
    sum, non-income transactions ignored).
  - Round-up rule over expense-only transactions (correct increment
    math, including the exact-multiple-of-increment $0 case).
  - Combined multi-rule total (one split + one round-up together).
  - Inactive rules excluded from both per-rule and combined results.
  - Empty transaction set → all totals `0`.
- Manual verification: `npm run dev`, create one split rule (e.g. 10%)
  and one round-up rule (e.g. nearest $5), confirm each rule's total
  matches manual arithmetic against seeded transaction data, toggle a
  rule off and confirm it drops from the combined total, switch date
  range and confirm the simulation recomputes correctly, delete a rule
  and confirm it's gone on reload.

## Success Criteria

- Savings tab behaves like every other report tab: date-range-scoped,
  wired through the existing `ENDPOINT`/`Tab`/`dataKey` machinery with no
  changes to that machinery's shape.
- Rule CRUD (create, toggle active, edit, delete) works and persists
  across reloads.
- Simulation totals are exactly reproducible by hand against seeded
  transaction data for both rule types and their combination.
- No real transfer is ever triggered — this pass is read-only simulation
  end to end.
- Existing report tabs (Income/Spending/Cash Flow/Investing) and the
  Cash Placement Nudge are bit-for-bit unchanged in behavior.
- New pure aggregation function fully unit tested; existing test suite
  continues to pass.

## Open Questions / Follow-ups (not blocking this pass)

- Per-transaction exclusion (e.g. letting the user exclude a one-off gift
  deposit from a split rule's simulation) was considered and deferred —
  could be added later if uniform income handling proves too noisy in
  practice.
- Real transfer execution/scheduling is the natural next phase once a
  transfer-initiation integration exists, but is explicitly out of scope
  until that prerequisite is in place.
- No mechanism yet to show simulation results changing over multiple
  periods (e.g. a trend line of "this rule would have saved $X/month for
  the last 6 months") — current scope is a single date-range snapshot,
  same as the other report tabs.
