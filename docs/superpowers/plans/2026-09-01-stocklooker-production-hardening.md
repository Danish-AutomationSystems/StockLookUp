# StockLooker Production Hardening and Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the recovered StockLooker application, verify its external integrations, and release it safely to Vercel at `stocklooker.automationsystems.info`.

**Architecture:** Keep the existing Next.js App Router application and server-only Google Sheets access. Make the `_config` tab hidden at the Sheets boundary, migrate the auth gate from the deprecated middleware convention to Next.js 16’s proxy convention, keep Google authentication on Vercel through OIDC/WIF, and perform live deployment only after local tests, build, dependency, configuration, and review gates pass.

**Tech Stack:** Next.js 16.3.4, React 18.3.1, TypeScript 5.9.3, NextAuth 4.24.15, Google APIs, Google Workload Identity Federation, Vercel OIDC, Tailwind CSS, Vitest, Testing Library, Vercel CLI, Node.js 24.x.

## Global Constraints

- Preserve the source-only rollback tag `codex/baseline-stocklooker-source-94684f6`.
- Work only in `D:/AutomationSystems/StockLookUp/.claude/worktrees/stocklooker-build` on branch `worktree-stocklooker-build`; never implement on `main`.
- No Google service-account key files anywhere; Google authentication remains Workload Identity Federation only.
- Sheet ID, service-account details, OAuth secrets, and session secrets remain server-side environment variables and must never be sent to the client or written to reports/logs.
- Login remains restricted to `automationsystems.org` through the NextAuth `signIn` callback, not only Google’s `hd` hint.
- Admin access remains restricted to the configured `ADMIN_EMAIL` through both middleware and route checks.
- Every production-code behavior change requires a failing test before implementation and a passing focused test plus full-suite verification after implementation.
- The smallest audited-safe compatible Next.js release in the current registry is Next.js 16.3.4; keep React on 18.3.1 and do not migrate to React 19 in this task.
- The Next.js entry-point migration is limited to renaming `middleware.ts` to `proxy.ts`, preserving the existing `isAuthorized` behavior and matcher rules.
- TypeScript Node types must match the deployed Node 24 runtime, and jsdom must support the local Node 22.17.1 test runtime.
- No live deployment or external configuration mutation is delegated to a subagent; the controller performs those actions after reviewed code is ready.
- Each implementation task ends with a focused test/build check, a commit, and a review artifact; the SDD ledger is the recovery record.

---

## Current Starting Point

- Source baseline: commit `94684f638919ac395ed0a3fda1c78594ff3b01e7`, protected by tag `codex/baseline-stocklooker-source-94684f6`.
- Recovery documentation: `docs/superpowers/checkpoints/2026-09-01-pre-codex-handoff.md`.
- Existing implementation: Tasks 1–14 complete, final review fixes through commit `94684f6`.
- Existing verification: 75 tests pass and `next build` succeeds before this plan.
- Existing pre-worktree items: modified `.gitignore`, untracked generated `next-env.d.ts`, and untracked `tsconfig.tsbuildinfo`; do not treat these as implementation changes.
- Existing external state: Vercel project `stocklooker` exists; required Preview and Production variable names are present; no deployments exist; Vercel reports DNS for the custom hostname as misconfigured.

## Files and Responsibilities

- `lib/sheets.ts`: Google Sheets metadata/config boundary; will enforce `_config` hidden state.
- `lib/__tests__/sheets.test.ts`: regression coverage for creation and hiding of `_config`.
- `package.json`, `package-lock.json`: reproducible, audited dependency set.
- `.gitignore`: one canonical rule set for generated files and local secrets.
- `README.md`: concise local development and release entry point.
- `docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md`: durable deployment, verification, and rollback instructions with no secret values.
- `.superpowers/sdd/2026-09-01-stocklooker-production-hardening/`: task briefs, reports, review packages, and progress ledger.

---

### Task 1: Hide the `_config` Sheet tab

**Files:**
- Modify: `lib/sheets.ts:48-61`
- Modify: `lib/__tests__/sheets.test.ts:48-68`

