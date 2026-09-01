# StockLooker agent context and recovery handoff

**Updated:** 2026-09-01  
**Repository:** StockLooker  
**Purpose:** Give any future agent the shortest reliable path to understanding what was done, why, how it was verified, and what remains.

## Main product goal

StockLooker is an authenticated internal Google Sheet lookup tool. An administrator selects exactly one searchable sheet column and one or more displayed result columns. Normal users search by the configured column and receive only the configured displayed fields, in saved order; the search column is not repeated in the result.

## Work completed

### Production hardening and data path

- Kept Google Sheets access server-side; browser code never receives credentials or direct Sheet access.
- Added request-scoped Vercel OIDC token handling in `lib/googleAuth.ts` with the Sheets scope required by the runtime.
- Updated admin config and search routes to use the request-scoped OIDC path and safe stage logging.
- Centralized/strengthened admin allowlist handling, including comma-separated admin emails.
- Preserved the second admin allowlist entry for `himanshuneb@automationsystems.org` in Vercel configuration; secret values are never stored here.
- Added safe upstream-error logging that avoids tokens, JWTs, authorization headers, and raw credential payloads.
- Added and preserved validation for unknown, duplicate, empty, and search/display-overlap columns.

### UI redesign

- Added a clean enterprise light visual system with semantic colors, surfaces, focus states, responsive spacing, reduced-motion handling, and 44px interaction targets.
- Polished login, search, result display, and admin mapping screens.
- Added responsive stacking for narrow screens and guarded against horizontal overflow.
- Added accessible labels/status semantics, retry feedback, loading states, error states, and success states.
- Fixed the admin stale-success race: edits clear old `Saved.` feedback, and delayed save responses cannot claim success for a newer mapping version.
- Fixed contrast tokens and header/back-link target sizing after final review.
- No runtime API, auth, Google Sheets, environment-variable, or mapping-rule contract was changed by the UI work.

## Important commits

- `3564e2e` — UI design specification
- `1d7c1ff` — UI implementation plan
- `da14e4d` — visual foundation
- `808ddb3` — login button target correction
- `1984920` — login/search UI
- `7fc7aef` — admin UI
- `329c86c` — UI verification documentation
- `253be51` — final contrast, link-target, and stale-save fixes

The earlier production-hardening edits were intentionally preserved and merged with the UI work. The source rollback tag remains `codex/baseline-stocklooker-source-94684f6`.

## Problems encountered and concrete handling

1. **Admin configuration initially returned HTTP 503.** Root cause was the server-side Google authentication/WIF/Sheets access path, not the dropdown UI. The route was instrumented with safe stage logging and the auth client was corrected without exposing secrets.
2. **Google API tests in Cloud Shell showed quota/scope errors.** The operator verified the Sheets API and quota header path, then the runtime was corrected to request the required Sheets scope through Vercel OIDC. No billing account, paid API, or new infrastructure was introduced.
3. **Vercel deployment was blocked by a commit email mismatch.** The deployment identity and Git account issue was separated from the application code; no unsafe account/email workaround was required.
4. **The first TDD shell test passed immediately.** The test was refined to assert the newly introduced `app-shell` contract so the red phase proved a real missing behavior.
5. **Final review found contrast below threshold, links below 44px, and stale `Saved.` feedback.** These were fixed with regression coverage, measured contrast values, shared link-target styling, and mapping-version guards; the scoped re-review marked all three addressed.
6. **Authenticated browser QA was not available in the local environment.** `/login` was reachable, while `/` and `/admin` redirected because local auth configuration was unavailable. This is documented as a limitation; no agent should claim those authenticated viewport checks passed without rerunning them.

## Verification evidence

Fresh verification on the final worktree:

- `npm test` — 122 tests passed.
- `npm run build` — production build passed.
- `npm audit --omit=dev` — 0 vulnerabilities.
- `git diff --check` — clean.
- Final scoped code review — all prior Important findings addressed; no new Important/Critical finding.

## Known follow-ups

- Run authenticated browser QA against the deployed or correctly configured local app for `/login`, `/`, and `/admin` at 375px, 768px, 1024px, 1440px, and narrow landscape. Check keyboard navigation, focus, loading/error/success states, reduced motion, and horizontal overflow.
- Re-run production smoke tests after deployment: company login, outside-domain denial, normal search, no-match search, admin load/save, result-column projection, and logout.
- Do not print or commit secret environment values, OAuth credentials, OIDC tokens, service-account keys, or raw provider payloads.
- Do not add paid infrastructure, upgraded quotas, service-account keys, or new managed resources.

## Recovery instructions

- Inspect `git log --oneline` and this file before making changes.
- Keep the rollback tag `codex/baseline-stocklooker-source-94684f6` intact.
- The UI implementation is independently represented by the commits listed above.
- Generated local files such as `next-env.d.ts` and `tsconfig.tsbuildinfo` are not feature source and should not be committed.
- If a future agent needs to reverse only the UI, revert the UI commits in reverse order; do not reset the branch or discard unrelated production-hardening work.
