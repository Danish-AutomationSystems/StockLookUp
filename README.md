# StockLooker

StockLooker is an internal lookup tool for Automation Systems. Authenticated company users sign in with Google, search a Google Sheet for a matching row, and view the configured result columns without exposing Google credentials or Sheet access to the browser.

## Architecture

StockLooker keeps the trust boundary on the server:

- Browser UI
- Authenticated Next.js routes and API handlers
- Google Sheets access through server-side Vercel OIDC and GCP Workload Identity Federation

The browser never receives service-account credentials, Sheet secrets, or direct Google API access.

## Local setup

1. Copy `.env.local.example` to `.env.local`.
2. Fill in the required environment variable names with local development values.
3. Install dependencies and verify the app:

```bash
npm install
npm test
npm run build
```

## Required environment variable names

Set these variables locally and in Vercel without committing their values:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `ALLOWED_DOMAIN`
- `ADMIN_EMAIL`
- `GOOGLE_SHEET_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_WORKLOAD_IDENTITY_POOL_ID`
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`
- `GCP_SERVICE_ACCOUNT_EMAIL`

Use `.env.local.example` as the template for local development values. Do not commit `.env.local`, secret values, OAuth credentials, tokens, or service-account material.

## Production release gate

Before any production deployment, confirm `npm test`, `npm run build`, and `npm audit --omit=dev` pass from the reviewed `worktree-stocklooker-build` commit and verify the external configuration listed in the production runbook.

Runbook: [docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md](docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md)

## Recovery baseline

The source-only rollback checkpoint is preserved by the Git tag `codex/baseline-stocklooker-source-94684f6`. Keep that tag intact and use a separate worktree if source recovery is needed.