**Interfaces:**
- Consumes: existing `sheets_v4.Sheets` client and `spreadsheetId`.
- Produces: `ensureConfigSheet(client, spreadsheetId): Promise<void>` that leaves an existing hidden `_config` tab unchanged, hides an existing visible `_config` tab, and creates a missing `_config` tab hidden from the start.

- [ ] **Step 1: Write the failing tests**

Add these cases to the existing `describe('ensureConfigSheet')` block. Preserve the existing missing-sheet and already-existing-sheet coverage, updating their mocked sheet properties to include a stable `sheetId` where the implementation needs it.

```ts
it('hides an existing visible _config sheet', async () => {
  const client = makeMockClient({
    get: vi.fn().mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 42, title: '_config', hidden: false } }] },
    }),
  });

  await ensureConfigSheet(client, 'sheet-id');

  expect(client.spreadsheets.batchUpdate).toHaveBeenCalledWith({
    spreadsheetId: 'sheet-id',
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: 42, hidden: true },
            fields: 'hidden',
          },
        },
      ],
    },
  });
});

it('does not update an already hidden _config sheet', async () => {
  const client = makeMockClient({
    get: vi.fn().mockResolvedValue({
      data: { sheets: [{ properties: { sheetId: 42, title: '_config', hidden: true } }] },
    }),
  });

  await ensureConfigSheet(client, 'sheet-id');

  expect(client.spreadsheets.batchUpdate).not.toHaveBeenCalled();
});
```

Update the existing creation assertion to require the hidden property:

```ts
expect(client.spreadsheets.batchUpdate).toHaveBeenCalledWith({
  spreadsheetId: 'sheet-id',
  requestBody: { requests: [{ addSheet: { properties: { title: '_config', hidden: true } } }] },
});
```

- [ ] **Step 2: Run the focused tests and verify they fail for the intended reason**

Run:

```bash
npm test -- lib/__tests__/sheets.test.ts
```

Expected: the new visible-sheet and hidden-creation assertions fail because the current implementation neither updates a visible tab nor sets `hidden: true` when creating one.

- [ ] **Step 3: Implement the minimal Sheets boundary change**

In `ensureConfigSheet`, find the `_config` sheet by title. If it exists and `properties.hidden !== true`, call `batchUpdate` with one `updateSheetProperties` request using its numeric `sheetId`, `{ sheetId, hidden: true }`, and `fields: 'hidden'`. If it does not exist, call `batchUpdate` with one `addSheet` request whose properties are `{ title: '_config', hidden: true }`. Leave `getConfig` read-only and leave `setConfig`’s existing call to `ensureConfigSheet` intact.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- lib/__tests__/sheets.test.ts
npm test
npm run build
```

Expected: the focused tests and all existing tests pass, and the production build completes without type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/sheets.ts lib/__tests__/sheets.test.ts
git commit -m "fix: keep the Sheets config tab hidden"
```

---

### Task 2: Upgrade dependencies and migrate middleware to the Next.js 16 proxy convention

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Rename: `middleware.ts` to `proxy.ts`
- Modify: `lib/__tests__/middleware.test.ts`

**Interfaces:**
- Consumes: the existing Next.js 14 application, auth middleware, and lockfile.
- Produces: a reproducible dependency set with Next.js `16.3.4`, React `18.3.1`, and compatible direct dependency versions pinned instead of using `latest`; the existing auth gate remains available from `proxy.ts`.

- [ ] **Step 1: Update the proxy test first**

Change the test import from `@/middleware` to `@/proxy` while preserving every existing `isAuthorized` assertion. Add one assertion that the proxy module exports a callable default handler:

```ts
import proxy, { isAuthorized } from '@/proxy';

it('exports the Next.js proxy handler', () => {
  expect(typeof proxy).toBe('function');
});
```

If the current test already imports `isAuthorized` separately, combine the imports without duplicating the symbol.

- [ ] **Step 2: Run the focused test and verify the intended RED state**

Run:

```bash
npm test -- lib/__tests__/middleware.test.ts
```

Expected: the test fails because `@/proxy` does not exist yet. Do not change application code before observing this failure.

