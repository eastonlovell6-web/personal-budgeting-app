# Screen: Login

## Purpose

Passcode gate — the only entry point to the app when unauthenticated.
Protects financial data since the PWA may be reachable on the public
internet (single shared passcode, no per-user accounts).

## Status

Shipped — commit `ad32424` ("feat: passcode gate + HMAC session middleware").

## Key Files

- `app/login/page.tsx:6` — passcode entry form; single numeric input,
  posts to `/api/auth/login`, clears input and shows an error on failure.
- `app/api/auth/login/route.ts:4` — POST handler: `checkPasscode()` against
  `APP_PASSCODE`, creates an HMAC-signed session token, sets the
  `budget_session` cookie (httpOnly, sameSite lax, 30-day maxAge).
- `lib/auth.ts:41` — `createSessionToken`/`verifySessionToken`: HMAC-SHA256
  over Web Crypto (works in both Edge middleware and Node routes),
  constant-time signature comparison via `timingSafeEqual` (`lib/auth.ts:33`).
- `lib/auth.ts:63` — `checkPasscode()`: constant-time compare against
  `APP_PASSCODE`.
- `middleware.ts:7` — redirects unauthenticated page requests to `/login`;
  API requests get a 401 instead of a redirect (`middleware.ts:20`).

## Layout / UI Spec

Centered column, `max-w-xs`. Butterfly emoji + "Budget" title, one numeric
password input (autoFocus, `inputMode="numeric"`, letter-spaced), "Unlock"
button disabled while loading or empty. States:

- **Idle** — empty input, button disabled.
- **Loading** — button shows "…", input mid-POST.
- **Error** — "Incorrect passcode" in the negative color below the input,
  passcode field cleared for retry.

## Data Contract

`POST /api/auth/login` body `{ passcode: string }` → response `{ ok: boolean }`.
No shared type in `lib/types.ts` — this is intentionally the one endpoint
outside the report-shape system.

## Fintech UX Principles Applied

**Trust** is the whole point of this screen — a visible passcode gate is
the app's baseline security signal on a personal-finance PWA. **Clarity** —
single input, single action, no distractions.

## Open Questions / Risks

None currently open. Note (not a bug): `sessionSecret()` (`lib/auth.ts:7`)
falls back to `APP_PASSCODE` or a hardcoded dev string if `SESSION_SECRET`
isn't set — intentional dev convenience, set `SESSION_SECRET` explicitly in
any real deployment.

## How to Verify

`npm run dev` → hit `/` unauthenticated → redirected to `/login`. Enter a
wrong passcode → "Incorrect passcode" shown, input cleared. Enter the
correct `APP_PASSCODE` → redirected to `/`, dashboard renders.
