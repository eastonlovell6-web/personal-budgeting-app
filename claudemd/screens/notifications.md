# Screen: Notifications

## Purpose

Push reminders and pre-emptive overspend alerts before a category/goal is
blown, not after — named as a retention driver across the vault's product
research. Vault vision doc's #7 priority (last, since it depends on Goals
and Budgeting Mode existing).

## Status

Planned — not started in code. Source: `Projects/budgeting-app.md`
("Notifications & Overspend Alerts").

## Key Files

None yet. Note: `public/sw.js` (service worker) exists today only for PWA
installability, not push messaging — adding Web Push would extend that
file, not replace it.

## Layout / UI Spec

Sketch only: in-app alert banners at minimum; native push notifications
require Web Push (VAPID keys, subscription storage) layered onto the
existing service worker.

## Data Contract

Not yet defined — depends on which screens (Goals, Budgeting Mode Toggle)
it alerts against, since both are also unbuilt.

## Fintech UX Principles Applied

**Empowerment** — alerts should be pre-emptive and framed as a heads-up,
not a scold, consistent with the "20% more on dining" framing example in
`claudemd/best-practices.md`.

## Open Questions / Risks

This screen depends on Goals and Budgeting Mode Toggle existing first —
nothing to alert against otherwise. Sequence it last among the planned
screens, matching its #7 priority in the vault doc.

## How to Verify

N/A until built.
