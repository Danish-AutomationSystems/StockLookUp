# Configurable Column Mapping Verification Checkpoint

**Date:** 2026-09-01  
**Source branch:** `worktree-stocklooker-build`  
**Feature head at checkpoint:** `9236ed3`

## Automated verification

- `npm test` — PASS: 15 test files, 93 tests.
- `npm run build` — PASS: Next.js 16.3.4 production build, TypeScript, and static generation completed.
- `npm audit --omit=dev` — PASS: 0 vulnerabilities.
- The Vitest run continues to emit the existing non-fatal Vite `configLoader: 'native'` warning.

## Implemented behavior

- Admin has one required search-column dropdown.
- Admin has one or more ordered displayed-column dropdown rows.
- Changing search column removes all matching displayed rows automatically.
- Display rows cannot duplicate or equal the search column, and the last row cannot be removed.
- Server validates new mappings and search rejects stale persisted mappings safely.
- Normal-user results contain only the saved displayed columns in saved order.
- Raw upstream error objects/messages are not logged.

## Production status

The deployed custom domain is `https://stocklooker.automationsystems.info`. Unauthenticated redirect and domain/DNS checks previously passed. Authenticated Sheets-backed smoke tests remain pending because the production Google Workload Identity Federation audience mismatch requires an authorized Google Cloud operator to verify/correct the provider configuration. No guessed Google Cloud change was made.

## Rollback

The pre-feature source checkpoint remains tag `codex/baseline-stocklooker-source-94684f6`. Feature commits are independently revertible; generated files `next-env.d.ts` and `tsconfig.tsbuildinfo` are untracked and excluded.
