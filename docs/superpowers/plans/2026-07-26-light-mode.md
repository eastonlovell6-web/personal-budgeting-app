# Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manually-toggled light mode to Money Moves, backed by a React context + `data-theme` attribute + localStorage, using the light-mode color values already documented in `claudemd/design-system.md`.

**Architecture:** A blocking inline script in `app/layout.tsx` sets `data-theme` on `<html>` before first paint (no flash). `app/globals.css` gets `[data-theme="dark"]`/`[data-theme="light"]` token blocks instead of a single `:root` block. A `ThemeProvider` React context (`components/ThemeProvider.tsx`) exposes `theme`/`toggleTheme`, kept in sync with the DOM attribute and localStorage. A header icon button (`components/ThemeToggle.tsx`) is the only UI control. Chart code that currently hardcodes dark hex values switches to referencing the same CSS custom properties everything else themes with.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind v4 (CSS custom properties in `app/globals.css`), Vitest for unit tests, Recharts for charts.

## Global Constraints

- Money formatting via `lib/format.ts` only — not touched by this plan, noted for completeness.
- Dark theme was previously an app-wide constraint (`CLAUDE.md`, `claudemd/design-system.md`) — this plan is the "separate decision" that lifts it; both docs must be updated to reflect that (Task 6).
- Category colors (`--income`, `--spending`, `--cashflow`, `--savings`, `--goals`) and `--accent`/`--ink` are identical in both themes — never introduce a light-mode variant of these.
- Manual toggle only — no `prefers-color-scheme` auto-detection (per spec).
- No new settings/profile screen — toggle lives in the existing dashboard header.

---

### Task 1: Theme storage helpers

**Files:**
- Create: `lib/theme.ts`
- Test: `tests/theme.test.ts`

**Interfaces:**
- Produces: `Theme` type (`"dark" | "light"`), `THEME_STORAGE_KEY: string`, `readStoredTheme(raw: string | null): Theme`, `otherTheme(theme: Theme): Theme` — all from `lib/theme.ts`, consumed by Task 4.

- [ ] **Step 1: Write the failing test**

```ts
// tests/theme.test.ts
import { describe, expect, it } from "vitest";
import { otherTheme, readStoredTheme } from "@/lib/theme";

describe("readStoredTheme", () => {
  it("defaults to dark when nothing is stored", () => {
    expect(readStoredTheme(null)).toBe("dark");
  });

  it("returns light when light is stored", () => {
    expect(readStoredTheme("light")).toBe("light");
  });

  it("returns dark when dark is stored", () => {
    expect(readStoredTheme("dark")).toBe("dark");
  });

  it("defaults to dark for unrecognized stored values", () => {
    expect(readStoredTheme("sepia")).toBe("dark");
  });
});

describe("otherTheme", () => {
  it("flips dark to light", () => {
    expect(otherTheme("dark")).toBe("light");
  });

  it("flips light to dark", () => {
    expect(otherTheme("light")).toBe("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/theme.test.ts`
Expected: FAIL — `Cannot find module '@/lib/theme'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/theme.ts
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "theme";

export function readStoredTheme(raw: string | null): Theme {
  return raw === "light" ? "light" : "dark";
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/theme.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts tests/theme.test.ts
git commit -m "feat: add theme storage helpers for light mode"
```

---

### Task 2: Dark/light color tokens in globals.css

**Files:**
- Modify: `app/globals.css:1-58`

**Interfaces:**
- Produces: `[data-theme="dark"]` / `[data-theme="light"]` CSS blocks defining `--background`, `--surface`, `--surface-2`, `--border`, `--foreground`, `--muted`, `--tertiary`, `--control`, `--accent`, `--ink`, `--income`, `--spending`, `--cashflow`, `--savings`, `--goals`, `--positive`, `--negative`, `--chart-hover`. Consumed by Task 3 (chart colors) and every existing Tailwind class already bound to these tokens via the `@theme inline` block (unchanged).

- [ ] **Step 1: Replace the `:root` color block with theme-keyed blocks**

