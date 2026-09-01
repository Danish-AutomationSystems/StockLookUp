# StockLooker production hardening and launch design

Date: 2026-09-01

## Goal

Take the recovered StockLooker implementation from a verified local build to a safe first production release. StockLooker must let authorized `automationsystems.org` users sign in with Google, search server-side Google Sheets data, and let the configured admin map the search and result columns. Sheet credentials and data must not be exposed to the browser.

## Starting point

The recovered implementation is on branch `worktree-stocklooker-build` at commit `94684f6`. Tasks 1–14 of the original implementation plan are present, the final review fixes are committed, and the current baseline passes 75 tests and a production build. Deployment Task 15 has not been completed. The source-only rollback point is recorded in `docs/superpowers/checkpoints/2026-09-01-pre-codex-handoff.md` and the tag `codex/baseline-stocklooker-source-94684f6`.

## Scope

### 1. Code hardening

- Preserve the server-only Google Sheets boundary and existing authentication behavior.
- Ensure the `_config` Sheet tab is hidden both when created and when an existing visible tab is encountered.
- Add or update focused tests before any behavior change; keep the full suite green.
- Review dependency audit findings and make the smallest compatible security update. Do not perform a major framework migration without evidence that it is required for the release.
- Make dependency installation reproducible and keep generated files out of source commits.

### 2. External integration verification

Verify, without printing secret values:

- Vercel project linkage and Preview/Production environment variable presence.
- Vercel OIDC federation enablement.
- Google OAuth authorized origins, callback URL, consent configuration, and domain restriction.
- GCP Workload Identity Federation audience/issuer conditions and service-account permission to read/write the target Sheet.
- Target spreadsheet structure, data headers, and application access.
- DNS configuration for `stocklooker.automationsystems.info`.

### 3. Deployment and smoke test

- Deploy from the reviewed branch using the linked Vercel project.
- Attach and verify the custom domain.
- Exercise login, domain rejection, admin authorization, config save, successful search, no-match search, error handling, and logout.
- Record the deployment URL, release commit, verification results, and rollback procedure without recording secrets.

## Testing strategy

- Follow red-green-refactor for each production-code behavior change.
- Use unit/API/UI tests for deterministic behavior and mocked external clients where network access is not appropriate.
- Run the complete test suite and production build after every hardening task.
- Use a real browser smoke test only after deployment and external configuration are ready.
- Treat OAuth, WIF, Sheets permission, and DNS verification as integration gates rather than claiming local tests prove them.

## Work decomposition

1. **Checkpoint and documentation:** preserve the source baseline and maintain the Superpowers ledger.
2. **Security hardening:** hide `_config`, add regression coverage, and resolve or document dependency audit findings.
3. **Release preparation:** clean the branch, verify configuration, and produce deployment notes.
4. **Production release:** deploy, attach DNS/domain, run smoke tests, and record evidence.

Each implementation task gets its own commit and review package. No task may overwrite the source baseline tag.

## Rollback

If implementation becomes unsafe, stop and restore from `codex/baseline-stocklooker-source-94684f6` in a separate worktree. If a production deployment fails, point Vercel back to the last known-good deployment or redeploy the baseline/reviewed commit; do not remove the baseline tag or destroy the recovery artifacts.

## Out of scope for this launch

Large product changes, new user-facing features, a full framework migration, billing, analytics, and broad observability infrastructure. These can be separate follow-up plans after the first release is stable.
