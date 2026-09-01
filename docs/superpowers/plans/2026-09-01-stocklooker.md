# StockLooker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js internal sales-search web app backed by a Google Sheet, with Google Workspace domain-restricted login, an admin config UI for mapping search/result columns, and zero client-side exposure of the sheet.

**Architecture:** Next.js 14 App Router (TypeScript) deployed on Vercel. NextAuth (Auth.js v4) with Google provider, JWT sessions, domain + admin gating enforced both in callbacks and middleware. All Google Sheets access happens server-side only, authenticated via GCP Workload Identity Federation (Vercel OIDC token exchanged for a service-account access token — no key file). Sheet holds a hidden `_config` tab storing the admin's column mapping.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, next-auth ^4, googleapis, google-auth-library, @vercel/oidc, Vitest + @testing-library/react for tests.

## Global Constraints

- No Google service-account key files anywhere (org policy blocks key creation) — auth is Workload Identity Federation only, via `google-auth-library`'s `ExternalAccountClient` and `@vercel/oidc`'s `getVercelOidcToken`.
- Sheet ID, service account details, and OAuth secrets live only in server-side env vars — never sent to the client.
- Login restricted to `automationsystems.org` (env var `ALLOWED_DOMAIN`), enforced in the NextAuth `signIn` callback, not just Google's `hd` param.
- Admin routes/API restricted to a single email, env var `ADMIN_EMAIL`.
- Every pure-logic module (auth rules, search matching, config validation) gets unit tests written before implementation (TDD). API routes get tests with mocked dependencies. No live network calls in tests.
- Commit after every task.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.js`, `.gitignore`, `.env.local.example`, `vitest.config.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx` (placeholder)
- Test: `lib/__tests__/sanity.test.ts`

**Interfaces:**
- Produces: working `npm run dev`, `npm run build`, `npm test` scripts for all later tasks.

- [ ] **Step 1: Init package.json and install dependencies**

```bash
npm init -y
npm install next@14 react@18 react-dom@18 next-auth@4 googleapis google-auth-library @vercel/oidc
npm install -D typescript @types/react @types/react-dom @types/node tailwindcss postcss autoprefixer vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom @testing-library/user-event
```

- [ ] **Step 2: Add npm scripts to package.json**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create tailwind.config.ts and postcss.config.js**

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
export default config;
```

```js
// postcss.config.js
module.exports = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: Create app/globals.css, app/layout.tsx, app/page.tsx placeholder**

```css
/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
// app/layout.tsx
import './globals.css';