Replace lines 1–30 of `app/globals.css` (the `@import` through the closing `}` of the current `:root` block):

```css
@import "tailwindcss";

/* ---- Money Moves design system tokens ---- */
/* See claudemd/design-system.md — this is the source of truth these
   variables are meant to track. Dark is the default theme; light mode
   values below match the hex table in that doc. `data-theme` is set on
   <html> by the blocking script in app/layout.tsx before first paint. */
[data-theme="dark"] {
  --background: #171614;
  --surface: #211f1b;
  --surface-2: #1f1e1b;
  --border: rgba(255, 255, 255, 0.08);
  --foreground: #f6f4ef;   /* Paper White */
  --muted: #a9a69e;        /* text secondary, dark mode */
  --tertiary: #8a8779;
  --control: #2b2a26;      /* secondary button / progress track / ring remainder */
  --accent: #ff6a33;       /* brand orange — universal, never per-screen */
  --ink: #1c1b18;          /* Ink Black — dark text on the orange accent fill */
  --chart-hover: rgba(255, 255, 255, 0.04);

  /* Fixed 1:1 concept colors — never reassigned or mixed across concepts,
     identical in both themes */
  --income: #2fa968;
  --spending: #eb4b4b;
  --cashflow: #17abda;
  --savings: #ffc53d;
  --goals: #cc3dc4;

  /* positive/negative are the income/spending colors under their old names,
     kept for the sign-based deltas that already used them */
  --positive: var(--income);
  --negative: var(--spending);
}

[data-theme="light"] {
  --background: #edebe5;
  --surface: #ffffff;
  --surface-2: #ffffff;
  --border: rgba(0, 0, 0, 0.08);
  --foreground: #1c1b18;   /* Ink Black */
  --muted: #5b584f;        /* text secondary, light mode */
  --tertiary: #8a8779;
  --control: #e5e2db;
  --accent: #ff6a33;
  --ink: #1c1b18;
  --chart-hover: rgba(0, 0, 0, 0.04);

  --income: #2fa968;
  --spending: #eb4b4b;
  --cashflow: #17abda;
  --savings: #ffc53d;
  --goals: #cc3dc4;

  --positive: var(--income);
  --negative: var(--spending);
}
```

- [ ] **Step 2: Add `--chart-hover` to the `@theme inline` mapping and set a static default `data-theme` fallback**

In the same file, find the `@theme inline { ... }` block (originally lines 32–58) and add one line inside it, next to the other `--color-*` entries:

```css
  --color-goals: var(--goals);
```
becomes:
```css
  --color-goals: var(--goals);
  --color-chart-hover: var(--chart-hover);
```

- [ ] **Step 3: Run the build to confirm the CSS is valid**

Run: `npm run build`
Expected: build succeeds (no CSS parse errors). Visual confirmation of the light block happens in Task 6 once the toggle exists.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: add data-theme-keyed light/dark color tokens"
```

---

### Task 3: Route chart colors through the same CSS tokens

**Files:**
- Modify: `lib/palette.ts:30-38`
- Modify: `components/income/IncomeVsSpendingChart.tsx:106`
- Modify: `components/income/IncomeBySourceChart.tsx:68`

**Interfaces:**
- Consumes: `--surface`, `--border`, `--muted`, `--foreground`, `--chart-hover` custom properties from Task 2.
- Produces: `CHART.surface/grid/axis/textPrimary/textMuted` now hold `var(...)` strings instead of literal hex, for any future chart code to reuse.

- [ ] **Step 1: Point `CHART` at CSS custom properties**

In `lib/palette.ts`, replace:

```ts
export const CHART = {
  surface: "#211f1b",
  grid: "#2b2a26",
  axis: "#3a3833",
  textPrimary: "#f6f4ef",
  textMuted: "#a9a69e",
  positive: CONCEPT.income,
  negative: CONCEPT.spending,
} as const;
```

with:

```ts
// Theme-aware chart colors — these reference the same CSS custom
// properties app/globals.css themes via [data-theme], so Recharts styling
// (tooltip background, axis text, grid lines) follows light/dark
// automatically instead of needing its own hex table.
export const CHART = {
  surface: "var(--surface)",
  grid: "var(--border)",
  axis: "var(--muted)",
  textPrimary: "var(--foreground)",
  textMuted: "var(--muted)",
  positive: CONCEPT.income,
  negative: CONCEPT.spending,
} as const;
```

- [ ] **Step 2: Replace the hardcoded hover-cursor fill in both chart components**

In `components/income/IncomeVsSpendingChart.tsx:106`, replace:

```tsx
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
```

with:

```tsx
              cursor={{ fill: "var(--chart-hover)" }}
