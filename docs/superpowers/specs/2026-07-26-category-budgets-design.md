# Category Budgets (replaces Goals) — Design Spec

**Date:** 2026-07-26
**Status:** Approved (pending final spec review)
**Author:** Easton Lovell (with Claude)

## Summary

Replaces the existing Goals tab (savings-target buckets like "Emergency
Fund: $3,000 of $10,000") with category budgets: pick a spending category
(or a whole category group), set a monthly cap, and see Budget / Actual /
Remaining for the current calendar month, where Actual is computed
automatically from real Plaid transactions — not entered by hand. This is
the "budget-vs-actual" concept `claudemd/design-system.md` already flags as
tied to the (planned, not-yet-built) Budgeting Mode Toggle screen; this spec
implements that concept inside the existing Goals tab slot rather than as a
new tab.

The Goals tab id/label/color in `components/ReportTabs.tsx` do not change —
only what's inside it.

## Goals

- Let the user add a budget for a spending category (or a whole category
  group, e.g. "Shopping"), each with a monthly cap amount.
- Show each budget as: category name, a progress ring (emoji centered),
  and a Budget / Actual / Remaining row — matching the reference screenshot
  layout — where Actual is this calendar month's real spend in that
  category/group and Remaining is `Budget − Actual`.
- Offer six one-tap preset categories (Groceries, Restaurants, Shopping,
  Transportation, Entertainment, Bills & Utilities) plus a "Custom…" picker
  covering every other category/group.
- Let the user edit a budget's monthly amount inline and delete a budget.

## Non-Goals (this pass)

- **No migration of existing Goal data.** The `Goal` table (savings-target
  buckets) is dropped outright when the `CategoryBudget` model replaces it.
  Single-user app, no remote DB yet — acceptable per explicit confirmation,
  but worth restating since it's destructive.
- **No date-range scoping.** Unlike every other report tab, this one is
  always the current calendar month, independent of the shared
  `DateRangePicker` state — a "$200 grocery budget" isn't meaningful over an
  arbitrary custom range. The shared `start`/`end` query params are still
  sent (for `ENDPOINT`/`load()` consistency) but the API route ignores them.
- **No rollover / historical months.** Only the current month's actual is
  ever shown; there's no "last month's budgets" view or carry-over of
  unspent amounts. Worth a future pass if useful in practice.
- **No budget vs. multiple categories in one card** beyond the group-level
  aggregation described below — a budget is exactly one category or exactly
  one group, not an arbitrary user-defined bundle.
- **No status chip / notification on overspend.** The ring and Remaining
  text turning red is the only over-budget signal this pass; push
  alerts are the separate, later "Notifications" screen
  (`claudemd/screens/notifications.md`).

## Architecture

Plaid's `personal_finance_category` only sums cleanly at two granularities:
one **detailed** code (e.g. `FOOD_AND_DRINK_GROCERIES`) or a whole **group**
as already defined in `lib/categories.ts`'s `GROUPS` (e.g. "Shopping" is 12
different detailed codes — Clothing, Electronics, Superstores, etc. — with
no single Plaid code covering all of them). Since the reference screenshot
mixes both ("Groceries" reads naturally as one specific category, "Shopping"
as a whole group), `CategoryBudget.categoryKey` stores either:

- a bare detailed code, e.g. `"FOOD_AND_DRINK_GROCERIES"`, or
- a group key prefixed `GROUP:`, e.g. `"GROUP:Shopping"`.

`lib/aggregations.ts` gains one function that branches on this prefix to sum
actual spend; `lib/categories.ts` gains a small group-emoji table and a
combined lookup so both branches resolve to the same `{ display, emoji }`
shape the UI needs.

Like Goals before it, this is flat CRUD with a derived field (`actualAmount`)
computed at read time — no new `/api/reports/*` route, following the same
`ENDPOINT`/`Tab`/`dataKey` machinery in `app/page.tsx` every other tab uses.

## Components & Data Flow

### Data Model (`prisma/schema.prisma`)

Replace the `Goal` model:

```prisma
model CategoryBudget {
  id            String   @id @default(cuid())
  categoryKey   String   @unique
  monthlyAmount Float
  createdAt     DateTime @default(now())
}
```

