# Light Mode — Design

## Purpose

Add a user-toggleable light mode to Money Moves. The app is currently
dark-only per an explicit constraint in `CLAUDE.md` and
`claudemd/design-system.md` ("light mode is documented here for
completeness but not yet implemented; don't add it without a separate
decision to do so"). This spec is that decision. Light-mode hex values are
already documented in `claudemd/design-system.md`'s color-tokens table and
are reused here rather than invented fresh.

## Trigger

Manual toggle only — no `prefers-color-scheme` auto-detection. The user
explicitly sets light or dark; the choice persists across sessions.

## Theme mechanism

- `<html data-theme="dark" | "light">` carries the active theme.
- A `ThemeProvider` (React context, `theme` + `toggleTheme`) wraps the app
  in `app/layout.tsx`, backed by `localStorage.getItem("theme")` /
  `setItem`. Defaults to `"dark"` when unset.
- A small inline blocking script (in `app/layout.tsx`, before hydration)
  reads `localStorage` and sets the `data-theme` attribute on `<html>`
  synchronously, so there's no flash of the wrong theme on first paint —
  this applies on every route, including `/login`, even though the login
  screen has no toggle control of its own.
- The provider's client-side state is initialized from the same
  `data-theme` attribute the blocking script already set (read on mount),
  so provider state and DOM attribute never disagree.

## Color tokens (`app/globals.css`)

Move the current `:root` values under `[data-theme="dark"]`, unchanged.
Add `[data-theme="light"]` using the values already in
`claudemd/design-system.md`:

| Token | Dark (current) | Light (new) |
|---|---|---|
| `--background` | `#171614` | `#EDEBE5` |
| `--surface` | `#211f1b` | `#FFFFFF` |
| `--surface-2` | `#1f1e1b` | `#FFFFFF` |
| `--border` | `rgba(255,255,255,.08)` | `rgba(0,0,0,.08)` |
| `--foreground` | `#f6f4ef` (Paper White) | `#1c1b18` (Ink Black) |
| `--muted` | `#a9a69e` | `#5b584f` |
| `--tertiary` | `#8a8779` | `#8a8779` (unchanged — design doc lists one tertiary value) |
| `--control` | `#2b2a26` | `#e5e2db` |
| `--accent` | `#ff6a33` | `#ff6a33` (unchanged) |
| `--ink` | `#1c1b18` | `#1c1b18` (unchanged — text on the orange accent fill stays Ink Black in both themes) |

Category colors (`--income`, `--spending`, `--cashflow`, `--savings`,
`--goals`) and `--positive`/`--negative` are unchanged in both themes, per
`claudemd/design-system.md`: "light mode is supported with the same
accent/category colors, inverted neutrals."

Note: `--control`'s light value (`#e5e2db`) has no documented hex in
`claudemd/design-system.md` (it only lists dark's `#2b2a26`); chosen here as
a light neutral a shade off `--background` (`#EDEBE5`), consistent with how
dark's `--control` sits a shade off dark's `--background`. It's used for
secondary-button fill, progress-bar track, and donut-ring remainder — all of
which need to read clearly against white cards in light mode.

## Chart colors (`lib/palette.ts`)

`CHART.surface/grid/axis/textPrimary/textMuted` are currently hardcoded
dark hex values fed directly into Recharts props (tooltip background, axis
tick color, grid lines). Replace them with `var(--surface)`, `var(--border)`
(for grid — closest existing token), `var(--muted)` (axis), `var(--foreground)`
(textPrimary), `var(--muted)` (textMuted) — i.e. point at the same CSS
custom properties the rest of the app already themes with, rather than
maintaining a second light/dark hex table.

Two chart components hardcode a hover-cursor fill,
`rgba(255,255,255,0.04)`:
- `components/income/IncomeVsSpendingChart.tsx:106`
- `components/income/IncomeBySourceChart.tsx:68`

Add a new token, `--chart-hover`, dark `rgba(255,255,255,.04)` / light
`rgba(0,0,0,.04)`, and reference it (`var(--chart-hover)`) from both
components instead of the literal.

`CONCEPT` and `CATEGORICAL` (the 8-hue sub-category palette) are unchanged
— category/sub-category colors don't vary by theme.

## Toggle UI

- New small icon-button component, sun/moon glyph reflecting the *current*
  theme (matches the "simple geometric glyph, single stroke weight" icon
  rule in the design system).
- Placed in the dashboard header row (`app/page.tsx`), in the `flex
  items-center gap-2` group alongside `AddAccountButton` and
  `DateRangePicker`.
- Calls `toggleTheme()` from the `ThemeProvider` context on click.
- No toggle on `/login` — that screen inherits whatever theme is already
  persisted (via the blocking script) but has no control to change it.

## Explicitly out of scope

- `prefers-color-scheme` auto-detection.
- Dynamic `viewport.themeColor` (PWA status-bar color) — stays statically
  dark (`#171614`) in `app/layout.tsx` for now; making it track the theme
  would need a client-side effect updating the `<meta name="theme-color">`
  tag, which is a separate, small follow-up if wanted later.
- A dedicated settings/profile screen — the toggle lives directly in the
  existing dashboard header.

## Testing / Verification

- `npm run dev`, toggle light/dark from the header button on each of the
  five report tabs (Income/Spending/Cash Flow/Savings/Goals) — surfaces,
  text, borders, and chart tooltips/axes should all flip; category colors
  (green/red/blue/yellow/magenta) should stay identical in both themes.
- Reload the page after toggling to light — should load light with no
  flash of dark (verifies the blocking script).
- Log out and check `/login` in both persisted themes — should match
  without a toggle control present.
