# Budgeting Mode Toggle — Design Spec

**Date:** 2026-07-23
**Status:** Approved (pending final spec review)
**Author:** Easton Lovell (with Claude)

## Summary

Adds a settings-level switch between **Automated** mode (default, today's
behavior) and **Envelope** mode. This is the vault vision doc's #6-priority
"Budgeting Mode Toggle" (`claudemd/screens/budgeting-mode-toggle.md`),
explicitly sequenced after the automation core (Cash Placement Nudge,
Automated Savings Rules, Goals) — all now shipped, so this is unblocked.
Envelope mode overlays a per-category-group monthly budget cap onto the
existing Spending screen; Automated mode leaves Spending exactly as it
works today. No other screen changes.

## Goals

- A gear-icon Settings entry point in the dashboard header, opening a panel
  with the Automated/Envelope mode toggle.
- In Envelope mode, the Spending screen gains an "Envelope Caps" card below
  the existing donut/detailed-category-list, showing one row per expense
  category group (the 8 non-Income entries in `GROUPS`,
  `lib/categories.ts:8`) with an inline-editable monthly $ cap, actual
  spend, and a progress bar.
- Caps scale with whatever date range is selected in the shared
  `DateRangePicker` (Last 3/6/12 months, YTD): a monthly cap is multiplied
  by the number of distinct calendar months the selected range touches
  before comparing to actual spend.
- Over-cap groups are flagged with an explicit label + icon, never color
  alone.
- Caps persist independent of mode — toggling back to Envelope later shows
  previously-set caps unchanged.

## Non-Goals (this pass)

- **No per-detailed-category caps.** Caps are per group (8 groups), not per
  the ~50+ granular Plaid detailed categories already listed on Spending
  today — fewer numbers to manage, matches Monarch-style envelope
  budgeting, and reuses the same grouping already used for the Cash Flow
  Sankey.
- **No cap on the "Income" group.** Envelope budgeting caps expenses, not
  income.
- **No rollover** of unused cap into the next period, and **no
  notifications/alerts** when a cap is exceeded — the still-planned,
  separate Notifications screen owns alerting.
- **No other settings.** The new Settings panel holds only the mode
  toggle for now; it's a new surface but not a general preferences screen.
- **Automated mode is unchanged.** It is not a distinct implementation —
  it's simply "Envelope Caps card absent."

## Architecture

Two new Prisma pieces: a `budgetingMode` field added to the existing
`AppSettings` singleton (`lib/settings.ts:5`, same pattern as
`referenceApy`/`nudgeSnoozedUntil`), and a new `CategoryCap` model, one row
per group, created on demand as the user sets caps — a group with no row
means "no cap set yet," not a $0 cap.

A new report endpoint, `/api/reports/envelope`, computes per-group actual
spend the same way `spendingByCategory` (`lib/aggregations.ts:64`) computes
per-detailed-category spend, but buckets by `categoryInfo(pfDetailed).group`
instead, and joins in each group's `CategoryCap`. The existing
`/api/reports/spending` and `SpendingReport` type are untouched — Automated
mode's donut/list keep working exactly as today regardless of this change.

## Components & Data Flow

### Data Model (`prisma/schema.prisma`)

```prisma
model AppSettings {
  id                String    @id @default("singleton")
  referenceApy      Float?
  nudgeSnoozedUntil DateTime?
  budgetingMode     String    @default("automated") // "automated" | "envelope"
}

model CategoryCap {
  group      String @id // one of the 8 non-Income GROUPS entries
  monthlyCap Float
}
```

### Backend

- `lib/settings.ts`: extend `getAppSettings()`'s default object with
  `budgetingMode: "automated"`, and `updateAppSettings()`'s patch type with
  `budgetingMode?: string`.
- `app/api/settings/route.ts` (new):
  - `GET`: returns `getAppSettings()` (mode + existing fields).
  - `PATCH`: body `{ budgetingMode }` — validates it's `"automated"` or
    `"envelope"`; 400 otherwise. Calls `updateAppSettings`.
- `app/api/category-caps/route.ts` (new):
  - `GET`: returns all `CategoryCap` rows as `{ group, monthlyCap }[]`.
  - `PATCH`: body `{ group, monthlyCap }` — upserts one row. Validates
    `group` is one of the 8 non-Income `GROUPS` entries and
    `monthlyCap > 0`; 400 otherwise.
- `lib/aggregations.ts`: new `spendingByGroup(txns)` — same filtering as
  `spendingByCategory` (excludes income/transfers), buckets by
  `categoryInfo(t.pfDetailed).group`, sums per group.
- New `lib/format.ts` (or `lib/aggregations.ts`) helper `monthsInRange(start,
  end): number` — counts distinct `(year, month)` pairs touched by the
  range (e.g. "Last 3 months" → 3; YTD in July → 7).
