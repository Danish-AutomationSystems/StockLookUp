# Task 4 Report

## Changed Files

- `lib/__tests__/searchLogic.test.ts`
- `app/api/search/__tests__/route.test.ts`
- `app/api/search/route.ts`
- `lib/__tests__/sheets.test.ts`
- `docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md`

## What Changed

- Added projection regression coverage proving `findMatchingRow` returns only configured `resultColumns` in persisted order and never implicitly adds the `searchColumn`.
- Strengthened the search route tests to assert the same ordered projection at the API boundary and added a stale persisted-config case.
- Added the minimal route guard to revalidate the saved config against live headers before projection and return a safe `503` configuration error when the saved mapping is stale.
- Added one Sheets persistence regression asserting the `_config` sheet still stores `resultColumns` as a JSON cell while preserving order.
- Expanded the production runbook with the admin mapping workflow, automatic display-column removal rule, deployment verification steps, rollback tag check, and operator-owned WIF verification checklist without recording secrets.

## TDD Notes

- RED command: `npm test -- lib/__tests__/searchLogic.test.ts app/api/search/__tests__/route.test.ts`
  - The new ordered-projection assertions passed immediately on commit `5565565`, confirming the existing projection loop already preserved `resultColumns` order and excluded `searchColumn`.
  - The new stale-config route test failed as intended because the route returned `200` instead of the expected safe `503` configuration error.
- GREEN command: `npm test -- lib/__tests__/searchLogic.test.ts app/api/search/__tests__/route.test.ts`
  - 2 test files passed, 13 tests passed.
- Final scoped verification: `npm test -- lib/__tests__/searchLogic.test.ts app/api/search/__tests__/route.test.ts lib/__tests__/sheets.test.ts`
  - 3 test files passed, 30 tests passed.

## Self-Review

- Kept the production change limited to `app/api/search/route.ts`; `lib/searchLogic.ts` stayed unchanged because its projection behavior was already correct.
- Reused the existing shared `validateConfig(headers, config)` invariant check instead of introducing a second search-specific validation path.
- Verified the runbook names the exact canonical audience resource shape from `lib/googleAuth.ts` while still avoiding live secret or operator-only values.

## Concerns

- Vitest still emits the existing Vite `configLoader: 'native'` warning during test runs; the scoped suites pass despite it.
- `next-env.d.ts` and `tsconfig.tsbuildinfo` remain untracked generated worktree artifacts and were intentionally left out of the task commit.
