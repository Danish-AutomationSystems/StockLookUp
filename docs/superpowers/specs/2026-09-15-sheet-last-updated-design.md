# Sheet Last-Updated Indicator — Design

**Goal:** Show sales reps and the admin when the underlying Google Sheet was last modified, auto-refreshing every 60 seconds, on both the search page and the admin page.

## Architecture

The app currently authenticates to Google only via the Sheets API v4 scope (`spreadsheets`). Getting a modification timestamp requires the Drive API (`drive.metadata.readonly` scope) on the same spreadsheet file ID — Sheets API has no such field. The WIF service account already has Editor access to the sheet via sharing, which Drive API respects identically, so no re-sharing is needed — only the scope needs adding to the auth client.

A new authenticated API route serves the timestamp; a small shared frontend component polls it every 60s and renders both a relative ("2 min ago") and absolute (hover tooltip) form.

## Components

**`lib/googleAuth.ts`** (modify) — add `'https://www.googleapis.com/auth/drive.metadata.readonly'` to the existing `scopes` array in `getGoogleAuthClient`.

**`lib/driveMeta.ts`** (new) — `getSheetLastModified(client, spreadsheetId): Promise<string>`, wrapping `google.drive({version: 'v3', auth}).files.get({fileId: spreadsheetId, fields: 'modifiedTime'})`, returning the ISO timestamp string. Takes an auth client the same way `lib/sheets.ts` functions do (dependency injection for testability — no live network calls in tests).

**`app/api/sheet-status/route.ts`** (new) — `GET` handler:
- 401 if no session (any signed-in company user, not admin-only — the sales page needs this too).
- Wrapped in try/catch like the other routes; on Drive API failure, `console.error` the real error and return `503 { error: 'Status temporarily unavailable' }` (never leak the caught error's message).
- 200 `{ modifiedTime: string }` on success.

**`lib/formatRelativeTime.ts`** (new) — pure function `formatRelativeTime(isoString: string, now: Date): string` → `"just now"`, `"2 min ago"`, `"3 hours ago"`, `"5 days ago"`, falling back to a locale date string past ~7 days. Takes `now` as a parameter (not `new Date()` internally) so it's trivially unit-testable without mocking the clock.

**`components/SheetStatus.tsx`** (new) — client component:
- On mount: fetch `/api/sheet-status`, store `modifiedTime` in state.
- `setInterval` every 60s: re-fetch `/api/sheet-status` (picks up new edits) AND re-render (so the relative-time text ages even between fetches — a second, faster local tick isn't needed since 60s granularity is fine at "X min/hours ago" resolution).
- Cleans up the interval on unmount.
- Renders: `<span title="{absolute toLocaleString()}">Data updated {formatRelativeTime(modifiedTime, new Date())}</span>`. Shows nothing (or a subtle "—") while loading; shows nothing on fetch error (non-critical info, shouldn't alarm users — silently retries next tick) rather than an error banner.

**`app/page.tsx`** and **`app/admin/page.tsx`** (modify) — drop `<SheetStatus />` into the header area of each, next to the existing title/nav.

## Data Flow

Page loads → `SheetStatus` mounts → fetch `/api/sheet-status` → route checks session → calls `getSheetLastModified` via the Drive-scoped auth client → returns ISO timestamp → component renders relative+absolute time → every 60s, repeat the fetch and re-render.

## Error Handling

- No session: 401, component treats any non-200 as "don't show anything, try again next tick" (no user-facing error state — this is ambient info, not a task the user is blocked on).
- Drive API failure server-side: 503, generic message, real error logged server-side only (same pattern as `/api/search` and `/api/admin/config`).
- Interval keeps running regardless of a single failed poll — self-heals on the next tick.

## Testing

- `formatRelativeTime`: pure function, TDD, covers just-now / minutes / hours / days / far-past boundaries.
- `lib/driveMeta.ts`: mocked Drive client (matching the `lib/sheets.ts` mock pattern already in the test suite), verifies the right `fileId`/`fields` params and correct return value.
- `app/api/sheet-status/route.ts`: mocked `next-auth` + mocked `lib/driveMeta`, covers 401 / 200 / 503.
- `SheetStatus`: React Testing Library, mocked `fetch`, fake timers (`vi.useFakeTimers`) to verify the 60s poll fires and the component re-fetches.
