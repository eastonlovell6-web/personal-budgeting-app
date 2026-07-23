# Goals (Savings Buckets) — Design Spec

**Date:** 2026-07-23
**Status:** Approved (pending final spec review)
**Author:** Easton Lovell (with Claude)

## Summary

Adds a new "Goals" tab where the user defines named savings goals (e.g.
"Emergency Fund", "Roth IRA", "Fun Fund"), each with a target amount and a
manually-tracked current progress amount, and sees each goal's progress as
a bar. This is the vault vision doc's #3-priority "Goal-Based Savings
Buckets" (`claudemd/screens/goals.md`). Unlike every other tab in this app,
Goals is not a transaction-derived report — progress is a number the user
enters and updates by hand, not something computed from `Transaction` rows.

## Goals

- Let the user create, edit (name/target/progress), and delete named
  savings goals.
- Show each goal's progress as `$current / $target` plus a horizontal
  progress bar, visually capped at 100% even if `currentAmount` exceeds
  `targetAmount`.
- Goals tab is always-on in the tab bar by default, exactly like every
  other tab — no onboarding flow or settings toggle gates it. (This app
  has no onboarding sequence today; inventing one just to gate this tab
  would be scope creep beyond what's needed.)

## Non-Goals (this pass)

- **No automatic progress tracking.** Progress is not linked to a real
  Plaid `Account` balance and not derived from a contribution log/history
  — just a flat, user-edited `currentAmount`. Linking a goal to a real
  account, or building a dated contribution log, are both viable future
  directions but add complexity (which account "counts," history UI) not
  justified yet.
- **No seeded default goals.** The vault doc's Emergency Fund / Roth IRA /
  Fun Fund are examples, not shipped defaults — the goal list starts empty
  and the user adds every goal themselves, same pattern as Savings Rules'
  empty rule list. Avoids the app inventing target amounts on the user's
  behalf.
- **No milestone/completion gamification.** Reaching 100% just means the
  bar shows full — no badge, animation, or celebration. The screen doc
  raised gamification as worth considering but flagged the dark-pattern
  risk; simplest v1 is to skip it entirely rather than design it carefully
  later.
- **No date-range scoping.** Every other report tab is scoped to the
  selected date range; Goals isn't a report over a period; it's a
  snapshot of current state, so the shared `start`/`end` query params are
  accepted (for `ENDPOINT` consistency) but ignored.
- **Budgeting Mode Toggle (zero-based/envelope mode)** is a separate,
  later screen (vault priority #6, explicitly sequenced after Goals) — not
  addressed here.

## Architecture

One new Prisma model, `Goal` — flat, no relations to `Account`/
`Transaction` (progress isn't derived from Plaid data). Unlike Savings
Rules, there's no aggregation/simulation step: the CRUD data *is* the
report, so there's no separate `/api/reports/goals` route and no new
`lib/aggregations.ts` function — just one CRUD route pair, following the
same `ENDPOINT`/`Tab`/`dataKey` machinery in `app/page.tsx` used by every
other tab.

## Components & Data Flow

### Data Model (`prisma/schema.prisma`)

```prisma
model Goal {
  id            String   @id @default(cuid())
  name          String
  targetAmount  Float
  currentAmount Float    @default(0)
  createdAt     DateTime @default(now())
}
```

### Backend

- `app/api/goals/route.ts`:
  - `GET`: returns all `Goal` rows (ignores any query params the shell
    appends).
  - `POST`: body `{ name, targetAmount }` — creates a goal with
    `currentAmount` defaulting to `0`. Validates `name` is a non-empty
    trimmed string and `targetAmount > 0`; 400 on invalid input.
- `app/api/goals/[id]/route.ts`:
  - `PATCH`: body `{ name?, targetAmount?, currentAmount? }` — partial
    update. Same validation as `POST` for any field present, plus
    `currentAmount >= 0`. 404 if the goal doesn't exist.
  - `DELETE`: permanently removes the goal. 404 if it doesn't exist.

### Frontend

- `Tab` type (`components/ReportTabs.tsx`) gains `"goals"` (added after
  `"savings"`); `ENDPOINT` in `app/page.tsx` gains
  `goals: "/api/goals"`.
- `components/goals/GoalsView.tsx` — new, receives `Goal[]` and an
  `onChange` callback (same shape as `SavingsView`):
  - One `Card` per goal, stacked vertically: name and
    `$current / $target` on top, a horizontal progress bar underneath
    (width = `min(currentAmount / targetAmount, 1) * 100%`).
  - `currentAmount` is an inline-editable number input in each card —
    editing and blurring (or pressing Enter) triggers a `PATCH`.
  - Small delete (✕) control per goal.
  - "Add goal" form: name text input + target amount number input +
    "Add goal" button → `POST`.
  - Empty state: "No goals yet — add one below." (same copy pattern as
    `SavingsView`'s empty rule list.)

## Error Handling & Edge Cases

- **No goals created yet:** just the empty-state message and the add-goal
  form — no progress bars to render.
- **`currentAmount` exceeds `targetAmount`:** the bar visually caps at
  100% width; the underlying numbers still display as entered (e.g.
  "$1,200 / $1,000") so the user isn't shown a number that contradicts
  what they typed.
- **Deleting a goal** is immediate and permanent (no soft-delete/undo) —
  consistent with Savings Rules' delete behavior; this is a tracking tool,
  not a ledger of record.
- **Invalid input** (`targetAmount <= 0`, blank `name`, negative
  `currentAmount`): rejected with 400, same fat-finger-guard pattern as
  Savings Rules' percent/increment validation.
- **Editing while a fetch is in flight:** follows the same `onChange` →
  refetch pattern as `SavingsView`; no optimistic local state beyond the
  input's own controlled value during editing.

## Testing

- No new `lib/aggregations.ts` function, so no aggregation unit tests —
  the only logic is route-handler validation and the component's
  progress-bar width calculation.
- Manual verification: `npm run dev`, add a goal, edit its current amount
  inline and confirm the bar updates and persists across reload, add a
  second goal, delete one and confirm it's gone, enter a current amount
  above target and confirm the bar caps at 100% without the displayed
  numbers changing.
- `npx tsc --noEmit` and the existing `npm test` suite stay green (no
  existing tests should need changes).

## Success Criteria

- Goals tab behaves like every other tab: wired through the existing
  `ENDPOINT`/`Tab`/`dataKey` machinery with no changes to that machinery's
  shape, and visible by default with no gating.
- Goal CRUD (create, edit name/target/progress, delete) works and
  persists across reloads.
- Progress bar accurately reflects `currentAmount`/`targetAmount` and caps
  visually at 100%.
- Existing tabs (Income/Spending/Cash Flow/Investing/Savings) and the Cash
  Placement Nudge are bit-for-bit unchanged in behavior.
- Existing test suite continues to pass.

## Open Questions / Follow-ups (not blocking this pass)

- Linking a goal to a real Plaid account balance (auto-tracked progress)
  or a dated contribution log (progress history) were both considered and
  deferred — could be revisited if manual entry proves too tedious in
  practice.
- No milestone/completion treatment for now; could be revisited later if
  it can be designed without tipping into a dark pattern, per the screen
  doc's caution.
- No goal reordering/prioritization UI — goals display in `createdAt`
  order, same as Savings Rules.
