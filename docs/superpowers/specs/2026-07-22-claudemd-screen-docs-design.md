# CLAUDE.md Screen-by-Screen Documentation System — Design Spec

**Date:** 2026-07-22
**Status:** Approved
**Author:** Easton Lovell (with Claude)

## Summary

Set up a `CLAUDE.md` + `claudemd/` documentation system for this repo so that
Claude Code has high-quality, screen-scoped context when building or
modifying any screen of the budgeting app — both the 5 screens already
shipped in v1 and the 6 screens described in the broader product vision
([[Projects/budgeting-app]] in the Obsidian vault) that haven't been built
yet. The goal is consistently good UI output as buildout continues,
screen by screen, without bloating the context window on every session.

## Why this structure (research findings)

Two sources informed the design:

1. **Official Claude Code memory docs** (`code.claude.com/docs/en/memory`) and
   HumanLayer's "Writing a good CLAUDE.md": root `CLAUDE.md` is loaded in full
   on every session and should stay under ~200-300 lines of *universally
   applicable* content — stack, conventions, commands. Screen/topic-specific
   detail belongs in separate files referenced from the root file
   ("progressive disclosure"), which Claude reads on demand rather than
   holding in context at all times. Prefer `file:line` pointers over inlined
   code snippets so docs don't go stale. Don't put lint/style rules in
   CLAUDE.md — that's a linter's job.
2. **Fintech/budgeting UX research** (Eleken, FuseLab, others, 2026): four
   recurring principles for financial-app UI — **Trust** (visible security
   cues, transparent fees/permissions, no dark patterns), **Clarity** (one
   primary number per screen, progressive disclosure of secondary detail,
   color-independent cues since red/green isn't universally legible),
   **Empowerment** (behavioral insights framed positively, not as
   judgment), **Continuity** (consistent state across sessions/devices,
   resume-where-you-left-off). These map onto the existing Monarch-style
   dark theme and should be named explicitly in each screen doc so new
   screens are held to the same bar.

## Current State (as of this spec)

The app is further along than the vault's product-vision doc suggests. v1
(Login, dashboard shell, Income, Spending, Cash Flow, Plaid link flow, PWA
install) is fully built and committed — see `docs/superpowers/plans/` and
`docs/superpowers/specs/2026-07-19-personal-budgeting-app-design.md`. That
spec explicitly scoped budgets, goal tracking, and investing features **out**
of v1. The vault's vision doc (`Projects/budgeting-app.md`) describes a
larger automation-first product (cash-placement nudge, automated savings
rules, goal buckets, Roth IRA education, budgeting-mode toggle,
notifications) that has not been started in code yet. This spec treats that
vision doc as the roadmap for the screens still to be built.

## Folder Structure

```
CLAUDE.md                          # NEW — auto-loaded every session
claudemd/
  best-practices.md                # condensed research: CLAUDE.md authoring + fintech UX principles
  _template.md                     # copy when adding a new screen doc
  screens/
    login.md                       # existing — passcode gate
    dashboard-shell.md             # existing — tabs, date range, empty state, app/page.tsx
    income.md                      # existing
    spending.md                    # existing
    cashflow.md                    # existing
    cash-placement-nudge.md        # planned — vision doc priority #1
    automated-savings-rules.md     # planned — vision doc priority #2 (incl. irregular-income open question)
    goals.md                       # planned — vision doc priority #3
    investing-education.md         # planned — vision doc priority #5 (Roth IRA on-ramp)
    budgeting-mode-toggle.md       # planned — vision doc priority #6 (optional zero-based/envelope mode)
    notifications.md               # planned — vision doc priority #7
```

(Vision doc priority #4, "Expense Tracking & Categorization," is already
satisfied by the shipped Income/Spending/Cash Flow screens — no separate
planned doc needed for it.)

## Root `CLAUDE.md` Contents

Short and universal only:

- One-paragraph project description (single-user Monarch-style budgeting
  PWA, Plaid-backed).
- Stack: Next.js 16 (App Router), TypeScript, Prisma (SQLite dev / Postgres
  prod), Plaid, Tailwind v4, Recharts + d3-sankey, Vitest.
- Global constraints already established in `docs/superpowers/plans/…`:
  single-user only, v1 reports are read-only, Plaid secrets backend-only,
  access tokens encrypted at rest, dark theme, money formatted `$1,234.56`.
- Commands: `npm run dev`, `npm run build`, `npm test`, `npm run seed`,
  `npx prisma migrate dev`.
- A pointer table into `claudemd/screens/*.md`: screen name, one-line
  description, status (shipped/planned), file path — with an instruction to
  read the relevant screen file before making UI changes to that screen.
- Pointer to `claudemd/best-practices.md` for UX/design-principle detail.

## Per-Screen File Template (`claudemd/_template.md`)

Each screen file (~60-120 lines) covers:

1. **Purpose** — what this screen is for, one paragraph.
2. **Status** — shipped or planned; if shipped, the commit(s) that built it.
3. **Key files** — `file:line` pointers into the real source (components,
   API routes, lib functions), not inlined code.
4. **Layout / UI spec** — structure, hierarchy, what's the one primary value
   per screen, states shown (loading/empty/error).
5. **Data contract** — the API/report shape the screen consumes (types,
   not full schemas — point at `lib/types.ts`).
6. **Fintech UX principles applied** — explicitly called out: which of
   Trust/Clarity/Empowerment/Continuity matter most for this screen and how.
7. **Open questions / risks** — pulled from `Projects/budgeting-app.md` and
   `docs/superpowers/specs/…` where applicable (e.g., irregular-income
   handling is unresolved for `automated-savings-rules.md`).
8. **How to verify** — manual check or test command specific to this screen.

Planned-screen docs use the same sections but with **Status: planned** and
a design sketch instead of built file pointers; they become the seed for a
future implementation plan (via `writing-plans`) when that screen gets built.

## `claudemd/best-practices.md` Contents

Condensed reference other screen docs can point to instead of repeating:

- CLAUDE.md authoring rules: keep root file short/universal, progressive
  disclosure for the rest, `file:line` over inlined snippets, no lint rules
  in CLAUDE.md.
- Fintech UX principles: Trust, Clarity, Empowerment, Continuity — each with
  a 2-3 line definition and one concrete example from the research (e.g.
  Chime's single-balance focus for Clarity; CRED's on-time-payment points
  loop for Empowerment).
- A short "don't hardcode financial figures" callout consistent with the
  vault vision doc's existing risk note about Roth IRA limits/APY rates.

## Success Criteria

- `CLAUDE.md` exists at repo root, loads under `/context`, stays under
  ~150 lines.
- All 5 shipped screens have accurate `claudemd/screens/*.md` files
  reflecting the actual current implementation (verified against real
  file paths/line numbers, not guessed).
- All 6 planned screens have doc stubs following the same template,
  seeded from the vault vision doc's feature descriptions.
- `claudemd/best-practices.md` and `claudemd/_template.md` exist.
- Nothing in `claudemd/` duplicates `docs/superpowers/plans/` or `specs/`
  wholesale — screen docs point to those documents rather than restating
  them where overlap exists.

## Non-Goals

- No changes to actual app code/behavior — this is a documentation-only
  change.
- Not replacing `docs/superpowers/plans/` or `specs/` — those remain the
  system of record for what was decided and built; `claudemd/` is a
  navigation/context layer on top, screen-scoped instead of project-scoped.
- Not adopting `.claude/rules/` path-scoped auto-loading in this pass —
  noted as a possible future enhancement, not part of this design.
