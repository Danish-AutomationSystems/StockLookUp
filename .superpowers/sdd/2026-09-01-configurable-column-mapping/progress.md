# SDD ledger — plan: docs/superpowers/plans/2026-09-01-configurable-column-mapping.md

Execution started after approved design and committed implementation plan.

Task 1: complete (commits 020d2c6..c9a4359, review clean)
Task 2: complete (commits c9a4359..b8eca99, review clean; report reconstructed after subagent credit error)
Task 3: fix round 1/5 (1 addressed, 0 open; commit 5565565)
Task 3: complete (commits b8eca99..5565565, review clean)
Task 4: complete (commits 5565565..9c90b1c, review clean)
Task 2: fix round 1/5 (1 build/type error open; `app/admin/page.tsx:183` implicit-any in `details.filter`)
Task 2: fix round 1/5 (1 addressed, 0 open; commit 9236ed3)
Task 2: complete (commits b8eca99..9236ed3, review clean)
Task 5: complete (commits 9c90b1c..2928191, automated verification passed; authenticated production smoke blocked by external WIF verification)
Documentation fix: updated the verification checkpoint to feature head `83ce760` and removed trailing whitespace from the metadata lines.

Production diagnostic deployment: `b7S8Z8J3HMUymNbDH2pTobRveWfM` (Ready; production alias `stocklooker-jw7zyrp9a-automation-systems.vercel.app`, custom domain verified reachable). Full tests passed 103/103 and production build passed. Added authenticated `/api/admin/config` stage isolation: `environment`, `token exchange`, `spreadsheet metadata`, `data headers`, `configuration read`. Awaiting one authenticated admin refresh to identify the failing boundary. Rollback baseline remains tag `codex/baseline-stocklooker-source-94684f6`.

Production root cause and fix: authenticated `/api/admin/config` reached `token exchange` and failed because the route-created Google external-account client relied only on `@vercel/oidc` ambient request context. The Vercel-issued OIDC JWT is available on the incoming `x-vercel-oidc-token` header, so GET now forwards that non-empty request token into the external-account subject-token supplier. Callers without that header retain the existing `getVercelOidcToken({ audience: 'https://vercel.com/automation-systems' })` fallback. No token values are logged. TDD verification: focused tests 26/26, full suite 108/108, `npx tsc --noEmit`, and `npm run build` passed before deployment.

Root-cause evidence: production OIDC exchange succeeds; Sheets metadata returns 403 USER_PROJECT_DENIED. Cloud Shell direct impersonation confirmed caller testing@automationsystems.org lacks serviceusage.services.use on project stocklooker; service account already has roles/serviceusage.serviceUsageConsumer.
