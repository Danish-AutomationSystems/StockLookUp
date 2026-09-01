# Configurable Column Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace checkbox-based admin mapping with validated search/display dropdowns, automatically remove the selected search column from display rows, and ensure normal users receive only the saved display columns.

**Architecture:** Keep `SheetConfig` as `{ searchColumn, resultColumns }`, centralize all invariants in `lib/configValidation.ts`, and keep the API as the server-side authority. The admin client manages repeatable display-row state and filters options, while the search path projects only validated persisted columns. Add a small safe-logging utility so upstream authentication errors cannot be serialized into logs.

**Tech Stack:** Next.js 16.3.4, React 18, TypeScript 5.9, Vitest 4, Testing Library, NextAuth, Google Sheets API.

## Global Constraints

- The search column is exactly one required dropdown and remains separate from normal-user result display.
- There is always at least one displayed-column row; the final row cannot be removed.
- Selecting a new search column automatically removes every displayed row with that value.
- Displayed columns must be known sheet headers, unique, and different from the search column.
- The server must revalidate every submitted configuration before persistence.
- Raw errors, response bodies, credentials, subject tokens, JWTs, authorization headers, and STS request details must never be logged.
- Do not change Google Cloud WIF settings by guesswork; production sign-off requires authorized external verification.
- Do not include untracked generated artifacts `next-env.d.ts` or `tsconfig.tsbuildinfo` in feature commits.
- Every behavior change follows RED → verify failing → GREEN → verify passing, with focused tests before implementation.

---

### Task 1: Centralize complete configuration invariants

**Files:**
- Modify: `lib/configValidation.ts`
- Test: `lib/__tests__/configValidation.test.ts`
- Modify: `types/index.ts` only if a shared validation input type is needed

**Interfaces:**
- Consumes: `headers: string[]` and `SheetConfig`.
- Produces: `validateConfig(headers, config): { valid: boolean; errors: string[] }` with deterministic errors for empty/unknown search columns, empty/unknown result columns, duplicate result columns, and search/display overlap.

- [ ] **Step 1: Write failing tests** for duplicate display columns and a display column equal to the search column. Assert invalid results and exact error strings such as `Result column "Name" is duplicated` and `Result column "SKU" cannot be the search column`.
- [ ] **Step 2: Run focused tests to verify RED.**

Run: `npm test -- lib/__tests__/configValidation.test.ts`

Expected: the new tests fail because the current validator accepts duplicates and overlap.

- [ ] **Step 3: Implement minimal validation.** Preserve existing checks, track seen result columns with a `Set`, and add the overlap/duplicate errors without changing valid configurations.
- [ ] **Step 4: Run focused tests to verify GREEN.**

Run: `npm test -- lib/__tests__/configValidation.test.ts`

Expected: all validation tests pass.

- [ ] **Step 5: Commit.**

```text
git add lib/configValidation.ts lib/__tests__/configValidation.test.ts types/index.ts
git commit -m "feat: enforce column mapping invariants"
```

### Task 2: Replace admin checkbox mapping with repeatable dropdown rows

