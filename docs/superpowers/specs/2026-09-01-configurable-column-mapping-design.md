# Configurable Column Mapping Design

**Date:** 2026-09-01  
**Status:** Approved for planning  
**Scope:** Admin column mapping, search-result projection, and the production failure path that currently prevents configuration loading.

## Goal

Give an administrator an unambiguous configuration space with one required search-column dropdown and a repeatable list of one or more displayed-column dropdowns. Saving the configuration must determine exactly which fields every authenticated StockLooker user receives.

The search field remains a separate part of the normal-user experience. The selected search column is not repeated in the result display unless the product rules are changed in a future specification.

## Current findings

- The admin page currently represents displayed columns as checkboxes rather than repeatable dropdown rows.
- The admin configuration load error is a symptom of the server returning an upstream failure while obtaining Google Sheets access.
- The deployed runtime has a Workload Identity Federation audience mismatch in the Google STS exchange. The exact Google Cloud provider configuration must be inspected and corrected by an authorized Google Cloud administrator; implementation must not guess an audience value.
- Route handlers currently log raw upstream errors. This can expose sensitive authentication material and must be replaced with safe diagnostic logging.

## Approved behavior

### Admin configuration UI

The page presents:

1. **What can be searched** — exactly one required dropdown populated from the current sheet headers.
2. **What is displayed** — at least one dropdown row, also populated from the current sheet headers.

The administrator can add displayed-column rows and remove rows, but cannot remove the last remaining displayed row. Displayed rows preserve their order when saved and when rendered to normal users.

Displayed-column choices must be unique and must not equal the selected search column. Each row must remain able to display its current value while editing, so option filtering cannot make an already-valid selection disappear.

When the administrator changes **What can be searched**, every displayed row whose value equals the newly selected search column is automatically removed. This is the explicit product rule requested by the user. If that removal would leave zero displayed rows, the UI creates one empty displayed row and blocks saving until it is assigned a valid non-search column.

The page shows validation feedback close to the invalid control and disables or rejects saving while any of these conditions is false:

- a search column is selected;
- at least one displayed column is selected;
- every selected column exists in the fetched header list;
- no displayed column duplicates another displayed column;
- no displayed column equals the search column.

Network and server failures remain visible as actionable errors. A failed save must not update the local “saved” state.

### Server contract

`GET /api/admin/config` continues to return the available headers and the persisted configuration. The response must be safe for the admin UI to initialize, including a clear error response when headers or configuration cannot be read.

`POST /api/admin/config` accepts:

```ts
{
  searchColumn: string;
  resultColumns: string[];
}
```

The server revalidates the complete payload against the current live headers. It rejects missing or unknown search columns, an empty result list, unknown result columns, duplicate result columns, and any result column equal to the search column. It persists only a valid configuration.

Validation must be centralized so the UI-facing API route and search projection share the same invariant definitions. Authentication and admin authorization behavior remain unchanged.

### Normal-user behavior

The normal search request continues to use the persisted `searchColumn` to find a row. The response projection contains only the persisted `resultColumns`, in their persisted order. The search column is not implicitly added to the result. If a stale stored configuration names a missing result header, the request must fail safely or omit that field according to the existing API contract; it must never expose an unconfigured column.

## Data flow

```text
live sheet headers
        |
        v
admin GET ---> dropdown options + persisted config
        |
        v
admin edits search/display selections
        |
        +-- changing search removes matching display rows
        |
        v
admin POST ---> server validation ---> _config persistence
                                      |
                                      v
normal search ---> persisted searchColumn ---> row match
                                      |
                                      v
                         persisted resultColumns only
```

The `_config` sheet tab remains an implementation detail and must not appear in selectable data headers.

## Error handling and security

- Raw `Error` objects, response bodies, credential objects, subject tokens, JWTs, authorization headers, and STS request details must never be sent to application logs.
- Route failures should log only a stable operation/category, safe status information, and a correlation identifier if one already exists in the project.
- Clients receive generic, actionable error messages without provider tokens or internal request details.
- The Google Cloud WIF audience mismatch is an infrastructure configuration issue. Before production sign-off, an authorized operator must verify the provider issuer, allowed audience behavior, attribute condition, service-account impersonation binding, and Sheets permissions, then rerun authenticated smoke tests.

## Testing requirements

Tests must be written before production implementation and must demonstrate a failing behavior before the corresponding implementation is added.

Required coverage:

- admin initializes one search dropdown and at least one displayed dropdown;
- admin can add and remove displayed rows, but cannot remove the last row;
- changing the search column removes every matching displayed row automatically;
- the UI prevents duplicate displayed selections and search/display overlap;
- the UI preserves displayed order in the save payload;
- failed load/save states are surfaced and do not report false success;
- API validation rejects unknown columns, duplicates, empty display lists, and search/display overlap;
- valid API configuration persists successfully;
- search projection returns only configured display columns and preserves order;
- safe logging does not emit token-like or sensitive fields from upstream errors;
- existing authentication and unauthorized behavior remains intact.

Verification must include focused tests, the full test suite, a production build, dependency/security checks, and authenticated production smoke tests after the Google Cloud configuration is corrected.

## Rollback and recovery

The pre-feature source checkpoint remains available at tag `codex/baseline-stocklooker-source-94684f6`. The current worktree branch and commit history must be preserved. Feature commits should remain small and independently revertible. Generated local artifacts such as `next-env.d.ts` and `tsconfig.tsbuildinfo` are not part of the feature and must not be included in feature commits.

## Explicit non-goals

- No drag-and-drop builder.
- No implicit display of the search column.
- No client-only authorization or validation.
- No guessed or silently changed Google Cloud WIF provider settings.
- No unrelated redesign of the search page.