- [ ] **Step 3: Record the dependency baseline and audit result**

Run:

```bash
npm list --depth=0
npm audit --omit=dev --json
```

Record only package versions and vulnerability counts in the task report. Never copy environment values, tokens, or secret contents.

- [ ] **Step 4: Update direct dependencies and runtime-aligned types deterministically**

Use exact versions for the currently installed direct dependencies, changing only the framework target and version pinning:

```bash
npm install --save-exact next@16.3.4 react@18.3.1 react-dom@18.3.1 next-auth@4.24.15 @vercel/oidc@3.8.5 google-auth-library@11.0.2 googleapis@176.0.0
npm install --save-dev --save-exact typescript@5.9.3 @types/node@24.13.3 @types/react@18.3.30 @types/react-dom@18.3.7 @vitejs/plugin-react@6.1.1 @testing-library/jest-dom@7.0.1 @testing-library/react@16.3.3 @testing-library/user-event@14.6.6 jsdom@29.1.1 vitest@4.1.11 autoprefixer@10.5.4 postcss@8.5.26 tailwindcss@3.4.19
```

Add an `engines` entry of `{ "node": "24.x" }` to `package.json`. Keep the existing npm scripts unchanged. Do not run `npm audit fix --force`.

Rename `middleware.ts` to `proxy.ts`. Preserve `isAuthorized` and the existing matcher array. Export the existing `withAuth` handler as the default proxy handler and ensure the named `isAuthorized` export remains available to the test.

- [ ] **Step 5: Verify compatibility and the audit**

Run:

```bash
npm ci
npm test
npm run build
npm audit --omit=dev
```

Expected: install succeeds from the lockfile, all tests pass, the build succeeds, and the audit has no high or critical production vulnerabilities. The focused middleware test must pass through the new `proxy.ts` entry point. If the Next 16 migration exposes an application compatibility failure, write a failing regression test for the affected behavior before changing application code and keep the fix in this task’s reviewed diff.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json proxy.ts lib/__tests__/middleware.test.ts
git rm middleware.ts
git commit -m "chore: migrate to audited Next.js 16 dependencies"
```

---

### Task 3: Release documentation and repository cleanup

**Files:**
- Modify: `.gitignore`
- Modify: `README.md`
- Create: `docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md`

**Interfaces:**
- Consumes: the existing `.env.local.example`, Vercel project configuration, and rollback checkpoint.
- Produces: concise operator documentation that explains setup, required secret names, deployment gates, smoke tests, and rollback without containing secret values.

- [ ] **Step 1: Normalize `.gitignore`**

Make `.gitignore` contain exactly these rules, one per line, with no duplicate entries:

```gitignore
node_modules
.next
.env*
.vercel
*.log
```

Do not add `next-env.d.ts` or `tsconfig.tsbuildinfo` to the repository; they remain generated files and are covered by the existing TypeScript/Next workflow as appropriate.

- [ ] **Step 2: Replace the placeholder README**

Document:

- what StockLooker does;
- the architecture boundary: browser → authenticated Next.js routes → Google Sheets through server-side WIF/OIDC;
- local setup using `.env.local.example` and `npm install`, `npm test`, `npm run build`;
- the required environment variable names without values;
- the production release gate and link to the runbook;
- the source baseline tag and the rule that secrets must not be committed.

- [ ] **Step 3: Create the production runbook**

The runbook must include these exact operational sections:

```markdown
# StockLooker production runbook

## Preflight

- Work from the reviewed `worktree-stocklooker-build` commit.
- Confirm `npm test`, `npm run build`, and `npm audit --omit=dev` pass.
- Confirm the Vercel project is `automation-systems/stocklooker`.
- Confirm the required environment variable names exist in Preview and Production; never print their values.
- Confirm Vercel OIDC federation, Google OAuth callback configuration, GCP WIF trust, service-account Sheet access, and DNS.

