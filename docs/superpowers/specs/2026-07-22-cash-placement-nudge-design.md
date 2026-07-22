# Cash Placement Nudge — Design Spec

**Date:** 2026-07-22
**Status:** Approved (pending final spec review)
**Author:** Easton Lovell (with Claude)

## Summary

Adds a dismissible dashboard card that flags when a connected checking/
savings account is earning meaningfully less than a reference high-yield
savings rate, framed as an opportunity ("could earn ~$X/year more") rather
than a criticism. This is the vault vision doc's #1-priority, near-zero-
effort win (`claudemd/screens/cash-placement-nudge.md`). Because Plaid
exposes no APY data, both the user's own account rate and the reference
HYSA rate are user-entered and stored in the DB — never hardcoded in app
copy, per the fintech data-integrity rule in `claudemd/best-practices.md`.

## Goals

- Surface, per depository account, the gap between what it currently earns
  and a reference HYSA rate, plus an estimated annual opportunity cost.
- Let the user enter/update each account's current APY and the reference
  rate inline on the card — no separate settings screen.
- Only surface accounts where the gap is large enough to matter (avoid
  nagging over trivial balances or rounding-error rate differences).
- Let the user dismiss the whole nudge for ~30 days without permanently
  losing it if the gap persists.

## Non-Goals (this pass)

- No specific bank/product recommendation — informational only, per the
  Trust principle (no dark-pattern nudging toward a particular HYSA).
- No automatic/live-fetched market rate data — the reference rate is a
  manually maintained setting, not pulled from an external rate API.
- No distinction between checking vs. savings subtypes — Plaid's `subtype`
  field isn't currently synced/stored (`Account.type` is the broad Plaid
  `type`, e.g. `"depository"`); this pass treats all depository accounts
  uniformly. Revisit if checking vs. savings needs different treatment.
- No historical tracking of rate changes over time — only the current
  APY/reference values are stored, no time series.

## Architecture

Self-contained feature, no changes to existing report tabs/routes:

1. Two new persisted fields: `Account.apy` (user-entered, per account) and
   a singleton `AppSettings` row (`referenceApy`, `nudgeSnoozedUntil`).
2. A pure aggregation function computes, from account rows + the reference
   rate, which accounts qualify for a "needs rate" prompt vs. an
   "opportunity" row, applying the minimum-gap and minimum-balance filters.
3. A single API route serves and updates this data; a second route sets an
   individual account's APY.
4. A self-fetching card component renders above `ReportTabs` in
   `app/page.tsx`, independent of the tab/date-range state used by the
   existing reports.

## Components & Data Flow

### Data Model (`prisma/schema.prisma`)

- `Account.apy Float?` — user-entered current APY as a percent (e.g. `0.4`
  for 0.4%). Meaningful only where `type === "depository"`; ignored for
  other account types.
- New model:
  ```
  model AppSettings {
    id                String    @id @default("singleton")
    referenceApy      Float?
    nudgeSnoozedUntil DateTime?
  }
  ```
  Single row, same singleton-config pattern as the rest of this
  single-user app. Created lazily on first read/write if it doesn't exist.

### Backend

- `lib/aggregations.ts` — add `cashPlacementNudge(accounts:
  CashPlacementAccount[], referenceApy: number | null, opts?: { minGapPP?:
  number; minBalance?: number }): CashPlacementNudgeResult`, a pure
  function:
  - Filters to accounts with `currentBalance` at least `minBalance`
    (default **$500**).
  - If `referenceApy` is `null`, returns a result flagged so the UI shows
    only the one-time reference-rate setup prompt.
  - Per account: if `apy` is `null`, account is returned in a
    `needsRate` list. If `apy` is set and `referenceApy - apy >= minGapPP`
    (default **0.5** percentage points), account is returned in an
    `opportunities` list with `gapPP` and `annualOpportunityCost = balance
    * gapPP / 100`, sorted by `annualOpportunityCost` descending. Accounts
    below the gap threshold are dropped entirely (not returned in either
    list).
- `lib/db.ts` (or a new `lib/settings.ts`) — `getAppSettings()` /
  `updateAppSettings(patch)` helpers wrapping the singleton
  upsert-by-fixed-id.
