# Final Review Fix Wave Report

**Date:** 2026-09-01

**Worktree:** `D:\AutomationSystems\StockLookUp\.claude\worktrees\stocklooker-build`

**Commit:** `fix: close UI accessibility and stale-state gaps`

## Scope completed

- Added regression coverage for stale save feedback after an admin mapping edit and for an in-flight save that completes after the submitted mapping has changed.
- Cleared save feedback on every mapping mutation: search-column change, displayed-column change, row addition, and effective row removal.
- Guarded asynchronous save completion with both a mapping version and latest-request identifier so stale or superseded requests cannot update the visible status.
- Added a shared `link-target` contract with a minimum 44px width and height, and applied it to the StockLooker brand, Admin, and both Back to search links. The login page has no navigation link; its Google action remains the existing 44px-minimum button.
- Replaced the muted text token with `#526d82` and added the control-border token `#7b91a8`. Against the white surface these measure `5.43:1` and `3.25:1`, respectively.
- Raised mobile supporting copy and visible labels to `1rem` (16px), retaining smaller responsive typography only from the existing `sm` breakpoint where appropriate.

## TDD evidence

The production changes that the tests were designed to catch were: omitting status invalidation on an edit, accepting an async completion from an older mapping version, and omitting the shared minimum-target class from a navigation link.

### RED

Command:

```text
npm test -- app/admin/__tests__/page.test.tsx app/__tests__/page.test.tsx
```

Observed result before implementation: exit 1, 2 test files failed, 4 tests failed and 10 passed. The intended failures were:

- `uses the shared 44px target class for header navigation links`
- `uses the shared 44px target class for back navigation`
- `clears Saved. after the saved search or display mapping is edited`
- `does not report an in-flight save as successful after the mapping changes`

Both stale-state tests failed because the document still contained the `Saved.` status, confirming that the regressions exercised the real broken behavior.

### GREEN

Command:

```text
npm test -- app/admin/__tests__/page.test.tsx app/__tests__/page.test.tsx components/__tests__/SearchForm.test.tsx components/__tests__/ResultCard.test.tsx app/login/__tests__/page.test.tsx
```

Observed result after implementation: exit 0, 5 test files passed, 20 tests passed.

## Root cause and implementation

`app/admin/page.tsx` previously cleared `status` only when Save began. Mapping handlers could therefore leave a successful message visible after the values became unsaved. The async save continuation also had no identity or version check, so it unconditionally wrote `Saved.` when an older POST resolved.

The fix increments a mapping-version ref and clears status from each relevant edit handler. Each valid save captures the current mapping version and a monotonically increasing request identifier. Success, server-error, and network-error completions update status only when both values still identify the latest unchanged save. GET/POST URLs, the POST payload, validation messages, mapping rules, and row behavior are unchanged.

## Files in this fix wave

- `.superpowers/sdd/2026-09-01-stocklooker-ui-redesign/final-fix-report.md`
- `app/__tests__/page.test.tsx`
- `app/admin/__tests__/page.test.tsx`
- `app/admin/page.tsx`
- `app/globals.css`
- `app/page.tsx`
- `components/ResultCard.tsx`
- `components/SearchForm.tsx`

## Verification

| Check | Result |
| --- | --- |
| Focused UI tests | PASS — 5 files, 20 tests |
| Full `npm test` | PASS — 16 files, 122 tests |
| `npm run build` | PASS — production build compiled, TypeScript completed, 7 static pages generated |
| `npm audit --omit=dev` | PASS — 0 vulnerabilities |
| Contrast assertion | PASS — muted text 5.43:1; control border 3.25:1 |
| `git diff --check` | PASS — no whitespace errors; Git emitted only existing LF/CRLF conversion notices |

Vitest continues to emit the existing advisory that `vitest.config.ts` uses ESM syntax while loaded as CommonJS. It does not fail the suite and is outside this fix wave.

## Boundaries and QA limitations

- No route, auth, Google, Sheets, environment, data-validation, deployment, dependency, font, or paid-resource changes were made by this wave.
- Existing unrelated shared-worktree modifications were preserved and excluded from this commit. The pre-existing untracked `next-env.d.ts` and `tsconfig.tsbuildinfo` files were also left untouched and excluded.
- No authenticated browser QA was performed or claimed in this wave. Verification is based on the red/green component regressions, full automated suite, production build, dependency audit, and explicit contrast calculations.
- Multi-agent review tooling was not available in this session; the complete scoped diff was reviewed inline against the final-fix brief before staging.