## Required environment variable names

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ALLOWED_DOMAIN`, `ADMIN_EMAIL`, `GOOGLE_SHEET_ID`, `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`, `GCP_SERVICE_ACCOUNT_EMAIL`.

## Deployment

Run `vercel --prod` from the reviewed worktree, record the deployment URL and commit, attach `stocklooker.automationsystems.info`, and confirm the hostname resolves before smoke testing.

## Smoke test

1. Unauthenticated access redirects to `/login`.
2. An `@automationsystems.org` account can sign in.
3. An outside-domain account is denied.
4. A normal company user can search a real Sheet row.
5. A no-match search returns the expected not-found message.
6. Only the configured admin can open `/admin` and `/api/admin/config`.
7. The admin can save a valid column mapping.
8. Logout ends the session.

## Rollback

Use the last known-good Vercel deployment or redeploy a reviewed commit. For source recovery, create a separate worktree from `codex/baseline-stocklooker-source-94684f6`; never delete the baseline tag.
```

- [ ] **Step 4: Verify documentation and cleanup**

Run:

```bash
git diff --check
rg -n "TBD|TODO|FIXME|secret-value|token-value" README.md docs/superpowers/runbooks
git status --short
```

Expected: no placeholder matches, no secret values, no whitespace errors, and only the documented generated/pre-existing files remain uncommitted.

- [ ] **Step 5: Commit**

```bash
git add .gitignore README.md docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md
git commit -m "docs: add StockLooker release and rollback runbook"
```

---

### Task 4: Live Vercel release and smoke verification

**Files:**
- Create or modify only: `docs/superpowers/releases/2026-09-01-stocklooker-release.md`

**Interfaces:**
- Consumes: the reviewed branch, Vercel CLI authentication, existing Vercel project, configured environment variables, Google OAuth/GCP/WIF configuration, and the production runbook.
- Produces: a deployed, DNS-reachable production release with recorded verification evidence and no secret values in the release record.

This is controller-only because it mutates external deployment state and requires live credentials. Do not dispatch this task to a subagent.

- [ ] **Step 1: Verify the external preflight without printing secrets**

Run:

```bash
vercel whoami
vercel project inspect stocklooker
vercel env ls
vercel domains inspect stocklooker.automationsystems.info
```

Confirm the project, Preview/Production environment variable names, OIDC federation, and DNS. If DNS is still misconfigured, add the exact Vercel-requested DNS record at the authoritative DNS provider before deployment.

- [ ] **Step 2: Deploy the reviewed commit**

Run:

```bash
vercel --prod
```

Record only the deployment URL, deployment ID, commit, and timestamps. Do not record environment values or command output that contains secrets.

- [ ] **Step 3: Attach and verify the custom domain**

Run the Vercel domain attachment command only if the domain is not already attached:

```bash
vercel domains add stocklooker.automationsystems.info
vercel domains inspect stocklooker.automationsystems.info
```

Continue only when Vercel reports the hostname configured and reachable.

- [ ] **Step 4: Run the browser smoke test**

Use the browser-control skill against the production hostname and record pass/fail evidence for every item in the runbook’s Smoke test section. Do not store user credentials, OAuth tokens, Sheet contents beyond the minimum test result, or screenshots containing sensitive data.

- [ ] **Step 5: Record the release and verify rollback readiness**

Create `docs/superpowers/releases/2026-09-01-stocklooker-release.md` with the following headings. Populate every heading with actual non-secret evidence before committing:

```markdown
# StockLooker release record

- Release status:
- Release commit:
- Vercel deployment:
- Custom domain: `stocklooker.automationsystems.info`
- Tests:
- Build:
- Audit:
- Smoke test:
- Rollback source tag: `codex/baseline-stocklooker-source-94684f6`
- Notes:
```

- [ ] **Step 6: Commit the release record**

```bash
git add docs/superpowers/releases/2026-09-01-stocklooker-release.md
git commit -m "docs: record StockLooker production release"
```

---

## Final verification

After Tasks 1–4, run from the reviewed worktree:

```bash
npm test
npm run build
npm audit --omit=dev
git status --short
git log --oneline --decorate -8
```

The final result is acceptable only when tests/build/audit pass, the release record is complete, the deployment is reachable, the smoke test passes, and the baseline tag remains present.