- `app/api/nudges/cash-placement/route.ts` — new route:
  - `GET`: loads depository `Account` rows + `AppSettings`, returns
    `{ referenceApy, snoozedUntil, ...cashPlacementNudge(...) }`. If
    `snoozedUntil` is in the future, returns an empty result set (client
    doesn't need its own snooze-comparison logic).
  - `PATCH`: body `{ referenceApy?: number; snooze?: true }` — updates the
    reference rate and/or sets `nudgeSnoozedUntil` to now + 30 days.
- `app/api/accounts/[accountId]/route.ts` — new route:
  - `PATCH`: body `{ apy: number }` — updates that account's `apy`. 404 if
    the account doesn't exist.

### Frontend

- `components/nudge/CashPlacementNudge.tsx` — new, self-fetching client
  component (own `useEffect` fetch of `/api/nudges/cash-placement`, not
  wired to the dashboard's `tab`/`range` state since it isn't date-scoped).
  Render logic:
  - Nothing rendered while loading, on fetch error, or when the API
    returns no reference rate prompt, no `needsRate` accounts, and no
    `opportunities`.
  - If `referenceApy` is `null`: single setup prompt — "See if your cash
    is earning what it could" + an input for today's reference HYSA rate +
    Save, calling the `PATCH` route.
  - Otherwise: one row per `needsRate` account ("What does '<name>'
    currently earn? [__%] [Save]", calling the account `PATCH` route) and
    one row per `opportunities` account (balance, current APY, gap, and
    "~$X/year more" estimate via `money0`), reusing existing `Card`
    styling from `components/ui/Card.tsx`.
  - A dismiss (✕) control on the card calls `PATCH
    /api/nudges/cash-placement` with `{ snooze: true }` and hides the card
    immediately (optimistic), independent of the next full refetch.
- `app/page.tsx` — import and render `<CashPlacementNudge />` once,
  between the header and `ReportTabs`, unconditionally (the component
  decides its own visibility). No changes to `ENDPOINT`, tab union, or
  `dataKey` logic — this card is orthogonal to the existing report-fetch
  cycle.

## Error Handling & Edge Cases

- **No depository accounts connected:** API returns an empty result;
  card renders nothing.
- **Balance not yet synced** (`currentBalance === null`): account excluded
  from consideration entirely (same "don't treat null as $0" pattern used
  in `investingSummary()`).
- **Snoozed:** `GET` returns empty regardless of underlying data — avoids
  a flash-then-hide render on load.
- **Reference rate set but every account already near/above it:**
  `opportunities` and `needsRate` both empty (once every account has an
  `apy` entered) → card renders nothing, no wasted "everything's fine"
  message per YAGNI.
- **Account APY entered as an unreasonable value** (e.g. negative, or
  absurdly high): basic bounds validation in the `PATCH` route (reject
  outside `0–20` percent) — not a full financial-input framework, just
  guards against fat-finger entry.

## Testing

- `tests/aggregations.test.ts`: `cashPlacementNudge()` — no reference rate
  (setup-prompt case), account below min balance (excluded), account with
  no `apy` (needsRate), gap below threshold (excluded), gap at/above
  threshold (opportunity with correct `gapPP`/`annualOpportunityCost`),
  multiple opportunities sorted by cost descending.
- Manual verification: `npm run dev`, set a reference rate, set one
  account's APY well below it and another close to it — confirm only the
  first appears as an opportunity row and the second doesn't appear at
  all; dismiss the card and confirm it disappears immediately and stays
  gone across a reload (until the 30-day snooze expires).

## Success Criteria

- Card never appears unless there's a real setup step or a genuine
  ≥0.5pp gap on a ≥$500 balance.
- No APY or reference-rate figure ever appears hardcoded in source —
  both flow from `AppSettings`/`Account.apy`, editable in-app.
- Dismiss hides the card for 30 days without touching any other report
  tab's state or fetch cycle.
- Existing report tabs (Income/Spending/Cash Flow/Investing) are
  bit-for-bit unchanged in behavior.
- New pure aggregation function fully unit tested; existing test suite
  continues to pass.

## Open Questions / Follow-ups (not blocking this pass)

- If Plaid `subtype` (checking vs. savings vs. money market/CD) is synced
  in the future, this nudge could apply different minimum-gap thresholds
  per subtype rather than treating all depository accounts uniformly.
- No mechanism yet to remind the user to periodically refresh the
  reference HYSA rate itself — it can go stale silently between manual
  updates. A future pass could show "last updated N days ago" on the
  reference rate.
- Per-account dismiss (vs. the current whole-card snooze) could be added
  if a user has many accounts and wants to silence one specific
  already-acknowledged gap while still seeing new ones.
