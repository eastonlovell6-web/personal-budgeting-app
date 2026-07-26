# Money Moves — Design System

Source of truth: `Money Moves Design System.dc.html` (Easton's own export). Every screen in
this app must follow these tokens. Read this before making any UI change — it supersedes the
old ad-hoc "Monarch-style dark theme" naming that used to live directly in `globals.css`.

## Brand

- Name: **Money Moves**
- Tone: bold, energetic, confident — leans into color rather than hiding it
- Fonts: **Sora** (600/700/800, headings/stat figures), **Inter** (400/500/600, body/UI) —
  both Google Fonts, loaded via `next/font/google` in `app/layout.tsx`

## Color tokens

Brand accent (one, used everywhere for CTAs/active states — never reassigned to a screen):

| Token | Hex | Usage |
|---|---|---|
| Orange | `#FF6A33` | Primary buttons, active nav item, brand mark |

Neutrals:

| Token | Hex | Usage |
|---|---|---|
| Ink Black | `#1C1B18` | Dark-mode surfaces, light-mode text |
| Paper White | `#F6F4EF` | Light-mode surfaces, dark-mode text |
| App bg (dark) | `#171614` | — |
| Card surface (dark) | `#211F1B` / `#1F1E1B` | — |
| Hairline border (dark) | `rgba(255,255,255,.08)` | — |
| App bg (light) | `#EDEBE5` / `#F6F4EF` | — |
| Card surface (light) | `#FFFFFF` | — |
| Hairline border (light) | `rgba(0,0,0,.08)` | — |
| Text secondary (dark) | `#A9A69E` | — |
| Text secondary (light) | `#5B584F` | — |
| Text tertiary | `#8A8779` | — |
| Control fill | `#2B2A26` | Secondary button fill, progress-bar track, donut-ring remainder |

**Dark mode is the default; light mode is supported** with the same accent/category colors,
inverted neutrals. Implemented via `[data-theme]`-keyed CSS custom properties in
`app/globals.css` and a manual toggle in the dashboard header — see
`docs/superpowers/specs/2026-07-26-light-mode-design.md` for the design.

Category colors — **fixed 1:1 mapping, never reassigned or mixed across concepts**:

| Concept | Color | Hex |
|---|---|---|
| Income | Green | `#2FA968` |
| Spending | Red | `#EB4B4B` |
| Cash Flow | Blue | `#17ABDA` |
| Savings | Yellow | `#FFC53D` |
| Goals | Magenta | `#CC3DC4` |

A color always means the same thing everywhere it appears — income is never shown in
anything but green, spending never in anything but red, etc. This is stricter than a typical
"positive/negative" delta color scheme: it's concept-bound, not sign-bound.

## Type scale

| Style | Size | Use |
|---|---|---|
| Sora 800 | 40px | Big stat figures |
| Sora 700 | 24px | Screen titles |
| Inter 600 | 17px | Section labels, card titles |
| Inter 400 | 15px | Body / list rows |
| Inter 600, uppercase, tracked | 12px | Eyebrows, category tags |

## Spacing & shape

- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40 (px)
- Radius: 10 (controls), 16 (cards), 24 (large cards/sheets), pill (999, buttons/tags/nav)
- Icons: simple geometric glyphs / single unicode symbols, single stroke weight — no
  illustration, no emoji (note: some shipped screens currently use category emoji for
  spending categories — flagged as a deviation from this rule, not yet reconciled)

## Components

- **Primary button**: pill, orange fill, dark text — universal, not per-category
- **Secondary button**: pill, dark-gray fill (`#2B2A26`), light text
- **Ghost button**: pill, orange 1.5px outline, transparent fill
- **Status chip**: pill, 15% opacity tint of green (on track) or red (over budget) — not yet
  built anywhere in this app; will matter once the Budgeting Mode Toggle / budget-vs-actual
  feature ships
- **Budget/progress bar**: 6–8px pill track `#2B2A26`, fill in the row's category color
- **Savings/goal ring**: conic-gradient donut, category color for progress arc, `#2B2A26`
  remainder
- **Bottom tab bar**: 5 items — Income / Spend / Flow / Save / Goals — active item labeled in
  its category color, others in `#5B584F` (light) / `#8A8779` (dark)

## Screens (5 primary)

Income (green hero card), Spending (red hero card + category bars), Cash Flow (stat cards +
income→category flow bar), Savings (yellow donut + buckets), Goals (magenta progress cards).
Each screen's hero/accent element uses that screen's category color; everything else
(surfaces, text, nav) stays neutral so the category color reads as the signal.

## Applied so far vs. still open

Applied in the 2026-07-24 color pass:
- All root color tokens (`app/globals.css`) rewritten to this palette
- `lib/palette.ts`'s `CHART`/`CONCEPT` colors updated; `income`/`spending` now map directly
  to Income Green / Spending Red everywhere they're referenced (StatRow, Sankey diagram)
- `ReportTabs` active-tab label now colored by that tab's category
- `GoalsView` progress bars → Goals Magenta
- `SavingsView` hero total → Savings Yellow
- `IncomeView` total-income stat → Income Green
- Sankey diagram's income/savings nodes → Income Green (was a hardcoded, unrelated green)
- Sora + Inter fonts wired up via `next/font/google`; applied to the clearest "big stat
  figure" elements (donut center total, StatRow figures, Income/Savings hero totals)

Applied in the 2026-07-26 type-scale/radius pass:
- `text-screen-title` / `text-section-label` / `text-eyebrow` utility classes added
  (`app/globals.css`) for the Sora 700/24px, Inter 600/17px, and Inter 600/12px-uppercase
  styles; applied to the "Reports" header, each card's section label ("Income by month",
  "Summary", "Cash flow"), and small stat captions (StatRow labels, donut "Total",
  SavingsView "Simulated this period")
- Radius tokens (`rounded-control` 10px / `rounded-card` 16px / `rounded-pill` 999px) added
  and swapped in for the ad-hoc `rounded-lg`/`rounded-xl`/`rounded-2xl` utilities across
  `Card`, `StatRow`, form inputs (Goals/Savings/CashPlacementNudge/login), the
  `DateRangePicker` dropdown, and chart tooltips
- Primary buttons (`bg-accent`) switched from `text-white` to a new `text-ink` token
  (`--ink: #1c1b18`), matching the "orange fill, dark text" primary-button spec; this
  covers every accent CTA (Unlock, Connect a bank, Add goal, Add rule, Active/Paused toggle,
  both nudge Save buttons)
- Secondary-style chips (+ Account, the date-range trigger, "Back to home") switched from a
  bordered `bg-surface` fill to solid `bg-control`/`text-foreground`, matching the
  "Secondary button: pill, dark-gray fill, light text" spec

**Not yet done** — real follow-up work, not silently skipped:
- Status chips (no budget-vs-actual feature exists yet to attach them to)
- `lib/palette.ts`'s `CATEGORICAL` 8-hue array (used for spending sub-category breakdowns,
  e.g. Housing/Food/Transport slices) is a **separate, independent palette** from the 5 fixed
  concept colors above — it was deliberately left alone, since the design system doesn't
  specify sub-category chart colors. Worth a look later to make sure none of its 8 hues reads
  as visually confusable with the 5 fixed concept colors (e.g. its green and Income Green).
- Ghost button style (pill, orange outline, transparent fill) has no user yet — SpendingView's
  "Show more" link was deliberately left as plain text rather than forced into that shape
