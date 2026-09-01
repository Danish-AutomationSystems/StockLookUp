# StockLooker production runbook

## Preflight

- Work from the reviewed `worktree-stocklooker-build` commit.
- Confirm `npm test`, `npm run build`, and `npm audit --omit=dev` pass.
- Confirm the Vercel project is `automation-systems/stocklooker`.
- Confirm the required environment variable names exist in Preview and Production; never print their values.
- Confirm local operator access uses an authenticated Vercel CLI session plus linked `.vercel/project.json`; do not copy a Vercel OIDC token into committed files.
- Confirm Vercel OIDC federation, Google OAuth callback configuration, GCP WIF trust, service-account Sheet access, and DNS.
- Confirm the rollback source tag `codex/baseline-stocklooker-source-94684f6` is still present before deployment work begins.

## Required environment variable names

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ALLOWED_DOMAIN`, `ADMIN_EMAIL`, `GOOGLE_SHEET_ID`, `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`, `GCP_SERVICE_ACCOUNT_EMAIL`.

## Deployment

Run `vercel --prod` from the reviewed worktree, record the deployment URL and commit, attach `stocklooker.automationsystems.info`, and confirm the hostname resolves before smoke testing.

For local validation before deployment, run `npm install` or `npm ci`, then `vercel login`, `vercel link --yes --project stocklooker --team <team-id-or-slug>`, and `vercel env pull .env.vercel.local --environment=development`. After the pull, manually merge only the non-secret local configuration you still need into `.env.local`; do not overwrite `.env.local` with the pulled file, never commit `.env.local` or `.env.vercel.local`, and do not print or copy secret values into reports. Then run `npm test` and `npm run build`. Start `vercel dev` in a separate terminal because it runs in the foreground. `lib/googleAuth.ts` uses `getVercelOidcToken()` from `@vercel/oidc`, so production receives the platform-provided request token and local development depends on the linked CLI-backed refresh flow rather than a committed token value.

## Admin workflow

1. Sign in as the configured admin account and open `/admin`.
2. Confirm the search-column dropdown and at least one displayed-column dropdown load from the live Sheet headers.
3. Choose exactly one search column.
4. Add or remove displayed-column rows as needed, keeping each displayed column unique and different from the search column.
5. If the search column changes to a value already selected in displayed columns, confirm those displayed rows are removed automatically. If that removal would empty the displayed list, the UI should leave one empty displayed row and block saving until a valid replacement is chosen.
6. Save the mapping, then verify a normal user search returns only the configured displayed columns in the saved order.

## Deployment verification

- Record the reviewed source commit and the production deployment URL together.
- Confirm `stocklooker.automationsystems.info` resolves to the deployed Vercel production target before testing login.
- Verify an authenticated company user can search a known row and receives only the configured displayed columns, never the search column unless a future specification explicitly changes that rule.
- Verify the configured admin can reopen `/admin`, reload the saved mapping, and confirm the persisted displayed-column order matches the last saved order.

## External WIF checks

These checks require an authorized Google Cloud operator. Do not guess or silently change Google Cloud settings during deployment work.

- Verify the workload identity provider issuer exactly matches the issuer expected by the Vercel OIDC federation setup.
- Verify the provider allows the canonical audience resource used by `lib/googleAuth.ts`: `//iam.googleapis.com/projects/${GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`.
- Verify the provider attribute condition still matches the intended Vercel project/team trust boundary and has not drifted.
- Verify the target service account still permits impersonation from that provider principal set and that the impersonation binding applies to `GCP_SERVICE_ACCOUNT_EMAIL`.
- Verify the impersonated service account still has the required Google Sheets access to the configured spreadsheet and its live data sheet.
- Record only pass/fail evidence and operator-owned resource identifiers in deployment notes; never copy secret values, subject tokens, JWTs, or raw provider payloads into this runbook or any report.

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
