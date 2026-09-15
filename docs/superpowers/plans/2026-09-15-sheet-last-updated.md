# Sheet Last-Updated Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an auto-refreshing "Data updated X ago" indicator (with an absolute-time tooltip) on both the search page and the admin page, sourced from the Google Sheet's Drive API `modifiedTime`.

**Architecture:** Add the Drive `drive.metadata.readonly` scope to the existing WIF auth client. A new `lib/driveMeta.ts` wraps `drive.files.get`. A new authenticated `GET /api/sheet-status` route (any signed-in company user, not admin-only) returns the ISO timestamp, following the exact error-handling/logging pattern already used by `/api/search`. A new pure `lib/formatRelativeTime.ts` and a client component `components/SheetStatus.tsx` poll that route every 60s and render the result on both pages.

**Tech Stack:** Next.js 14 App Router, TypeScript, next-auth, googleapis (`drive` v3 alongside the existing `sheets` v4), Vitest + @testing-library/react.

## Global Constraints

- No Google service-account key file — auth stays Workload Identity Federation only, via the existing `getGoogleAuthClient(subjectToken?)` in `lib/googleAuth.ts`. Do not add a second auth mechanism.
- Route handlers must follow the existing pattern in `app/api/search/route.ts`: read `x-vercel-oidc-token` from the request header as the subject token, call `auth.getAccessToken()` before building the API client, wrap the body in try/catch, log via `logServerFailure(operation, err, stage)` from `lib/safeLogging.ts`, and return a generic error message — never the caught error's message — in the response body.
- `/api/sheet-status` requires only a valid session (`getServerSession(authOptions)`), not `isAdmin` — both the sales page and the admin page consume it.
- No live network calls in any test — mock `googleapis`, `next-auth`, and `@/lib/googleAuth` the same way existing tests do.
- Every pure-logic module gets unit tests written before implementation (TDD).
- Commit after every task.

---

### Task 1: Relative time formatter

**Files:**
- Create: `lib/formatRelativeTime.ts`
- Test: `lib/__tests__/formatRelativeTime.test.ts`

**Interfaces:**
- Produces: `formatRelativeTime(isoString: string, now: Date): string`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/formatRelativeTime.test.ts
import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

const NOW = new Date('2026-09-15T12:00:00.000Z');