```

In `components/income/IncomeBySourceChart.tsx:68`, replace:

```tsx
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
```

with:

```tsx
              cursor={{ fill: "var(--chart-hover)" }}
```

- [ ] **Step 3: Run the build and existing test suite**

Run: `npm run build && npm test`
Expected: build succeeds; existing tests (`aggregations`, `categories`, `crypto`, `theme`) still pass — none of them assert on `CHART` values, so no test changes are needed here.

- [ ] **Step 4: Commit**

```bash
git add lib/palette.ts components/income/IncomeVsSpendingChart.tsx components/income/IncomeBySourceChart.tsx
git commit -m "feat: theme chart colors via CSS custom properties"
```

---

### Task 4: ThemeProvider + blocking init script

**Files:**
- Create: `components/ThemeProvider.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `Theme`, `THEME_STORAGE_KEY`, `otherTheme` from `lib/theme.ts` (Task 1).
- Produces: `ThemeProvider` (wraps `children`), `useTheme(): { theme: Theme; toggleTheme: () => void }` — both exported from `components/ThemeProvider.tsx`, consumed by Task 5.

- [ ] **Step 1: Create the provider**

```tsx
// components/ThemeProvider.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { THEME_STORAGE_KEY, otherTheme, type Theme } from "@/lib/theme";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function currentDomTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(currentDomTheme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = otherTheme(prev);
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem(THEME_STORAGE_KEY, next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
```

- [ ] **Step 2: Wire the blocking script and provider into the root layout**

In `app/layout.tsx`, add the import:

```ts
import { ThemeProvider } from "@/components/ThemeProvider";
```

Add this constant above the `RootLayout` function (after the existing `viewport` export):

```ts
// Runs before hydration so the correct theme is set before first paint.
// Duplicates the default-to-dark logic in lib/theme.ts's readStoredTheme —
// inline scripts can't import modules, so this stays a plain string.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;
```

Replace the `RootLayout` return block:

