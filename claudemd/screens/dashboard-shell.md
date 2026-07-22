# Screen: Dashboard Shell

## Purpose

The app's single page — owns tab state (Income/Spending/Cash Flow) and
date-range state, fetches the active report, triggers a background Plaid
sync on open, and renders the loading/empty/report states.

## Status

Shipped — commit `1b05a89` ("feat: dashboard shell + income, spending, cash
flow views").

## Key Files

- `app/page.tsx:24` — `Home` component: tab/range state, `ENDPOINT` map
  (`app/page.tsx:18`), `load()` fetch, sync-on-open effect
  (`app/page.tsx:50-56`).
- `components/ReportTabs.tsx:11` — segmented pill control (Income |
  Spending | Cash Flow), `role="tablist"`/`"tab"` for accessibility.
- `components/DateRangePicker.tsx:33` — dropdown of 4 presets (Last 3/6/12
  months, Year to date), default "Last 6 months" (`DEFAULT_RANGE_INDEX = 1`,
  `components/DateRangePicker.tsx:31`).
- `components/LinkButton.tsx:66` — `ConnectEmptyState` (empty-state CTA) and
  `AddAccountButton` (header "+ Account" button), both driving the shared
  `usePlaidConnect` hook (`components/LinkButton.tsx:12`).
- `lib/format.ts:52` — `isoDate()` used to build report query params.

## Layout / UI Spec

Header row (title + `AddAccountButton` + `DateRangePicker`) unless in the
empty state, then `ReportTabs`, then one of: "Loading…" placeholder,
`ConnectEmptyState` (no linked accounts), or the active report view.
`dataKey` (`app/page.tsx:32-34`) guards against rendering stale data from a
previous tab/range while a new fetch is in flight.

## Data Contract

`IncomeReport | SpendingReport | CashflowReport` from `lib/types.ts`,
selected by whichever tab is active. Empty-state detection is per-report-
shape (`app/page.tsx:59-66`) — each report type has its own "zero data"
check.

## Fintech UX Principles Applied

**Continuity** — tab and range state persist across a fetch, and `dataKey`
guarantees the UI never shows one tab's chart with another tab's data
mid-switch. **Clarity** — the segmented control makes three distinct report
types feel like one continuous "Reports" surface.

## Open Questions / Risks

Sync runs once per app open (`app/page.tsx:50-56`) via
`POST /api/plaid/sync` — there's no periodic background refresh yet. Noted
as an open follow-up in
`docs/superpowers/specs/2026-07-19-personal-budgeting-app-design.md`.

## How to Verify

`npm run dev`, log in, switch tabs and date ranges — chart updates without
flashing stale data. With a fresh `dev.db` (no linked accounts),
`ConnectEmptyState` renders instead of a chart.