Migration: `npx prisma migrate dev --name replace_goal_with_category_budget`
(drops `Goal`, creates `CategoryBudget`).

### `lib/categories.ts`

- Add `GROUP_EMOJI: Record<Exclude<(typeof GROUPS)[number], "Income">, string>`:
  Housing 🏠, "Bills & Utilities" 🧾, "Food & Dining" 🍴, Transportation 🚙,
  Shopping 🛍️, "Travel & Vacation" ✈️, Entertainment 🎭, "Health & Wellness"
  ⚕️, Other 📦.
- Add `categoryOrGroupInfo(key: string): { display: string; emoji: string }`
  — if `key` starts with `"GROUP:"`, look up the group name in `GROUP_EMOJI`
  (display = the group name itself); otherwise delegate to the existing
  `categoryInfo(key)`.
- Add `budgetableOptions(): { key: string; display: string; emoji: string }[]`
  — one entry per non-Income group (`GROUP:<name>`) plus one entry per
  non-Income detailed category, for the "Custom…" picker and for
  server-side validation that a submitted `categoryKey` is real.

### `lib/aggregations.ts`

```ts
export function budgetActual(txns: Txn[], categoryKey: string): number {
  const inScope = categoryKey.startsWith("GROUP:")
    ? (t: Txn) => categoryInfo(t.pfDetailed).group === categoryKey.slice(6)
    : (t: Txn) => t.pfDetailed === categoryKey;
  return txns.reduce((sum, t) => (!t.isIncome && inScope(t) ? sum + t.amount : sum), 0);
}
```

### `lib/reports.ts`

```ts
export function currentMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}
```

(`now` is a parameter, defaulting to `new Date()`, so the unit test can pin
a fixed month without mocking global time.)

### `lib/types.ts`

Replace the `Goal` type:

```ts
export type CategoryBudget = {
  id: string;
  categoryKey: string;
  display: string;
  emoji: string;
  monthlyAmount: number;
  actualAmount: number;
};
```

### Backend

- Delete `app/api/goals/route.ts` and `app/api/goals/[id]/route.ts`.
- `app/api/budgets/route.ts`:
  - `GET`: ignores query params; uses `currentMonthRange()` +
    `loadTxns(start, end)`; for each `prisma.categoryBudget.findMany()` row,
    computes `actualAmount = budgetActual(txns, categoryKey)` and
    `{ display, emoji } = categoryOrGroupInfo(categoryKey)`; returns
    `CategoryBudget[]`.
  - `POST`: body `{ categoryKey, monthlyAmount }`. Validates
    `monthlyAmount > 0` and that `categoryKey` is one of
    `budgetableOptions()`'s keys; 400 otherwise. Creates the row; catches
    the unique-constraint error (duplicate `categoryKey`) and returns 400
    "A budget for this category already exists" instead of a raw 500.
- `app/api/budgets/[id]/route.ts`:
  - `PATCH`: body `{ monthlyAmount }`, same `> 0` validation, 404 if the
    budget doesn't exist.
  - `DELETE`: 404 if it doesn't exist, otherwise removes it.

### Frontend

- `app/page.tsx`: `ENDPOINT.goals` becomes `"/api/budgets"`; the `Goal`
  import/type becomes `CategoryBudget`; `<GoalsView data={data as
  CategoryBudget[]} onChange={load} />` unchanged otherwise. `Tab`/
  `ReportTabs` are untouched — the tab keeps id `"goals"` and label "Goals".