describe('formatRelativeTime', () => {
  it('returns "just now" for under 60 seconds ago', () => {
    const isoString = new Date(NOW.getTime() - 30 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('just now');
  });

  it('returns singular minute for exactly 1 minute ago', () => {
    const isoString = new Date(NOW.getTime() - 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('1 min ago');
  });

  it('returns plural minutes for multiple minutes ago', () => {
    const isoString = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('5 min ago');
  });

  it('returns singular hour for exactly 1 hour ago', () => {
    const isoString = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('1 hour ago');
  });

  it('returns plural hours for multiple hours ago', () => {
    const isoString = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('3 hours ago');
  });

  it('returns singular day for exactly 1 day ago', () => {
    const isoString = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('1 day ago');
  });

  it('returns plural days for multiple days ago', () => {
    const isoString = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(isoString, NOW)).toBe('5 days ago');
  });

  it('falls back to a locale date string past 7 days', () => {
    const isoString = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatRelativeTime(isoString, NOW);
    expect(result).toBe(new Date(isoString).toLocaleDateString());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/formatRelativeTime.test.ts`
Expected: FAIL with "Cannot find module '@/lib/formatRelativeTime'"

- [ ] **Step 3: Implement**

```ts
// lib/formatRelativeTime.ts
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MAX_RELATIVE_DAYS = 7;

export function formatRelativeTime(isoString: string, now: Date): string {
  const then = new Date(isoString);
  const diffMs = now.getTime() - then.getTime();

  if (diffMs < MINUTE_MS) return 'just now';

  if (diffMs < HOUR_MS) {
    const minutes = Math.floor(diffMs / MINUTE_MS);
    return `${minutes} min ago`;
  }

  if (diffMs < DAY_MS) {
    const hours = Math.floor(diffMs / HOUR_MS);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(diffMs / DAY_MS);
  if (days <= MAX_RELATIVE_DAYS) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return then.toLocaleDateString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/formatRelativeTime.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/formatRelativeTime.ts lib/__tests__/formatRelativeTime.test.ts
git commit -m "feat: add relative time formatter for sheet status"
```

---

### Task 2: Drive scope on the auth client

**Files:**
- Modify: `lib/googleAuth.ts`
- Modify (test): `lib/__tests__/googleAuth.test.ts`

**Interfaces:**
- Consumes: none new
- Produces: `getGoogleAuthClient` now requests both `spreadsheets` and `drive.metadata.readonly` scopes

- [ ] **Step 1: Update the existing scopes test to expect both scopes**

In `lib/__tests__/googleAuth.test.ts`, find this test:

```ts
  it('requests the Google Sheets scope for service-account access tokens', () => {
    expect((getGoogleAuthClient() as any).scopes).toEqual([
      'https://www.googleapis.com/auth/spreadsheets',
    ]);
  });
```

Replace it with:

```ts
  it('requests the Sheets and Drive metadata scopes for service-account access tokens', () => {
    expect((getGoogleAuthClient() as any).scopes).toEqual([
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ]);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- lib/__tests__/googleAuth.test.ts`
Expected: FAIL — actual scopes array is missing the Drive scope

- [ ] **Step 3: Update the implementation**

In `lib/googleAuth.ts`, find the `scopes: ['https://www.googleapis.com/auth/spreadsheets']` line inside `getGoogleAuthClient` and change it to:

```ts
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
    ],
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- lib/__tests__/googleAuth.test.ts`
Expected: PASS (all existing googleAuth tests, including the updated scopes assertion)

- [ ] **Step 5: Run the full suite to confirm no other test hardcodes the old scopes array**

Run: `npm test`
Expected: PASS — if any other test file asserts the single-scope array (e.g. a route test checking the auth client construction), update it the same way as Step 1 before committing.

- [ ] **Step 6: Commit**

```bash
git add lib/googleAuth.ts lib/__tests__/googleAuth.test.ts
git commit -m "feat: add Drive metadata scope to Google auth client"
```

---

### Task 3: Drive metadata reader

**Files:**
- Create: `lib/driveMeta.ts`
- Test: `lib/__tests__/driveMeta.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (takes a pre-built `drive_v3.Drive` client as a parameter, dependency-injected — same pattern as `lib/sheets.ts` taking a `sheets_v4.Sheets` client)
- Produces: `getDriveClient(auth: BaseExternalAccountClient): drive_v3.Drive`, `getSheetLastModified(client: drive_v3.Drive, spreadsheetId: string): Promise<string>`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/__tests__/driveMeta.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('googleapis', () => ({
  google: { drive: vi.fn(({ auth }) => ({ auth })) },
}));

import { google } from 'googleapis';
import { getDriveClient, getSheetLastModified } from '@/lib/driveMeta';

function makeMockClient(overrides: any = {}) {
  return {
    files: {
      get: vi.fn().mockResolvedValue({ data: { modifiedTime: '2026-09-15T12:00:00.000Z' } }),
      ...overrides,
    },
  } as any;
}

describe('getDriveClient', () => {
  it('builds a drive v3 client with the given auth', () => {
    const auth = {} as any;
    getDriveClient(auth);
    expect(google.drive).toHaveBeenCalledWith(expect.objectContaining({ version: 'v3', auth }));
  });
});

describe('getSheetLastModified', () => {
  it('returns the modifiedTime for the given spreadsheet id', async () => {
    const client = makeMockClient();
    const result = await getSheetLastModified(client, 'sheet-id');
    expect(result).toBe('2026-09-15T12:00:00.000Z');
    expect(client.files.get).toHaveBeenCalledWith({
      fileId: 'sheet-id',
      fields: 'modifiedTime',
    });
  });

  it('propagates an error from the Drive API', async () => {
    const client = makeMockClient({ get: vi.fn().mockRejectedValue(new Error('drive failure')) });
    await expect(getSheetLastModified(client, 'sheet-id')).rejects.toThrow('drive failure');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/__tests__/driveMeta.test.ts`
Expected: FAIL with "Cannot find module '@/lib/driveMeta'"

- [ ] **Step 3: Implement**

```ts
// lib/driveMeta.ts
import { google, drive_v3 } from 'googleapis';
import type { BaseExternalAccountClient } from 'google-auth-library';

export function getDriveClient(auth: BaseExternalAccountClient): drive_v3.Drive {
  return google.drive({ version: 'v3', auth: auth as any });
}

export async function getSheetLastModified(
  client: drive_v3.Drive,
  spreadsheetId: string
): Promise<string> {
  const res = await client.files.get({
    fileId: spreadsheetId,
    fields: 'modifiedTime',
  });
  return res.data.modifiedTime as string;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/__tests__/driveMeta.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/driveMeta.ts lib/__tests__/driveMeta.test.ts
git commit -m "feat: add Drive metadata reader for sheet last-modified time"
```

---

### Task 4: Sheet status API route

**Files:**
- Create: `app/api/sheet-status/route.ts`
- Test: `app/api/sheet-status/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `authOptions` from `@/lib/auth` (existing), `getGoogleAuthClient`/`requireEnv` from `@/lib/googleAuth` (Task 2), `getDriveClient`/`getSheetLastModified` from `@/lib/driveMeta` (Task 3), `logServerFailure` from `@/lib/safeLogging` (existing)
- Produces: `GET(req: NextRequest): Promise<NextResponse>` — `200 {modifiedTime}` / `401` / `503`

- [ ] **Step 1: Write the failing tests**

```ts
// app/api/sheet-status/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));
vi.mock('@/lib/driveMeta', () => ({
  getDriveClient: vi.fn(() => ({})),
  getSheetLastModified: vi.fn(),
}));
vi.mock('@/lib/googleAuth', () => ({
  getGoogleAuthClient: vi.fn(() => ({ getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) })),
  requireEnv: vi.fn((name: string) => process.env[name]),
}));

import { getServerSession } from 'next-auth';
import { getDriveClient, getSheetLastModified } from '@/lib/driveMeta';
import { getGoogleAuthClient } from '@/lib/googleAuth';
import { GET } from '@/app/api/sheet-status/route';
import { NextRequest } from 'next/server';

function makeRequest(oidcHeader?: string) {
  const init = oidcHeader ? { headers: { 'x-vercel-oidc-token': oidcHeader } } : undefined;
  return new NextRequest('http://localhost/api/sheet-status', init);
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

describe('GET /api/sheet-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getGoogleAuthClient as any).mockReset().mockReturnValue({
      getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }),
    });
    process.env.GOOGLE_SHEET_ID = 'sheet-id';
  });

  it('returns 401 when not signed in', async () => {
    (getServerSession as any).mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 200 with the modifiedTime for a signed-in non-admin user', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org', isAdmin: false } });
    (getSheetLastModified as any).mockResolvedValue('2026-09-15T12:00:00.000Z');
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ modifiedTime: '2026-09-15T12:00:00.000Z' });
  });

  it('uses the incoming Vercel OIDC token to authenticate', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    const auth = { getAccessToken: vi.fn().mockResolvedValue({ token: 'access-token' }) };
    (getGoogleAuthClient as any).mockReturnValue(auth);
    (getSheetLastModified as any).mockResolvedValue('2026-09-15T12:00:00.000Z');

    const res = await GET(makeRequest('request-scoped-oidc-token'));

    expect(res.status).toBe(200);
    expect(getGoogleAuthClient).toHaveBeenCalledWith('request-scoped-oidc-token');
    expect(auth.getAccessToken).toHaveBeenCalledOnce();
    expect(getDriveClient).toHaveBeenCalledWith(auth);
  });

  it('returns 503 (not the raw error message) when the Drive API throws', async () => {
    (getServerSession as any).mockResolvedValue({ user: { email: 'sales@automationsystems.org' } });
    (getSheetLastModified as any).mockRejectedValue(new Error('internal drive failure details'));
    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain('internal drive failure details');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- app/api/sheet-status/__tests__/route.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/sheet-status/route'"

- [ ] **Step 3: Implement**

```ts
// app/api/sheet-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGoogleAuthClient, requireEnv } from '@/lib/googleAuth';
import { getDriveClient, getSheetLastModified } from '@/lib/driveMeta';
import { logServerFailure } from '@/lib/safeLogging';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let stage = 'environment';
  try {
    const spreadsheetId = requireEnv('GOOGLE_SHEET_ID');
    const requestSubjectToken = req.headers.get('x-vercel-oidc-token') || undefined;
    const auth = getGoogleAuthClient(requestSubjectToken);
    stage = 'token exchange';
    await auth.getAccessToken();
    const client = getDriveClient(auth);
    stage = 'metadata read';
    const modifiedTime = await getSheetLastModified(client, spreadsheetId);
    return NextResponse.json({ modifiedTime });
  } catch (err) {
    logServerFailure('sheetStatus.GET', err, stage);
    return NextResponse.json({ error: 'Status temporarily unavailable' }, { status: 503 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- app/api/sheet-status/__tests__/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/sheet-status
git commit -m "feat: add sheet status API route"
```

---

### Task 5: SheetStatus component

**Files:**
- Create: `components/SheetStatus.tsx`
- Test: `components/__tests__/SheetStatus.test.tsx`

**Interfaces:**
- Consumes: `formatRelativeTime` from `@/lib/formatRelativeTime` (Task 1), `GET /api/sheet-status` (Task 4)
- Produces: `SheetStatus()` — a self-contained client component with no props

- [ ] **Step 1: Write the failing tests**

```tsx
// components/__tests__/SheetStatus.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SheetStatus from '@/components/SheetStatus';

describe('SheetStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('renders nothing before the first fetch resolves', () => {
    global.fetch = vi.fn(() => new Promise(() => {})) as any;
    const { container } = render(<SheetStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the relative time with an absolute-time tooltip after fetching', async () => {
    const modifiedTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ modifiedTime }),
    }) as any;

    render(<SheetStatus />);

    await waitFor(() => {
      expect(screen.getByText(/Data updated 5 min ago/i)).toBeInTheDocument();
    });
    const el = screen.getByText(/Data updated 5 min ago/i);
    expect(el).toHaveAttribute('title', new Date(modifiedTime).toLocaleString());
  });

  it('renders nothing when the fetch response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any;
    const { container } = render(<SheetStatus />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    expect(container).toBeEmptyDOMElement();
  });

  it('re-fetches every 60 seconds', async () => {
    const modifiedTime = new Date(Date.now() - 60 * 1000).toISOString();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ modifiedTime }),
    }) as any;

    render(<SheetStatus />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(60 * 1000);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- components/__tests__/SheetStatus.test.tsx`
Expected: FAIL with "Cannot find module '@/components/SheetStatus'"

- [ ] **Step 3: Implement**

```tsx
// components/SheetStatus.tsx
'use client';

import { useEffect, useState } from 'react';
import { formatRelativeTime } from '@/lib/formatRelativeTime';

const POLL_INTERVAL_MS = 60 * 1000;

export default function SheetStatus() {
  const [modifiedTime, setModifiedTime] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/sheet-status');
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setModifiedTime(body.modifiedTime);
      } catch {
        // Ambient info only — silently retry on the next tick.
      }
    }

    void poll();
    const intervalId = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  if (!modifiedTime) return null;

  return (
    <span title={new Date(modifiedTime).toLocaleString()} className="text-sm text-[var(--color-muted)]">
      Data updated {formatRelativeTime(modifiedTime, new Date())}
    </span>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- components/__tests__/SheetStatus.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add components/SheetStatus.tsx components/__tests__/SheetStatus.test.tsx
git commit -m "feat: add SheetStatus polling component"
```

---

### Task 6: Wire SheetStatus into the search and admin pages

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/admin/page.tsx`

**Interfaces:**
- Consumes: `SheetStatus` from `@/components/SheetStatus` (Task 5)

- [ ] **Step 1: Add SheetStatus to the search page header**

In `app/page.tsx`, import `SheetStatus` and render it inside the header row, after the brand link and before the admin/sign-out controls, so it reads left-to-right as brand → status → actions:

```tsx
import SheetStatus from '@/components/SheetStatus';
```

Change the header `<div className="app-content flex items-center justify-between py-4">` block from:

```tsx
          <Link href="/" className="link-target app-brand text-lg">StockLooker</Link>
          <div className="flex items-center gap-3 text-base sm:text-sm">
```

to:

```tsx
          <div className="flex items-center gap-3">
            <Link href="/" className="link-target app-brand text-lg">StockLooker</Link>
            <SheetStatus />
          </div>
          <div className="flex items-center gap-3 text-base sm:text-sm">
```

(The closing `</div>` count increases by one to match the new wrapping div — add it right after the brand/status group, before the existing actions `<div>` starts.)

- [ ] **Step 2: Add SheetStatus to the admin page header**

In `app/admin/page.tsx`, import `SheetStatus`:

```tsx
import SheetStatus from '@/components/SheetStatus';
```

In the main (non-loading, non-error) return block, change:

```tsx
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Admin configuration</p>
            <h1 id="admin-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-navy)]">
              Admin: Column Mapping
            </h1>
          </div>
          <Link href="/" className="link-target font-medium text-[var(--color-blue)] hover:text-[var(--color-blue-dark)] hover:underline">
            Back to search
          </Link>
        </div>
```

to:

```tsx
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Admin configuration</p>
            <h1 id="admin-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-navy)]">
              Admin: Column Mapping
            </h1>
            <div className="mt-1">
              <SheetStatus />
            </div>
          </div>
          <Link href="/" className="link-target font-medium text-[var(--color-blue)] hover:text-[var(--color-blue-dark)] hover:underline">
            Back to search
          </Link>
        </div>
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all existing `app/page.tsx` and `app/admin/page.tsx` tests still pass unmodified (SheetStatus renders `null` until its fetch resolves, so it doesn't interfere with existing assertions; if any existing test does a strict DOM snapshot or exact-children count that breaks, add `global.fetch` mocking consistent with that test file's existing fetch-mock pattern so `SheetStatus`'s fetch call doesn't produce an unhandled rejection warning in the test output — check for that specifically since a new client component's mount-time fetch can otherwise leave a dangling promise in unrelated tests)

- [ ] **Step 4: Run the production build**

Run: `npm run build`
Expected: succeeds with no type errors, `/` and `/admin` both build

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/admin/page.tsx
git commit -m "feat: show sheet last-updated status on search and admin pages"
```

---

### Task 7: GCP console step (manual, not code)

Not a code task — a configuration step the plan's executor must prompt the human to do, since it requires GCP Console access this session does not have programmatic access to (same constraint as the original service-account setup).

- [ ] **Step 1: Confirm the Drive API is enabled on the `stocklooker` GCP project**

The service account already has Editor access to the spreadsheet (granted during original setup) and Drive API respects that same sharing — but the Drive API itself must be enabled on the project (separate from Sheets API). Ask the human to visit `console.cloud.google.com/apis/library/drive.googleapis.com?project=stocklooker` and click **Enable** if it isn't already.

- [ ] **Step 2: No env var or redeploy config change needed**

This feature reuses `GOOGLE_SHEET_ID` and all existing GCP/WIF env vars already set in Vercel — no new environment variables to add for this feature.
