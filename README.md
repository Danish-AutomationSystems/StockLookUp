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
2. Install dependencies:

```bash
npm install
```

Use `npm ci` instead when you want a clean install from the committed lockfile.

3. Authenticate and link the local checkout to the Vercel project before testing Google Sheets access through Workload Identity Federation:

```bash
vercel login
vercel link --yes --project stocklooker --team <team-id-or-slug>
vercel env pull .env.vercel.local --environment=development
```

4. After the Vercel pull finishes, copy `.env.local.example` to `.env.local` if you have not already, then manually merge only the non-secret local configuration you still need from `.env.vercel.local` and your local setup into `.env.local`. Do not overwrite `.env.local` with the pulled file, and do not copy secret values into documentation, screenshots, or reports.

The linked project metadata is stored in `.vercel/project.json`. In this repo, [lib/googleAuth.ts](lib/googleAuth.ts) calls `getVercelOidcToken()` from `@vercel/oidc`. In production, Vercel provides the request-scoped OIDC token for the function runtime. Locally, the supported workflow is to stay logged into the Vercel CLI, keep the project linked, and run through Vercel so `getVercelOidcToken()` can refresh the local OIDC token when needed.

5. Verify the app before starting the foreground Vercel dev server:

```bash
npm test
npm run build
```

6. Start local development in a separate terminal:

```bash
vercel dev
```

Do not commit `.env.local` or `.env.vercel.local`. Do not copy a Vercel OIDC token into committed files, docs, screenshots, Git history, or reports. If a local token expires, refresh it through the authenticated CLI and linked-project flow instead of committing a value to `.env.local.example`, `README.md`, or any source file.

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