**Files:**
- Modify: `app/admin/page.tsx`
- Test: `app/admin/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: API response `{ headers: string[]; config: SheetConfig | null }` and the invariant rules from Task 1.
- Produces: accessible controls with `aria-label="Search column"`, `aria-label="Displayed column 1"` (and increasing row numbers), `Add display column`, per-row remove buttons, and a `Save` button posting `{ searchColumn, resultColumns }`.

- [ ] **Step 1: Rewrite the UI tests first.** Replace checkbox interactions with tests that:
  - load one search select and one displayed select;
  - add a displayed row and select a second column;
  - remove a non-final row while the final row remains;
  - change search from `SKU` to `Name` and assert the `Name` display row is removed automatically;
  - assert the search column is excluded from other display options and duplicate values cannot be selected;
  - assert the POST body preserves display order;
  - assert save is unavailable or rejected while a row is empty.
- [ ] **Step 2: Run the admin focused tests to verify RED.**

Run: `npm test -- app/admin/__tests__/page.test.tsx`

Expected: the new tests fail because the page currently renders checkboxes and has no repeatable-row behavior.

- [ ] **Step 3: Implement the minimum state and event behavior.** Use `resultColumns` as ordered row values, initialize at least `['']` when no valid saved list exists, and on search change filter all rows equal to the new search value; if no rows remain, restore one empty row. Add/remove rows with stable React keys, derive valid options per row by excluding the search column and values selected by other rows, and keep each row’s current value available.
- [ ] **Step 4: Implement client validation and save feedback.** Validate required search, nonempty rows, known headers, uniqueness, and non-overlap before POST. Render a specific validation message; only show `Saved.` after an OK response; render server details safely; preserve load/network errors.
- [ ] **Step 5: Run focused tests to verify GREEN.**

Run: `npm test -- app/admin/__tests__/page.test.tsx`

Expected: all admin interaction and save-payload tests pass.

- [ ] **Step 6: Commit.**

```text
git add app/admin/page.tsx app/admin/__tests__/page.test.tsx
git commit -m "feat: add configurable admin display columns"
```

### Task 3: Enforce API validation and safe upstream error logging

**Files:**
- Create: `lib/safeLogging.ts`
- Test: `lib/__tests__/safeLogging.test.ts`
- Modify: `app/api/admin/config/route.ts`
- Test: `app/api/admin/config/__tests__/route.test.ts`
- Modify: `app/api/search/route.ts`
- Test: `app/api/search/__tests__/route.test.ts`

**Interfaces:**
- Consumes: unknown caught values from route handlers.
- Produces: a safe logging function, for example `logServerFailure(operation: string, error: unknown): void`, that logs only a stable operation and non-sensitive classification/status fields, never the caught object or raw message.

- [ ] **Step 1: Write failing validator-route tests** for POST duplicate result columns and search/display overlap; assert HTTP 400, useful `details`, and `setConfig` not called.
- [ ] **Step 2: Write failing safe-logging tests.** Spy on `console.error`, pass an error/object containing `subject_token`, `authorization`, a JWT-like string, and a sensitive message, then assert the serialized calls do not contain those values.
- [ ] **Step 3: Run focused API/logging tests to verify RED.**

Run: `npm test -- app/api/admin/config/__tests__/route.test.ts app/api/search/__tests__/route.test.ts lib/__tests__/safeLogging.test.ts`

Expected: overlap/duplicate and logging assertions fail against the current implementation.

- [ ] **Step 4: Implement the minimal changes.** Reuse `validateConfig` in POST, call the safe logger in both route catch blocks, and preserve 400/401/403/404/503 response contracts. Do not include raw caught values in any logger call.
- [ ] **Step 5: Run focused tests to verify GREEN.**

Run: `npm test -- app/api/admin/config/__tests__/route.test.ts app/api/search/__tests__/route.test.ts lib/__tests__/safeLogging.test.ts`

Expected: all API and safe-logging tests pass.

- [ ] **Step 6: Commit.**

```text
git add lib/safeLogging.ts lib/__tests__/safeLogging.test.ts app/api/admin/config/route.ts app/api/admin/config/__tests__/route.test.ts app/api/search/route.ts app/api/search/__tests__/route.test.ts
git commit -m "fix: validate mappings and redact server errors"
```

### Task 4: Verify projection and persistence regression behavior

**Files:**
- Modify: `lib/__tests__/searchLogic.test.ts`
- Modify: `app/api/search/__tests__/route.test.ts`
- Modify: `lib/__tests__/sheets.test.ts` only for any regression assertion required by the unchanged `_config` format
- Modify: `docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md`

**Interfaces:**
- Consumes: persisted `SheetConfig` and live headers/rows.
- Produces: test evidence that `findMatchingRow` and `/api/search` return only ordered `resultColumns`, never implicitly adding `searchColumn`.

- [ ] **Step 1: Add regression tests** using `{ searchColumn: 'SKU', resultColumns: ['Price', 'Name'] }`; assert the response/result is exactly `{ Price: '9.99', Name: 'Widget' }` and does not contain `SKU`. If the implementation adds persisted-config validation in the route, also add a test for a stale invalid config and its safe configuration-error response.
- [ ] **Step 2: Run focused projection tests.** The ordered/exclusion regression is expected to pass against the current implementation; any newly added stale-config test must fail before its guard is implemented.

Run: `npm test -- lib/__tests__/searchLogic.test.ts app/api/search/__tests__/route.test.ts`

Expected: any new regression assertion fails before its implementation or guard is added.

- [ ] **Step 3: Implement only the needed projection guard.** Keep ordered iteration over `resultColumns`. If the stale-config test was added, validate persisted configuration against live headers and return a safe configuration error rather than exposing any other header; otherwise make no production change to already-correct projection behavior.
- [ ] **Step 4: Run focused projection tests to verify GREEN.**

Run: `npm test -- lib/__tests__/searchLogic.test.ts app/api/search/__tests__/route.test.ts`

Expected: all projection tests pass.

- [ ] **Step 5: Update the production runbook.** Document the admin workflow, automatic removal rule, rollback tag, deployment verification, and the exact external WIF checks: provider issuer, allowed audience/canonical provider resource, attribute condition, service-account impersonation binding, and Sheets access. State that Google Cloud changes require an authorized operator and must not be guessed.
- [ ] **Step 6: Commit.**

```text
git add lib/__tests__/searchLogic.test.ts app/api/search/__tests__/route.test.ts lib/__tests__/sheets.test.ts docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md
git commit -m "docs: verify column mapping production workflow"
```

### Task 5: Full verification and production handoff

**Files:**
- Modify: `.superpowers/sdd/2026-09-01-configurable-column-mapping/progress.md`
- Modify: `docs/superpowers/checkpoints/2026-09-01-configurable-column-mapping-verification.md`

**Interfaces:**
- Consumes: completed feature commits, test/build outputs, and authorized Google Cloud verification evidence.
- Produces: an auditable verification record and a production handoff decision.

- [ ] **Step 1: Run the complete test suite.**

Run: `npm test`

Expected: all tests pass, including the pre-existing regression suite.

- [ ] **Step 2: Run static/build/security verification.**

Run: `npm run build; npm audit --omit=dev`

Expected: production build succeeds and audit reports zero production vulnerabilities, or any result is recorded as a blocker rather than hidden.

- [ ] **Step 3: Verify the deployed authenticated flow.** After an authorized operator corrects/verifies WIF, test admin load, save, normal-user search, result-column exclusivity, and unauthorized API responses on `https://stocklooker.automationsystems.info`.
- [ ] **Step 4: Record evidence and update the SDD ledger.** Include commands, pass/fail outputs, deployment ID/URL, external WIF verification status, and rollback instructions. Do not record secrets, tokens, or raw provider error payloads.
- [ ] **Step 5: Commit verification documentation.**

```text
git add .superpowers/sdd/2026-09-01-configurable-column-mapping/progress.md docs/superpowers/checkpoints/2026-09-01-configurable-column-mapping-verification.md
git commit -m "docs: record column mapping verification"
```

- [ ] **Step 6: Request final whole-branch review and use the finishing-development-branch workflow only after verification is evidence-backed.**
