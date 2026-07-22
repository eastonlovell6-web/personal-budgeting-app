# Screen: <Name>

## Purpose

<One paragraph: what this screen is for and who uses it.>

## Status

<Shipped | Planned> — <if shipped: which commit(s) built it>

## Key Files

- `path/to/file.tsx:LINE` — <what it does>

(Point at real files/lines. Don't inline code here — it goes stale.)

## Layout / UI Spec

<Structure, hierarchy, one primary value for this screen, states shown:
loading / empty / error.>

## Data Contract

<The API/report shape this screen consumes — name the type and point at
`lib/types.ts`, don't repeat the full shape here.>

## Fintech UX Principles Applied

<Which of Trust / Clarity / Empowerment / Continuity (see
`claudemd/best-practices.md`) matter most here, and how this screen
embodies them.>

## Open Questions / Risks

<Pulled from `Projects/budgeting-app.md` or `docs/superpowers/specs/` where
applicable. Leave "None currently open" if there aren't any yet.>

## How to Verify

<Manual check or `npm test` file specific to this screen. "N/A until
built" for planned screens.>