export const metadata = { title: 'StockLooker', description: 'Internal sales lookup tool' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
```

```tsx
// app/page.tsx
export default function HomePage() {
  return <main className="p-8">StockLooker</main>;
}
```

- [ ] **Step 6: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 7: Write sanity test**

```ts
// lib/__tests__/sanity.test.ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Run test to verify pipeline works**

Run: `npm test`
Expected: PASS (1 test)

- [ ] **Step 9: Create .gitignore and .env.local.example**

```
# .gitignore
node_modules
.next
.env.local
.vercel
*.log
```

```
# .env.local.example
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000
ALLOWED_DOMAIN=automationsystems.org
ADMIN_EMAIL=testing@automationsystems.org
GOOGLE_SHEET_ID=
GCP_PROJECT_NUMBER=
GCP_WORKLOAD_IDENTITY_POOL_ID=vercel
GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel
GCP_SERVICE_ACCOUNT_EMAIL=
VERCEL_OIDC_TOKEN=
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js project with Tailwind and Vitest"
```

---

### Task 2: Auth rules (domain + admin check)

**Files:**
- Create: `lib/authRules.ts`
- Test: `lib/__tests__/authRules.test.ts`

**Interfaces:**
- Produces: `isAllowedDomain(email: string | null | undefined, allowedDomain: string): boolean`, `isAdmin(email: string | null | undefined, adminEmail: string): boolean`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/authRules.test.ts
import { describe, it, expect } from 'vitest';
import { isAllowedDomain, isAdmin } from '@/lib/authRules';

describe('isAllowedDomain', () => {
  it('returns true for matching domain', () => {
    expect(isAllowedDomain('user@automationsystems.org', 'automationsystems.org')).toBe(true);
  });
  it('is case-insensitive', () => {
    expect(isAllowedDomain('USER@AutomationSystems.ORG', 'automationsystems.org')).toBe(true);
  });
  it('returns false for other domain', () => {
    expect(isAllowedDomain('user@gmail.com', 'automationsystems.org')).toBe(false);
  });
  it('returns false for null/undefined email', () => {
    expect(isAllowedDomain(null, 'automationsystems.org')).toBe(false);
    expect(isAllowedDomain(undefined, 'automationsystems.org')).toBe(false);
  });
});

describe('isAdmin', () => {
  it('returns true for matching email, case-insensitive', () => {
    expect(isAdmin('Testing@AutomationSystems.org', 'testing@automationsystems.org')).toBe(true);
  });
  it('returns false for different email', () => {
    expect(isAdmin('other@automationsystems.org', 'testing@automationsystems.org')).toBe(false);
  });
  it('returns false for null email', () => {
    expect(isAdmin(null, 'testing@automationsystems.org')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/authRules.test.ts`
Expected: FAIL with "Cannot find module '@/lib/authRules'"

- [ ] **Step 3: Implement**

```ts
// lib/authRules.ts
export function isAllowedDomain(email: string | null | undefined, allowedDomain: string): boolean {
  if (!email) return false;
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === allowedDomain.toLowerCase();
}

export function isAdmin(email: string | null | undefined, adminEmail: string): boolean {
  if (!email) return false;
  return email.toLowerCase() === adminEmail.toLowerCase();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/authRules.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/authRules.ts lib/__tests__/authRules.test.ts
git commit -m "feat: add domain and admin auth rule helpers"
```

---

### Task 3: Search matching logic

**Files:**
- Create: `types/index.ts`, `lib/searchLogic.ts`
- Test: `lib/__tests__/searchLogic.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `SheetConfig { searchColumn: string; resultColumns: string[] }`, `SearchResult { [column: string]: string }`, `findMatchingRow(headers: string[], rows: string[][], config: SheetConfig, query: string): SearchResult | null`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/searchLogic.test.ts
import { describe, it, expect } from 'vitest';
import { findMatchingRow } from '@/lib/searchLogic';

const headers = ['SKU', 'Name', 'Price', 'Stock'];
const rows = [
  ['ABC123', 'Widget', '9.99', '42'],
  ['XYZ789', 'Gadget', '19.99', '7'],
];

describe('findMatchingRow', () => {
  it('finds exact match on search column', () => {
    const result = findMatchingRow(headers, rows, { searchColumn: 'SKU', resultColumns: ['Name', 'Price'] }, 'ABC123');
    expect(result).toEqual({ Name: 'Widget', Price: '9.99' });
  });

  it('is case-insensitive and trims whitespace', () => {
    const result = findMatchingRow(headers, rows, { searchColumn: 'SKU', resultColumns: ['Name'] }, '  abc123  ');
    expect(result).toEqual({ Name: 'Widget' });
  });

  it('returns null when no row matches', () => {
    const result = findMatchingRow(headers, rows, { searchColumn: 'SKU', resultColumns: ['Name'] }, 'NOPE');
    expect(result).toBeNull();
  });

  it('returns null when search column is not in headers', () => {
    const result = findMatchingRow(headers, rows, { searchColumn: 'Missing', resultColumns: ['Name'] }, 'ABC123');
    expect(result).toBeNull();
  });

  it('fills empty string for a result column missing from a row', () => {
    const shortRows = [['ABC123', 'Widget']];
    const result = findMatchingRow(headers, shortRows, { searchColumn: 'SKU', resultColumns: ['Name', 'Stock'] }, 'ABC123');
    expect(result).toEqual({ Name: 'Widget', Stock: '' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/searchLogic.test.ts`
Expected: FAIL with "Cannot find module '@/lib/searchLogic'"

- [ ] **Step 3: Implement**

```ts
// types/index.ts
export interface SheetConfig {
  searchColumn: string;
  resultColumns: string[];
}

export interface SearchResult {
  [column: string]: string;
}
```

```ts
// lib/searchLogic.ts
import type { SheetConfig, SearchResult } from '@/types';

export function findMatchingRow(
  headers: string[],
  rows: string[][],
  config: SheetConfig,
  query: string
): SearchResult | null {
  const searchColIndex = headers.indexOf(config.searchColumn);
  if (searchColIndex === -1) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const matchRow = rows.find(
    (row) => (row[searchColIndex] ?? '').trim().toLowerCase() === normalizedQuery
  );
  if (!matchRow) return null;

  const result: SearchResult = {};
  for (const col of config.resultColumns) {
    const idx = headers.indexOf(col);
    result[col] = idx === -1 ? '' : matchRow[idx] ?? '';
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/searchLogic.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add types/index.ts lib/searchLogic.ts lib/__tests__/searchLogic.test.ts
git commit -m "feat: add search matching logic"
```

---

### Task 4: Config validation logic

**Files:**
- Create: `lib/configValidation.ts`
- Test: `lib/__tests__/configValidation.test.ts`

**Interfaces:**
- Consumes: `SheetConfig` from `@/types` (Task 3)
- Produces: `ValidationResult { valid: boolean; errors: string[] }`, `validateConfig(headers: string[], config: SheetConfig): ValidationResult`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/configValidation.test.ts
import { describe, it, expect } from 'vitest';
import { validateConfig } from '@/lib/configValidation';

const headers = ['SKU', 'Name', 'Price', 'Stock'];

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    const result = validateConfig(headers, { searchColumn: 'SKU', resultColumns: ['Name', 'Price'] });
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('rejects a search column not in headers', () => {
    const result = validateConfig(headers, { searchColumn: 'Nope', resultColumns: ['Name'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Search column "Nope" not found in sheet headers');
  });

  it('rejects an empty resultColumns array', () => {
    const result = validateConfig(headers, { searchColumn: 'SKU', resultColumns: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one result column is required');
  });

  it('rejects a result column not in headers', () => {
    const result = validateConfig(headers, { searchColumn: 'SKU', resultColumns: ['Nope'] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Result column "Nope" not found in sheet headers');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/configValidation.test.ts`
Expected: FAIL with "Cannot find module '@/lib/configValidation'"

- [ ] **Step 3: Implement**

```ts
// lib/configValidation.ts
import type { SheetConfig } from '@/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateConfig(headers: string[], config: SheetConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.searchColumn || !headers.includes(config.searchColumn)) {
    errors.push(`Search column "${config.searchColumn}" not found in sheet headers`);
  }

  if (!config.resultColumns || config.resultColumns.length === 0) {
    errors.push('At least one result column is required');
  } else {
    for (const col of config.resultColumns) {
      if (!headers.includes(col)) {
        errors.push(`Result column "${col}" not found in sheet headers`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/configValidation.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/configValidation.ts lib/__tests__/configValidation.test.ts
git commit -m "feat: add config validation logic"
```

---

### Task 5: Google auth client (Workload Identity Federation)

**Files:**
- Create: `lib/googleAuth.ts`
- Test: `lib/__tests__/googleAuth.test.ts`

**Interfaces:**
- Produces: `requireEnv(name: string): string`, `getGoogleAuthClient(): ExternalAccountClient`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/googleAuth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { requireEnv, getGoogleAuthClient } from '@/lib/googleAuth';

const REQUIRED_VARS = [
  'GCP_PROJECT_NUMBER',
  'GCP_WORKLOAD_IDENTITY_POOL_ID',
  'GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID',
  'GCP_SERVICE_ACCOUNT_EMAIL',
];

describe('requireEnv', () => {
  it('returns the value when set', () => {
    process.env.__TEST_VAR__ = 'hello';
    expect(requireEnv('__TEST_VAR__')).toBe('hello');
    delete process.env.__TEST_VAR__;
  });

  it('throws when not set', () => {
    delete process.env.__TEST_MISSING__;
    expect(() => requireEnv('__TEST_MISSING__')).toThrow(
      'Missing required environment variable: __TEST_MISSING__'
    );
  });
});

describe('getGoogleAuthClient', () => {
  const originalValues: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of REQUIRED_VARS) originalValues[key] = process.env[key];
    process.env.GCP_PROJECT_NUMBER = '592405826741';
    process.env.GCP_WORKLOAD_IDENTITY_POOL_ID = 'vercel';
    process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID = 'vercel';
    process.env.GCP_SERVICE_ACCOUNT_EMAIL = 'stocklooker-sheets@stocklooker.iam.gserviceaccount.com';
  });

  afterEach(() => {
    for (const key of REQUIRED_VARS) {
      if (originalValues[key] === undefined) delete process.env[key];
      else process.env[key] = originalValues[key];
    }
  });

  it('builds a client without throwing when all env vars are set', () => {
    expect(() => getGoogleAuthClient()).not.toThrow();
  });

  it('throws when GCP_PROJECT_NUMBER is missing', () => {
    delete process.env.GCP_PROJECT_NUMBER;
    expect(() => getGoogleAuthClient()).toThrow(
      'Missing required environment variable: GCP_PROJECT_NUMBER'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/googleAuth.test.ts`
Expected: FAIL with "Cannot find module '@/lib/googleAuth'"

- [ ] **Step 3: Implement**

```ts
// lib/googleAuth.ts
import { getVercelOidcToken } from '@vercel/oidc';
import { ExternalAccountClient } from 'google-auth-library';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getGoogleAuthClient(): ExternalAccountClient {
  const projectNumber = requireEnv('GCP_PROJECT_NUMBER');
  const poolId = requireEnv('GCP_WORKLOAD_IDENTITY_POOL_ID');
  const providerId = requireEnv('GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID');
  const serviceAccountEmail = requireEnv('GCP_SERVICE_ACCOUNT_EMAIL');

  return ExternalAccountClient.fromJSON({
    type: 'external_account',
    audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: getVercelOidcToken,
    },
  }) as ExternalAccountClient;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/googleAuth.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/googleAuth.ts lib/__tests__/googleAuth.test.ts
git commit -m "feat: add GCP Workload Identity Federation auth client"
```

---

### Task 6: Sheets data access layer

**Files:**
- Create: `lib/sheets.ts`
- Test: `lib/__tests__/sheets.test.ts`

**Interfaces:**
- Consumes: `getGoogleAuthClient` from `@/lib/googleAuth` (Task 5), `SheetConfig` from `@/types` (Task 3)
- Produces: `getSheetsClient(): sheets_v4.Sheets`, `getDataSheetTitle(client, spreadsheetId): Promise<string>`, `getHeadersAndRows(client, spreadsheetId, sheetTitle): Promise<{ headers: string[]; rows: string[][] }>`, `ensureConfigSheet(client, spreadsheetId): Promise<void>`, `getConfig(client, spreadsheetId): Promise<SheetConfig | null>`, `setConfig(client, spreadsheetId, config): Promise<void>`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/sheets.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  getDataSheetTitle,
  getHeadersAndRows,
  ensureConfigSheet,
  getConfig,
  setConfig,
} from '@/lib/sheets';

function makeMockClient(overrides: any = {}) {
  return {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({
        data: { sheets: [{ properties: { title: 'Products' } }] },
      }),
      batchUpdate: vi.fn().mockResolvedValue({}),
      values: {
        get: vi.fn().mockResolvedValue({ data: { values: [] } }),
        update: vi.fn().mockResolvedValue({}),
      },
      ...overrides,
    },
  } as any;
}

describe('getDataSheetTitle', () => {
  it('returns the title of the first non-_config sheet', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({
        data: {
          sheets: [
            { properties: { title: '_config' } },
            { properties: { title: 'Products' } },
          ],
        },
      }),
    });
    const title = await getDataSheetTitle(client, 'sheet-id');
    expect(title).toBe('Products');
  });

  it('throws when no data sheet is found', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: '_config' } }] } }),
    });
    await expect(getDataSheetTitle(client, 'sheet-id')).rejects.toThrow('No data sheet found in spreadsheet');
  });
});

describe('getHeadersAndRows', () => {
  it('splits the first row as headers and the rest as rows', async () => {
    const client = makeMockClient();
    client.spreadsheets.values.get = vi.fn().mockResolvedValue({
      data: { values: [['SKU', 'Name'], ['A1', 'Widget']] },
    });
    const result = await getHeadersAndRows(client, 'sheet-id', 'Products');
    expect(result).toEqual({ headers: ['SKU', 'Name'], rows: [['A1', 'Widget']] });
  });

  it('returns empty headers and rows when sheet is empty', async () => {
    const client = makeMockClient();
    const result = await getHeadersAndRows(client, 'sheet-id', 'Products');
    expect(result).toEqual({ headers: [], rows: [] });
  });
});

describe('ensureConfigSheet', () => {
  it('does not create a sheet when _config already exists', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: '_config' } }] } }),
    });
    await ensureConfigSheet(client, 'sheet-id');
    expect(client.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('creates a _config sheet when missing', async () => {
    const client = makeMockClient({
      get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: 'Products' } }] } }),
    });
    await ensureConfigSheet(client, 'sheet-id');
    expect(client.spreadsheets.batchUpdate).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      requestBody: { requests: [{ addSheet: { properties: { title: '_config' } } }] },
    });
  });
});

describe('getConfig', () => {
  it('returns null when config sheet has no data row', async () => {
    const client = makeMockClient();
    const result = await getConfig(client, 'sheet-id');
    expect(result).toBeNull();
  });

  it('parses a stored config', async () => {
    const client = makeMockClient();
    client.spreadsheets.values.get = vi.fn().mockResolvedValue({
      data: { values: [['searchColumn', 'resultColumns'], ['SKU', 'Name, Price']] },
    });
    const result = await getConfig(client, 'sheet-id');
    expect(result).toEqual({ searchColumn: 'SKU', resultColumns: ['Name', 'Price'] });
  });
});

describe('setConfig', () => {
  it('writes the config to the _config sheet', async () => {
    const client = makeMockClient();
    await setConfig(client, 'sheet-id', { searchColumn: 'SKU', resultColumns: ['Name', 'Price'] });
    expect(client.spreadsheets.values.update).toHaveBeenCalledWith({
      spreadsheetId: 'sheet-id',
      range: "'_config'!A1:B2",
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['searchColumn', 'resultColumns'],
          ['SKU', 'Name,Price'],
        ],
      },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/sheets.test.ts`
Expected: FAIL with "Cannot find module '@/lib/sheets'"

- [ ] **Step 3: Implement**

```ts
// lib/sheets.ts
import { google, sheets_v4 } from 'googleapis';
import { getGoogleAuthClient } from './googleAuth';
import type { SheetConfig } from '@/types';

const CONFIG_SHEET_TITLE = '_config';

let cachedClient: sheets_v4.Sheets | null = null;

export function getSheetsClient(): sheets_v4.Sheets {
  if (cachedClient) return cachedClient;
  const auth = getGoogleAuthClient();
  cachedClient = google.sheets({ version: 'v4', auth: auth as any });
  return cachedClient;
}

export async function getDataSheetTitle(
  client: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<string> {
  const meta = await client.spreadsheets.get({ spreadsheetId });
  const sheetsList = meta.data.sheets ?? [];
  const dataSheet = sheetsList.find((s) => s.properties?.title !== CONFIG_SHEET_TITLE);
  if (!dataSheet?.properties?.title) throw new Error('No data sheet found in spreadsheet');
  return dataSheet.properties.title;
}

export async function getHeadersAndRows(
  client: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string
): Promise<{ headers: string[]; rows: string[][] }> {
  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:ZZ`,
  });
  const values = res.data.values ?? [];
  const [headers = [], ...rows] = values as string[][];
  return { headers, rows };
}

export async function ensureConfigSheet(
  client: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  const meta = await client.spreadsheets.get({ spreadsheetId });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === CONFIG_SHEET_TITLE);
  if (exists) return;
  await client.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: CONFIG_SHEET_TITLE } } }],
    },
  });
}

export async function getConfig(
  client: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<SheetConfig | null> {
  await ensureConfigSheet(client, spreadsheetId);
  const res = await client.spreadsheets.values.get({
    spreadsheetId,
    range: `'${CONFIG_SHEET_TITLE}'!A1:B2`,
  });
  const values = (res.data.values ?? []) as string[][];
  if (values.length < 2) return null;

  const [header, dataRow] = values;
  const searchColIdx = header.indexOf('searchColumn');
  const resultColsIdx = header.indexOf('resultColumns');
  if (searchColIdx === -1 || resultColsIdx === -1) return null;

  const searchColumn = dataRow[searchColIdx];
  const resultColumnsRaw = dataRow[resultColsIdx];
  if (!searchColumn || !resultColumnsRaw) return null;

  return {
    searchColumn,
    resultColumns: resultColumnsRaw.split(',').map((c) => c.trim()).filter(Boolean),
  };
}

export async function setConfig(
  client: sheets_v4.Sheets,
  spreadsheetId: string,
  config: SheetConfig
): Promise<void> {
  await ensureConfigSheet(client, spreadsheetId);
  await client.spreadsheets.values.update({
    spreadsheetId,
    range: `'${CONFIG_SHEET_TITLE}'!A1:B2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        ['searchColumn', 'resultColumns'],
        [config.searchColumn, config.resultColumns.join(',')],
      ],
    },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/sheets.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/sheets.ts lib/__tests__/sheets.test.ts
git commit -m "feat: add Google Sheets data access layer"
```

---

### Task 7: NextAuth configuration

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `types/next-auth.d.ts`
- Test: `lib/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: `isAllowedDomain`, `isAdmin` from `@/lib/authRules` (Task 2)
- Produces: `authOptions: NextAuthOptions` with `session.user.isAdmin: boolean`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/auth.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { authOptions } from '@/lib/auth';

describe('authOptions.callbacks.signIn', () => {
  beforeEach(() => {
    process.env.ALLOWED_DOMAIN = 'automationsystems.org';
  });

  it('allows sign-in for a company email', async () => {
    const signIn = authOptions.callbacks!.signIn!;
    const result = await signIn({ user: { email: 'sales@automationsystems.org' } } as any);
    expect(result).toBe(true);
  });

  it('rejects sign-in for an outside email', async () => {
    const signIn = authOptions.callbacks!.signIn!;
    const result = await signIn({ user: { email: 'random@gmail.com' } } as any);
    expect(result).toBe(false);
  });
});

describe('authOptions.callbacks.jwt/session', () => {
  beforeEach(() => {
    process.env.ADMIN_EMAIL = 'testing@automationsystems.org';
  });

  it('marks the admin email as isAdmin in the token', async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const token = await jwt({ token: { email: 'testing@automationsystems.org' } } as any);
    expect((token as any).isAdmin).toBe(true);
  });

  it('does not mark other emails as isAdmin', async () => {
    const jwt = authOptions.callbacks!.jwt!;
    const token = await jwt({ token: { email: 'sales@automationsystems.org' } } as any);
    expect((token as any).isAdmin).toBe(false);
  });

  it('copies isAdmin from token onto session.user', async () => {
    const session = authOptions.callbacks!.session!;
    const result = await session({
      session: { user: { email: 'testing@automationsystems.org' } },
      token: { isAdmin: true },
    } as any);
    expect((result.user as any).isAdmin).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/auth.test.ts`
Expected: FAIL with "Cannot find module '@/lib/auth'"

- [ ] **Step 3: Implement**

```ts
// lib/auth.ts
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';
import { isAllowedDomain, isAdmin } from './authRules';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: { hd: process.env.ALLOWED_DOMAIN ?? 'automationsystems.org', prompt: 'select_account' },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      return isAllowedDomain(user.email, process.env.ALLOWED_DOMAIN ?? 'automationsystems.org');
    },
    async jwt({ token }) {
      token.isAdmin = isAdmin(token.email, process.env.ADMIN_EMAIL ?? '');
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).isAdmin = Boolean((token as any).isAdmin);
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
};
```

```ts
// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

```ts
// types/next-auth.d.ts
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isAdmin: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    isAdmin?: boolean;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/auth.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts app/api/auth types/next-auth.d.ts lib/__tests__/auth.test.ts
git commit -m "feat: add NextAuth Google provider with domain and admin gating"
```

---

### Task 8: Route protection middleware

**Files:**
- Create: `middleware.ts`
- Test: `lib/__tests__/middleware.test.ts` (tests the exported pure `isAuthorized` function directly)

**Interfaces:**
- Produces: `isAuthorized(token: { isAdmin?: boolean } | null, pathname: string): boolean`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/middleware.test.ts
import { describe, it, expect } from 'vitest';
import { isAuthorized } from '@/middleware';

describe('isAuthorized', () => {
  it('denies access with no token', () => {
    expect(isAuthorized(null, '/')).toBe(false);
  });

  it('allows a signed-in non-admin on the home page', () => {
    expect(isAuthorized({ isAdmin: false }, '/')).toBe(true);
  });

  it('denies a signed-in non-admin on /admin', () => {
    expect(isAuthorized({ isAdmin: false }, '/admin')).toBe(false);
  });

  it('allows an admin on /admin', () => {
    expect(isAuthorized({ isAdmin: true }, '/admin')).toBe(true);
  });

  it('allows an admin on a nested /admin path', () => {
    expect(isAuthorized({ isAdmin: true }, '/admin/settings')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/middleware.test.ts`
Expected: FAIL with "Cannot find module '@/middleware'"

- [ ] **Step 3: Implement**

```ts
// middleware.ts
import { withAuth } from 'next-auth/middleware';

export function isAuthorized(token: { isAdmin?: boolean } | null, pathname: string): boolean {
  if (!token) return false;
  if (pathname.startsWith('/admin')) return Boolean(token.isAdmin);
  return true;
}

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => isAuthorized(token as any, req.nextUrl.pathname),
  },
  pages: { signIn: '/login' },
});

export const config = {
  matcher: ['/', '/admin/:path*'],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/middleware.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add middleware.ts lib/__tests__/middleware.test.ts
git commit -m "feat: add domain/admin route protection middleware"
```

---

### Task 9: Search API route

**Files:**
- Create: `app/api/search/route.ts`
- Test: `app/api/search/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getServerSession` (next-auth), `getSheetsClient`, `getDataSheetTitle`, `getHeadersAndRows`, `getConfig` from `@/lib/sheets` (Task 6), `findMatchingRow` from `@/lib/searchLogic` (Task 3), `requireEnv` from `@/lib/googleAuth` (Task 5)
- Produces: `GET(req: NextRequest): Promise<NextResponse>` — `200 {result}` / `400` / `401` / `404` / `503`

- [ ] **Step 1: Write failing tests**

```ts
// app/api/search/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/sheets', () => ({
  getSheetsClient: vi.fn(() => ({})),
  getDataSheetTitle: vi.fn(),
  getHeadersAndRows: vi.fn(),
  getConfig: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getDataSheetTitle, getHeadersAndRows, getConfig } from '@/lib/sheets';
import { GET } from '@/app/api/search/route';
import { NextRequest } from 'next/server';

function makeRequest(query: string | null) {
  const url = new URL('http://localhost/api/search');
  if (query !== null) url.searchParams.set('q', query);
  return new NextRequest(url);
}

describe('GET /api/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SHEET_ID = 'sheet-id';
  });

  it('returns 401 when not signed in', async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(makeRequest('abc'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when query param is missing', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(400);
  });

  it('returns 503 when no config is saved yet', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    (getConfig as any).mockResolvedValue(null);
    const res = await GET(makeRequest('abc'));
    expect(res.status).toBe(503);
  });

  it('returns 404 when no row matches', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Name'] });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await GET(makeRequest('nope'));
    expect(res.status).toBe(404);
  });

  it('returns 200 with the matched result', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Name'] });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({
      headers: ['SKU', 'Name'],
      rows: [['ABC123', 'Widget']],
    });
    const res = await GET(makeRequest('ABC123'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ result: { Name: 'Widget' } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/search/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/search/route'"

- [ ] **Step 3: Implement**

```ts
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSheetsClient, getDataSheetTitle, getHeadersAndRows, getConfig } from '@/lib/sheets';
import { findMatchingRow } from '@/lib/searchLogic';
import { requireEnv } from '@/lib/googleAuth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const query = req.nextUrl.searchParams.get('q');
  if (!query) return NextResponse.json({ error: 'Missing query parameter "q"' }, { status: 400 });

  const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
  const client = getSheetsClient();
  const config = await getConfig(client, spreadsheetId);
  if (!config) return NextResponse.json({ error: 'Search not configured yet' }, { status: 503 });

  const sheetTitle = await getDataSheetTitle(client, spreadsheetId);
  const { headers, rows } = await getHeadersAndRows(client, spreadsheetId, sheetTitle);
  const result = findMatchingRow(headers, rows, config, query);

  if (!result) return NextResponse.json({ error: 'No match found' }, { status: 404 });
  return NextResponse.json({ result });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/search/__tests__/route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/search lib/auth.ts
git commit -m "feat: add search API route"
```

---

### Task 10: Admin config API route

**Files:**
- Create: `app/api/admin/config/route.ts`
- Test: `app/api/admin/config/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getServerSession`, `getSheetsClient`, `getDataSheetTitle`, `getHeadersAndRows`, `getConfig`, `setConfig` from `@/lib/sheets` (Task 6), `validateConfig` from `@/lib/configValidation` (Task 4), `requireEnv` from `@/lib/googleAuth` (Task 5)
- Produces: `GET(): Promise<NextResponse>` — `200 {headers, config}` / `403`; `POST(req): Promise<NextResponse>` — `200 {success:true}` / `400` / `403`

- [ ] **Step 1: Write failing tests**

```ts
// app/api/admin/config/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/sheets', () => ({
  getSheetsClient: vi.fn(() => ({})),
  getDataSheetTitle: vi.fn(),
  getHeadersAndRows: vi.fn(),
  getConfig: vi.fn(),
  setConfig: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { getDataSheetTitle, getHeadersAndRows, getConfig, setConfig } from '@/lib/sheets';
import { GET, POST } from '@/app/api/admin/config/route';
import { NextRequest } from 'next/server';

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/config', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('GET /api/admin/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SHEET_ID = 'sheet-id';
  });

  it('returns 403 for a non-admin session', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org', isAdmin: false } });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns 403 with no session', async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('returns headers and current config for an admin', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    (getConfig as any).mockResolvedValue({ searchColumn: 'SKU', resultColumns: ['Name'] });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ headers: ['SKU', 'Name'], config: { searchColumn: 'SKU', resultColumns: ['Name'] } });
  });
});

describe('POST /api/admin/config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SHEET_ID = 'sheet-id';
  });

  it('returns 403 for a non-admin session', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org', isAdmin: false } });
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));
    expect(res.status).toBe(403);
  });

  it('returns 400 for an invalid config', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await POST(makePostRequest({ searchColumn: 'Nope', resultColumns: [] }));
    expect(res.status).toBe(400);
  });

  it('saves a valid config for an admin', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'testing@automationsystems.org', isAdmin: true } });
    (getDataSheetTitle as any).mockResolvedValue('Products');
    (getHeadersAndRows as any).mockResolvedValue({ headers: ['SKU', 'Name'], rows: [] });
    const res = await POST(makePostRequest({ searchColumn: 'SKU', resultColumns: ['Name'] }));
    expect(res.status).toBe(200);
    expect(setConfig).toHaveBeenCalledWith({}, 'sheet-id', { searchColumn: 'SKU', resultColumns: ['Name'] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/admin/config/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/admin/config/route'"

- [ ] **Step 3: Implement**

```ts
// app/api/admin/config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSheetsClient, getDataSheetTitle, getHeadersAndRows, getConfig, setConfig } from '@/lib/sheets';
import { validateConfig } from '@/lib/configValidation';
import { requireEnv } from '@/lib/googleAuth';

async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any)?.isAdmin) return null;
  return session;
}

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
  const client = getSheetsClient();
  const sheetTitle = await getDataSheetTitle(client, spreadsheetId);
  const { headers } = await getHeadersAndRows(client, spreadsheetId, sheetTitle);
  const config = await getConfig(client, spreadsheetId);
  return NextResponse.json({ headers, config });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
  const client = getSheetsClient();
  const sheetTitle = await getDataSheetTitle(client, spreadsheetId);
  const { headers } = await getHeadersAndRows(client, spreadsheetId, sheetTitle);

  const validation = validateConfig(headers, body);
  if (!validation.valid) {
    return NextResponse.json({ error: 'Invalid configuration', details: validation.errors }, { status: 400 });
  }

  await setConfig(client, spreadsheetId, body);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/admin/config/__tests__/route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/admin
git commit -m "feat: add admin config API route"
```

---

### Task 11: Auth pages (login, session provider)

**Files:**
- Create: `app/login/page.tsx`, `components/SessionProviderWrapper.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `signIn` from `next-auth/react`
- Produces: `/login` route with a "Sign in with Google" button and error messaging

- [ ] **Step 1: Write failing test**

```tsx
// app/login/__tests__/page.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const signInMock = vi.fn();
vi.mock('next-auth/react', () => ({ signIn: (...args: unknown[]) => signInMock(...args) }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  it('calls signIn("google") when the button is clicked', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: /sign in with google/i }));
    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/login/__tests__/page.test.tsx`
Expected: FAIL with "Cannot find module '@/app/login/page'"

- [ ] **Step 3: Implement**

```tsx
// app/login/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">StockLooker</h1>
      <p className="text-gray-600">Sign in with your AutomationSystems Google account.</p>
      {error && (
        <p className="rounded bg-red-50 px-4 py-2 text-red-700">
          Access denied. Use your @automationsystems.org account.
        </p>
      )}
      <button
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        onClick={() => signIn('google', { callbackUrl: '/' })}
      >
        Sign in with Google
      </button>
    </main>
  );
}
```

```tsx
// components/SessionProviderWrapper.tsx
'use client';

