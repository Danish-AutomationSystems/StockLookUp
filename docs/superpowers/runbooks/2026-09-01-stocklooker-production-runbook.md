# StockLooker production runbook

## Preflight

- Work from the reviewed `worktree-stocklooker-build` commit.
- Confirm `npm test`, `npm run build`, and `npm audit --omit=dev` pass.
- Confirm the Vercel project is `automation-systems/stocklooker`.
- Confirm the required environment variable names exist in Preview and Production; never print their values.
- Confirm local operator access uses an authenticated Vercel CLI session plus linked `.vercel/project.json`; do not copy a Vercel OIDC token into committed files.
- Confirm Vercel OIDC federation, Google OAuth callback configuration, GCP WIF trust, service-account Sheet access, and DNS.

## Required environment variable names

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ALLOWED_DOMAIN`, `ADMIN_EMAIL`, `GOOGLE_SHEET_ID`, `GCP_PROJECT_NUMBER`, `GCP_WORKLOAD_IDENTITY_POOL_ID`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`, `GCP_SERVICE_ACCOUNT_EMAIL`.

## Deployment

Run `vercel --prod` from the reviewed worktree, record the deployment URL and commit, attach `stocklooker.automationsystems.info`, and confirm the hostname resolves before smoke testing.

For local validation before deployment, run `npm install` or `npm ci`, then `vercel login`, `vercel link --yes --project stocklooker --team <team-id-or-slug>`, `vercel env pull .env.local --environment=development`, `npm test`, and `npm run build`. Start `vercel dev` in a separate terminal because it runs in the foreground. `lib/googleAuth.ts` uses `getVercelOidcToken()` from `@vercel/oidc`, so production receives the platform-provided request token and local development depends on the linked CLI-backed refresh flow rather than a committed token value.

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