- `app/api/reports/envelope/route.ts` (new):
  - `GET ?start=&end=`: queries transactions in range, runs
    `spendingByGroup`, fetches all `CategoryCap` rows, computes
    `monthsInRange(start, end)`. Returns one entry per of the 8 non-Income
    `GROUPS` (always all 8, so unspent/uncapped groups still show a row):
    `{ group, emoji, actual, cap: monthlyCap * months | null, overBy:
    max(0, actual - cap) | null }`. `cap`/`overBy` are `null` when no
    `CategoryCap` row exists for that group.

### Frontend

- New `components/SettingsPanel.tsx` (or similar): gear icon button in the
  dashboard header (`app/page.tsx`, alongside `AddAccountButton` and
  `DateRangePicker`), opening a small modal/panel with a segmented
  Automated/Envelope toggle. Fetches current mode from `GET /api/settings`
  on open; `PATCH`es on change.
- `app/page.tsx`: `Dashboard` fetches `budgetingMode` once on mount (small
  `GET /api/settings` call, independent of the tab/range `load()` cycle)
  and passes it down to `SpendingView` as a prop.
- `components/spending/SpendingView.tsx`: when `budgetingMode ===
  "envelope"`, additionally fetches `/api/reports/envelope` for the current
  range (refetches whenever `range` changes, same dependency as the main
  report) and renders a new "Envelope Caps" card below the existing
  donut/list, unchanged above it.
  - Each row: emoji + group name, `$actual / $cap` (or "Set a cap" if
    `cap` is `null`), progress bar (`min(actual/cap, 1) * 100%` width).
  - The `$cap` text is inline-editable (tap to edit, blur/Enter to save —
    same interaction as `GoalsView`'s `currentAmount` input,
    `components/goals/GoalsView.tsx:84-98`), `PATCH`ing
    `/api/category-caps` with the entered *monthly* amount (not the
    range-scaled `cap` value) and refetching.
  - Over-cap rows (`overBy > 0`) show "⚠️ Over by $X" next to the bar, in
    addition to (not instead of) a visually fuller/differently-colored bar.

## Error Handling & Edge Cases

- **No caps set for any group:** every row shows "Set a cap" instead of a
  bar; no error, just an all-placeholder card.
- **Cap entered as 0 or negative:** rejected client-side same as `Goal`'s
  `targetAmount` validation, and 400 server-side.
- **Range spans a partial month** (e.g. "Last 3 months" includes today's
  partial current month): counted as one full month in `monthsInRange` —
  no proration within a month, consistent with how the existing
  `DateRangePicker` presets already always start ranges on the 1st.
- **Switching modes mid-session:** `SpendingView` only fetches
  `/api/reports/envelope` when mode is `"envelope"`; switching to
  Automated simply stops rendering the card (data already fetched is
  discarded, no special cleanup needed).
- **Editing a cap while a fetch is in flight:** follows the same
  inline-edit-then-refetch pattern as `GoalsView`.

## Testing

- Unit tests (`tests/aggregations.test.ts`): `spendingByGroup` (buckets
  correctly, excludes income/transfers, matches `spendingByCategory`'s
  total when summed) and `monthsInRange` (3/6/12-month presets, YTD at
  various points in the year, single-month edge case).
- Manual verification: `npm run dev`, open Settings, switch to Envelope
  mode, confirm the Envelope Caps card appears on Spending with all 8
  groups and "Set a cap" placeholders; set a cap inline, confirm the bar
  and `$actual/$cap` update and persist across reload; change the date
  range and confirm the cap scales (e.g. doubles going from "Last 3
  months" to "Last 6 months") while actual updates accordingly; push a
  group over its cap and confirm the "⚠️ Over by $X" label appears; switch
  back to Automated and confirm Spending looks exactly as it did before
  this feature.
- `npx tsc --noEmit` and the existing `npm test` suite stay green.

## Success Criteria

- Mode toggle persists across reloads via `AppSettings.budgetingMode`.
- Envelope Caps card renders only in Envelope mode, shows all 8 non-Income
  groups, and correctly scales caps to the selected date range.
- Cap edits persist via inline editing, independent of mode — set once,
  visible again next time Envelope mode is active.
- Over-cap state is always indicated by label + icon, never color alone.
- Existing tabs (Income, Spending's donut/list, Cash Flow, Investing,
  Savings, Goals) and the Cash Placement Nudge are bit-for-bit unchanged
  in Automated mode.
- Existing test suite continues to pass.

## Open Questions / Follow-ups (not blocking this pass)

- Whether caps should eventually feed into the Cash Flow Sankey or a
  future Notifications screen (over-cap alerts) — explicitly deferred.
- Whether "Set a cap" groups with zero activity should be hideable — not
  addressed; all 8 always show for now, consistent with a fixed, small
  set of categories rather than a user-managed list like Goals.