import { SessionProvider } from 'next-auth/react';

export default function SessionProviderWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

```tsx
// app/layout.tsx
import './globals.css';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';

export const metadata = { title: 'StockLooker', description: 'Internal sales lookup tool' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/login/__tests__/page.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add app/login components/SessionProviderWrapper.tsx app/layout.tsx
git commit -m "feat: add login page and session provider"
```

---

### Task 12: Sales search UI

**Files:**
- Create: `components/SearchForm.tsx`, `components/ResultCard.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `SearchResult` from `@/types` (Task 3), `useSession`/`signOut` from `next-auth/react`
- Produces: `SearchForm({ onSearch: (query: string) => void, loading: boolean })`, `ResultCard({ result: SearchResult })`

- [ ] **Step 1: Write failing tests**

```tsx
// components/__tests__/SearchForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchForm from '@/components/SearchForm';

describe('SearchForm', () => {
  it('calls onSearch with the typed value on submit', async () => {
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} loading={false} />);
    await userEvent.type(screen.getByRole('textbox'), 'ABC123');
    await userEvent.click(screen.getByRole('button', { name: /search/i }));
    expect(onSearch).toHaveBeenCalledWith('ABC123');
  });

  it('disables the button while loading', () => {
    render(<SearchForm onSearch={vi.fn()} loading={true} />);
    expect(screen.getByRole('button', { name: /search/i })).toBeDisabled();
  });
});
```

```tsx
// components/__tests__/ResultCard.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ResultCard from '@/components/ResultCard';

