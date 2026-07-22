# Best Practices Reference

Distilled from research done 2026-07-22 (see
`docs/superpowers/specs/2026-07-22-claudemd-screen-docs-design.md`). Screen
docs point here instead of repeating this content.

## Writing/using these docs (CLAUDE.md authoring)

- Root `CLAUDE.md` stays short and universal — stack, constraints, commands,
  and the screen-doc index. Nothing screen-specific goes there.
- Each screen doc uses **progressive disclosure**: read it only when working
  on that screen, not preloaded every session.
- **Point, don't paste.** Reference source with `file:line`, not inlined
  code blocks — code changes; a stale inline copy misleads faster than a
  missing one.
- Don't put lint/style rules here — that's what `eslint.config.mjs` and
  `npm run lint` are for. Claude should infer conventions from the existing
  code, not a style guide.
- When a screen doc's file:line pointers drift after a refactor, fix the
  doc in the same commit as the refactor — don't let it go stale.

## Fintech UX principles (apply per-screen)

**Trust** — Users are taking a leap of faith with financial data. Show
security/permission context explicitly (e.g. the passcode gate, "your data
stays local"), never hide fees or what a Plaid connection can see, avoid
dark patterns (no pre-checked opt-ins, no disguised buttons).

**Clarity** — One primary number per screen (Income's total, Spending's
donut-center total, Cash Flow's stat row). Progressive disclosure for
secondary detail (Spending's "Show more" past the top 8 categories). Never
rely on color alone for positive/negative — pair with a label or icon,
since not everyone reads red/green the same way (Cash Flow's stat row
already does this via explicit labels, keep that pattern).

**Empowerment** — Frame behavioral insights positively, not as judgment.
"You spent 20% more on dining this month" beats "You're overspending on
dining." Applies most to the not-yet-built nudge/automation/notification
screens.

**Continuity** — Preserve state across the flows that already exist (tab +
date range selection while switching reports, session cookie across app
opens) and any new screen should do the same — don't reset user context on
navigation.

## Fintech data-integrity rule

Never hardcode a financial figure that changes over time (APY rates, Roth
IRA contribution limits/phase-outs) directly in app copy. Pull from a
source that can be updated, or refresh manually every tax year — called out
as an explicit risk in `Projects/budgeting-app.md` (Obsidian vault).