```tsx
  return (
    <html
      lang="en"
      className={`${sora.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
```

with:

```tsx
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${sora.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <RegisterSW />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
```

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add components/ThemeProvider.tsx app/layout.tsx
git commit -m "feat: add ThemeProvider and no-flash theme init script"
```

---

### Task 5: Theme toggle button in the dashboard header

**Files:**
- Create: `components/ThemeToggle.tsx`
- Modify: `app/page.tsx:108-116`

**Interfaces:**
- Consumes: `useTheme()` from `components/ThemeProvider.tsx` (Task 4).
- Produces: `ThemeToggle` component, rendered in the `Dashboard` header in `app/page.tsx`.

- [ ] **Step 1: Create the toggle button**

```tsx
// components/ThemeToggle.tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";

// Theme isn't known on the server (it depends on localStorage), so the
// first client render must match the server's markup exactly or React
// throws a hydration mismatch. Render a neutral placeholder until after
// mount, then swap in the real icon once we know the actual theme.
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { theme, toggleTheme } = useTheme();

  if (!mounted) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex h-9 w-9 items-center justify-center rounded-pill bg-control"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      className="inline-flex h-9 w-9 items-center justify-center rounded-pill bg-control text-foreground"
    >
      {theme === "dark" ? (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </svg>
      ) : (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Add it to the dashboard header**

In `app/page.tsx`, add the import:

```ts
import { ThemeToggle } from "@/components/ThemeToggle";
```

Replace the header block:

```tsx
      <header className="flex items-center justify-between gap-2 pt-2">
        <h1 className="text-screen-title">Reports</h1>
        <div className="flex items-center gap-2">
          {!empty && <AddAccountButton onLinked={load} />}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>
```

with:

```tsx
      <header className="flex items-center justify-between gap-2 pt-2">
        <h1 className="text-screen-title">Reports</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!empty && <AddAccountButton onLinked={load} />}
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </header>
```

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add components/ThemeToggle.tsx app/page.tsx
git commit -m "feat: add light/dark toggle to dashboard header"
```

---

### Task 6: Update docs and verify end-to-end

**Files:**
- Modify: `CLAUDE.md`
- Modify: `claudemd/design-system.md:39-42,129-131`

**Interfaces:**
- None — this task only updates documentation and performs manual verification; no code interfaces change.

- [ ] **Step 1: Update `CLAUDE.md`'s dark-only constraint**

Find this bullet under "Global Constraints":

```markdown
- **Dark theme only** — tokens in `app/globals.css`; don't hardcode colors,
  use the CSS variables / `lib/palette.ts`. Follow `claudemd/design-system.md`
  (the "Money Moves" system) for anything color/type/component-related — it's
  the source of truth this repo's tokens are meant to match.
```

Replace with:

```markdown
- **Dark and light theme, manual toggle** — tokens in `app/globals.css`,
  keyed by `[data-theme="dark"|"light"]`; don't hardcode colors, use the CSS
  variables / `lib/palette.ts`. Theme state lives in `components/ThemeProvider.tsx`
  (`useTheme()`); the toggle is in the dashboard header
  (`components/ThemeToggle.tsx`). No system-preference auto-detection —
  the user's choice is explicit and persisted (`localStorage`). Follow
  `claudemd/design-system.md` (the "Money Moves" system) for anything
  color/type/component-related — it's the source of truth this repo's
  tokens are meant to match.
```

- [ ] **Step 2: Update `claudemd/design-system.md`**

Find:

```markdown
**Dark mode is primary; light mode is supported** with the same accent/category colors,
inverted neutrals. This app is currently dark-only per its existing `CLAUDE.md` constraint —
light mode is documented here for completeness but not yet implemented; don't add it without
a separate decision to do so.
```

Replace with:

```markdown
**Dark mode is the default; light mode is supported** with the same accent/category colors,
inverted neutrals. Implemented via `[data-theme]`-keyed CSS custom properties in
`app/globals.css` and a manual toggle in the dashboard header — see
`docs/superpowers/specs/2026-07-26-light-mode-design.md` for the design.
```

Find, in the "Not yet done" list:

```markdown
- Light mode
```

Delete that line entirely.

- [ ] **Step 3: Manual verification in the browser**

Run: `npm run dev`

Then, in the browser:
1. Log in, land on the dashboard.
2. Click the new sun/moon button in the header — the whole app (background, cards, borders, text, nav) should flip between the dark and light palettes immediately.
3. Switch through all five tabs (Income, Spending, Cash Flow, Savings, Goals) in light mode — surfaces/text/borders should read correctly on each; the category hero colors (green/red/blue/yellow/magenta) should look identical to how they look in dark mode.
4. On the Income tab, open the Income-by-source or Income-vs-Spending chart tooltip by hovering a bar — tooltip background and hover-cursor fill should match the light theme (light tooltip background, subtle dark hover fill), not the old hardcoded dark styling.
5. Reload the page while in light mode — it should load light with no visible flash of dark before paint.
6. Log out (or open a private/incognito window pointed at the app) and load `/login` — it should render in whichever theme was last persisted, with no toggle control present.
7. Switch back to dark mode and confirm the same reload/no-flash behavior.

- [ ] **Step 4: Run the full test suite and build one more time**

Run: `npm run build && npm test`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md claudemd/design-system.md
git commit -m "docs: mark light mode as shipped"
```