describe('ResultCard', () => {
  it('renders each column as a label/value pair', () => {
    render(<ResultCard result={{ Name: 'Widget', Price: '9.99' }} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('9.99')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- components/__tests__/SearchForm.test.tsx components/__tests__/ResultCard.test.tsx`
Expected: FAIL with "Cannot find module '@/components/SearchForm'" / "'@/components/ResultCard'"

- [ ] **Step 3: Implement**

```tsx
// components/SearchForm.tsx
'use client';

import { useState, FormEvent } from 'react';

export default function SearchForm({
  onSearch,
  loading,
}: {
  onSearch: (query: string) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Enter a value to search..."
        className="flex-1 rounded border border-gray-300 px-3 py-2"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}
```

```tsx
// components/ResultCard.tsx
import type { SearchResult } from '@/types';

export default function ResultCard({ result }: { result: SearchResult }) {
  return (
    <dl className="mt-6 grid gap-3 rounded border border-gray-200 bg-white p-4">
      {Object.entries(result).map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm font-medium text-gray-500">{label}</dt>
          <dd className="text-lg text-gray-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
```

```tsx
// app/page.tsx
'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import SearchForm from '@/components/SearchForm';
import ResultCard from '@/components/ResultCard';
import type { SearchResult } from '@/types';

export default function HomePage() {
  const { data: session } = useSession();
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch(query: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Something went wrong');
        return;
      }
      setResult(body.result);
    } catch {
      setError('Network error, try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">StockLooker</h1>
        <div className="flex items-center gap-3 text-sm">
          {(session?.user as any)?.isAdmin && (
            <Link href="/admin" className="text-blue-600 hover:underline">
              Admin
            </Link>
          )}
          <button onClick={() => signOut()} className="text-gray-500 hover:underline">
            Sign out
          </button>
        </div>
      </div>
      <SearchForm onSearch={handleSearch} loading={loading} />
      {error && <p className="mt-4 text-red-600">{error}</p>}
      {result && <ResultCard result={result} />}
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- components/__tests__/SearchForm.test.tsx components/__tests__/ResultCard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add components/SearchForm.tsx components/ResultCard.tsx app/page.tsx
git commit -m "feat: add sales search UI"
```

---

### Task 13: Admin config UI

**Files:**
- Create: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/config`, `POST /api/admin/config` (Task 10)

- [ ] **Step 1: Write failing test**

```tsx
// app/admin/__tests__/page.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPage from '@/app/admin/page';

describe('AdminPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (!options || options.method === undefined) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            headers: ['SKU', 'Name', 'Price'],
            config: { searchColumn: 'SKU', resultColumns: ['Name'] },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ success: true }) });
    }) as any;
  });

  it('loads headers and current config, then saves an updated selection', async () => {
    render(<AdminPage />);

    await waitFor(() => expect(screen.getByLabelText(/search column/i)).toBeInTheDocument());

    await userEvent.click(screen.getByLabelText('Price'));
    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/config',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/admin/__tests__/page.test.tsx`
Expected: FAIL with "Cannot find module '@/app/admin/page'"

- [ ] **Step 3: Implement**

```tsx
// app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [searchColumn, setSearchColumn] = useState('');
  const [resultColumns, setResultColumns] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/config')
      .then((res) => res.json())
      .then((body) => {
        setHeaders(body.headers ?? []);
        setSearchColumn(body.config?.searchColumn ?? '');
        setResultColumns(body.config?.resultColumns ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleResultColumn(col: string) {
    setResultColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  async function handleSave() {
    setStatus(null);
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchColumn, resultColumns }),
    });
    const body = await res.json();
    setStatus(res.ok ? 'Saved.' : `Error: ${(body.details ?? [body.error]).join(', ')}`);
  }

  if (loading) return <main className="p-8">Loading...</main>;

  return (
    <main className="mx-auto max-w-xl p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin: Column Mapping</h1>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to search
        </Link>
      </div>

      <label htmlFor="searchColumn" className="mb-1 block text-sm font-medium text-gray-700">
        Search column
      </label>
      <select
        id="searchColumn"
        value={searchColumn}
        onChange={(e) => setSearchColumn(e.target.value)}
        className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
      >
        <option value="">Select a column</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>

      <fieldset className="mb-4">
        <legend className="mb-1 text-sm font-medium text-gray-700">Result columns</legend>
        {headers.map((h) => (
          <label key={h} className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              aria-label={h}
              checked={resultColumns.includes(h)}
              onChange={() => toggleResultColumn(h)}
            />
            {h}
          </label>
        ))}
      </fieldset>

      <button
        onClick={handleSave}
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Save
      </button>
      {status && <p className="mt-4">{status}</p>}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/admin/__tests__/page.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add app/admin
git commit -m "feat: add admin column mapping UI"
```

---

### Task 14: Full test suite + production build check

**Files:** none created — verification task only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS (all tests across every prior task, ~50 tests)

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: build succeeds with no type errors (fix any that surface — most likely a missing `next-env.d.ts`, which `next build` generates automatically on first run)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: verify full test suite and production build" --allow-empty
```

---

### Task 15: Deployment (executed directly, not via subagent — requires live secrets)

This task is executed by the lead session directly against the real Vercel project, not dispatched as an isolated subagent task, since it requires pasting real secrets into `vercel env add`.

- [ ] Link the local repo to the `automation-systems` Vercel team and a new project named `stocklooker`: `vercel link --yes`
- [ ] Add production env vars via `vercel env add <NAME> production` for: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`), `NEXTAUTH_URL=https://stocklooker.automationsystems.info`, `ALLOWED_DOMAIN=automationsystems.org`, `ADMIN_EMAIL=testing@automationsystems.org`, `GOOGLE_SHEET_ID=17iB5UdJWLq4RhIOi7TVG5GFhsAAZY_AJ1EgPqWEpktA`, `GCP_PROJECT_NUMBER=592405826741`, `GCP_WORKLOAD_IDENTITY_POOL_ID=vercel`, `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel`, `GCP_SERVICE_ACCOUNT_EMAIL=stocklooker-sheets@stocklooker.iam.gserviceaccount.com`. Repeat for `preview` target.
- [ ] Enable OIDC Federation on the Vercel project: Project Settings → Security → "Secure backend access with OIDC federation" → Team mode → Save.
- [ ] Deploy: `vercel --prod`
- [ ] Attach domain: `vercel domains add stocklooker.automationsystems.info` (or attach via dashboard Project → Domains, since `automationsystems.info` is already verified on the team).
- [ ] Smoke test: visit `https://stocklooker.automationsystems.info`, sign in with a company Google account, confirm redirect works, confirm `/admin` is reachable only for `testing@automationsystems.org`, save a column mapping, run a search that matches a real row.