- `components/goals/GoalsView.tsx` (full rewrite, same file path):
  - `PRESETS`: the six keys `FOOD_AND_DRINK_GROCERIES`,
    `FOOD_AND_DRINK_RESTAURANT`, `GROUP:Shopping`, `GROUP:Transportation`,
    `GROUP:Entertainment`, `GROUP:Bills & Utilities`; display/emoji resolved
    via `categoryOrGroupInfo`.
  - One `Card` per budget:
    - Header row: category name (left), small delete `✕` (muted, matches
      current pattern), a ring (right) — `div` with
      `background: conic-gradient(var(--goals|--spending) <pct>%, var(--control) 0)`
      wrapping a smaller circle showing the emoji; `pct = monthlyAmount > 0
      ? Math.min(actualAmount / monthlyAmount, 1) * 100 : 0`; ring color is
      `var(--spending)` once `actualAmount > monthlyAmount`, else
      `var(--goals)`.
    - Below the header: a three-column row — Budget (editable number input,
      same inline-edit-on-blur pattern the current Goals card uses for
      `currentAmount`, `PATCH`es `monthlyAmount`), Actual (plain text,
      neutral color), Remaining (`monthlyAmount - actualAmount`; `income`
      green if `≥ 0`, `spending` red with "Over by $X" phrasing if
      negative). Labels use the existing `text-eyebrow text-muted` style.
  - "Add a budget" section below the list:
    - Preset chip tray (emoji + label buttons) filtered to hide any
      `categoryKey` already budgeted.
    - Tapping a preset (or "Custom…") reveals an inline amount input +
      "Add budget" button; "Custom…" additionally shows a `<select>`
      (optgroups "Category groups" / "Specific categories") built from
      `budgetableOptions()`, excluding already-budgeted keys.
    - Empty state: "No budgets yet — add one below." (same copy pattern as
      the current Goals/Savings Rules empty states).

## Error Handling & Edge Cases

- **No budgets yet:** empty-state message plus the add-budget UI; no cards.
- **`monthlyAmount ≤ 0` or blank:** rejected client-side (button stays
  disabled, mirroring the current Goals add-form guard) and server-side
  (400).
- **Duplicate `categoryKey`:** the already-budgeted preset/option is hidden
  from the picker, so this mainly guards a race (e.g. two tabs open); the
  API still checks and returns a clean 400 rather than a raw Prisma error.
- **Unknown/garbage `categoryKey`:** 400, validated against
  `budgetableOptions()`.
- **Over budget:** ring turns `--spending` red past 100% (visually capped at
  a full ring, doesn't overflow past the circle), Remaining shows the
  negative amount in red as "Over by $X" — editing/deleting still works
  normally.
- **Current month has no synced transactions yet:** every `actualAmount` is
  `0`, rings show empty — not an error state, just early-month reality.
- **Deleting a budget** is immediate and permanent, consistent with
  Goals'/Savings Rules' existing delete behavior (no soft-delete/undo).

## Testing

- `lib/aggregations.ts`'s new `budgetActual`: unit tests for (a) a bare
  detailed key summing only matching, non-income transactions, (b) a
  `GROUP:` key summing across multiple detailed codes that share that
  group while excluding other groups, (c) empty transactions returning `0`.
- `lib/reports.ts`'s new `currentMonthRange(now)`: unit test passing a fixed
  `now` and asserting the returned UTC month start/end.
- Manual verification: `npm run dev` (demo data from `npm run seed` already
  includes the current calendar month), add the Groceries preset with a
  budget below what's been spent this month and confirm Actual/Remaining/red
  ring; add the Shopping group preset and confirm its Actual sums multiple
  Shopping subcategories (cross-check against the Spending tab's per-category
  breakdown for the same month); edit a budget's amount inline; delete one;
  add a "Custom…" budget for a category not in the preset tray.
- `npx tsc --noEmit` and `npm test` stay green; no existing test file
  references `Goal`, so no other test changes are needed.

## Success Criteria

- Goals tab (same id/label/color) now shows category budgets: Budget /
  Actual / Remaining per card, ring visual, matching the reference layout.
- Actual is always the real current-month Plaid spend for that category or
  group — never manually entered.
- Both detailed-category and whole-group budgets work correctly and
  independently (no double-counting, no missed transactions within a
  group).
- Budget CRUD (create via preset or custom, edit amount, delete) persists
  across reloads.
- Existing tabs (Income/Spending/Cash Flow/Savings) and the Cash Placement
  Nudge are bit-for-bit unchanged.
- Existing test suite continues to pass.

## Open Questions / Follow-ups (not blocking this pass)

- No rollover of unspent budget into next month, and no history of past
  months' budget performance — both deferred until real usage shows whether
  they're needed.
- No push/notification on crossing 100% — that's the separate Notifications
  screen, sequenced later per the vault vision doc.
- The six presets are a starting guess (Groceries, Restaurants, Shopping,
  Transportation, Entertainment, Bills & Utilities); worth revisiting once
  real spending data shows which categories the user actually wants capped.
