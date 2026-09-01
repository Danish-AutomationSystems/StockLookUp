# StockLooker UI redesign verification checkpoint

**Date:** 2026-09-01
**Source branch:** `worktree-stocklooker-build`
**Reviewed commit range:** `34987ca..7fc7aef` (`da14e4d`, `808ddb3`, `1984920`, `7fc7aef`)
**Scope:** Documentation and verification only. Existing production-hardening worktree changes were preserved and were not staged.

## Required commands

- `npm test` — PASS: 15 test files, 118 tests.
- `npm run build` — PASS: Next.js 16.3.4 compiled, TypeScript completed, static pages generated, and optimization finalized.
- `npm audit --omit=dev` — PASS: `found 0 vulnerabilities`.

Vitest emitted the existing non-fatal Vite `configLoader: 'native'` warning. No credentials, tokens, or secret environment values were recorded.

## Browser and responsive QA

Browser control was available through the Codex in-app browser. The local server started at `http://localhost:3000`.

| Viewport | `/login` | `/` | `/admin` | Horizontal overflow |
|---|---|---|---|---|
| 375px portrait | Reachable | Redirected to `/login?error=Configuration` | Redirected to `/login?error=Configuration` | None observed |
| 768px | Reachable | Redirected to `/login?error=Configuration` | Redirected to `/login?error=Configuration` | None observed |
| 1024px | Reachable | Redirected to `/login?error=Configuration` | Redirected to `/login?error=Configuration` | None observed |
| 1440px | Reachable | Redirected to `/login?error=Configuration` | Redirected to `/login?error=Configuration` | None observed |
| 844x390 narrow landscape | Reachable | Redirected to `/login?error=Configuration` | Redirected to `/login?error=Configuration` | None observed |

The login error state rendered its alert correctly. Keyboard traversal reached the sign-in button with visible focus. Reduced-motion media handling was present and active in the browser check. Authenticated `/` and `/admin` visual/state checks could not be completed because local NextAuth configuration is unavailable; no credentials were entered and no authentication bypass was attempted.

Loading, success, empty, and disabled state coverage was verified through the existing component/page tests and code inspection, but not through authenticated browser interaction. No browser claim is made for those inaccessible authenticated flows.

## Unchanged production-flow checks

- Admin save payload remains `JSON.stringify({ searchColumn, resultColumns })` to `POST /api/admin/config`.
- Search remains `/api/search?q=${encodeURIComponent(query)}` and the result projection remains the configured displayed columns in saved order.
- Login remains `signIn('google', { callbackUrl: '/' })`.
- The admin navigation remains conditional on `session.user.isAdmin`.
- The required tests covering admin config routes, search routes, auth/sign-in behavior, and mapping/search projection passed as part of the 118-test suite.

## Deferred P2 items

- Run authenticated browser QA for `/` and `/admin` across the viewport matrix after local/Preview auth configuration is available.
- Exercise live Sheets-backed search, no-match behavior, admin save/reload persistence, and logout in the deployed environment with an authorized operator.

## Rollback

For source recovery, create a separate worktree from `codex/baseline-stocklooker-source-94684f6`; never delete the baseline tag. Use the last known-good deployment or redeploy a reviewed commit. This checkpoint adds no runtime or infrastructure changes.
