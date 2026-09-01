# StockLooker UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a polished, accessible, mobile-first enterprise interface to StockLooker while preserving every existing auth, search, admin mapping, and API behavior.

**Architecture:** Keep business logic and route handlers unchanged. Introduce shared semantic visual tokens and shell classes in `app/globals.css`, then update the three page/component surfaces to consume them. Preserve native controls and existing accessible labels so the current UI tests remain valid; add only behavior-neutral assertions for loading/status semantics where needed.

**Tech Stack:** Next.js 16, React 18, TypeScript, Tailwind CSS 3, Vitest, Testing Library, native HTML controls, inline CSS/SVG only when needed.

## Global Constraints

- Existing authentication, search behavior, admin authorization, column-mapping rules, API contracts, and Google Sheets integration remain unchanged.
- Do not modify route handlers, auth rules, Google auth, Sheets logic, environment variables, or data validation.
- Do not add a paid service, new hosted asset, billing-enabled resource, or unnecessary runtime dependency.
- Mobile-first layout must be verified at 375px, 768px, 1024px, and 1440px widths, plus narrow landscape.
- Interactive targets must be at least 44px and preserve visible keyboard focus.
- Existing tests must continue to pass; failed requests must never report a false success state.
- Production troubleshooting must not introduce billable infrastructure, paid APIs, upgraded quotas, service-account keys, or new managed resources.

---

### Task 1: Shared visual foundation and application shell

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `app/login/page.tsx` (shell class only; behavior unchanged)
- Test: `app/login/__tests__/page.test.tsx` only if a shell landmark assertion is added

**Interfaces:**
- Produces reusable classes/tokens: `app-shell`, `app-header`, `app-brand`, `app-content`, `surface-card`, `eyebrow`, `button-primary`, `button-secondary`, `field-control`, `status-message`, `status-error`, `status-success`.
- Does not change any component prop, API route, session behavior, or data shape.

- [ ] **Step 1: Add a failing accessibility/shell test**

Add a focused assertion to `app/login/__tests__/page.test.tsx` that the rendered page exposes the new shell class, a `main` landmark, and a page heading. Keep the existing sign-in assertion unchanged:

```tsx
it('renders the login page inside the application main landmark', () => {
  render(<LoginPage />);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getByRole('main')).toHaveClass('app-shell');
  expect(screen.getByRole('heading', { name: 'StockLooker' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify the intended failure**

Run:

```bash
npm test -- app/login/__tests__/page.test.tsx
```

Expected: the new assertion fails only if the current login page does not expose the expected semantic structure; existing sign-in behavior must remain green.

- [ ] **Step 3: Add semantic tokens and responsive foundation**

In `app/globals.css`, add `:root` semantic color, radius, shadow, and focus variables; set a system sans-serif stack, `min-height: 100dvh`, accessible focus styles, `touch-action: manipulation`, reduced-motion handling, and reusable classes. Use light surfaces with navy/blue accents and no external font import.

- [ ] **Step 4: Apply the shell to the root layout**

Update `app/layout.tsx` so the body uses the shared page background and foreground classes without changing `SessionProviderWrapper` placement or metadata. Add the `app-shell` class to the login page main surface so the focused page test can verify the new shell contract.

- [ ] **Step 5: Run the focused test and full type/build checks**

Run:

```bash
npm test -- app/login/__tests__/page.test.tsx
npm run build
```

Expected: focused tests and production build pass.

- [ ] **Step 6: Commit the foundation**

```bash
git add app/globals.css app/layout.tsx app/login/page.tsx app/login/__tests__/page.test.tsx
git commit -m "style: add StockLooker visual foundation"
```

### Task 2: Login and search experience

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/page.tsx`
- Modify: `components/SearchForm.tsx`
- Modify: `components/ResultCard.tsx`
- Test: `app/login/__tests__/page.test.tsx`
- Create or modify: `app/__tests__/page.test.tsx` only if a missing page test file is required for visual-state semantics

**Interfaces:**
- Preserves `signIn('google', { callbackUrl: '/' })` exactly.
- Preserves `SearchForm` props `{ onSearch: (query: string) => void; loading: boolean }`.
- Preserves `HomePage` fetch URL `/api/search?q=<encoded query>` and result object shape.

- [ ] **Step 1: Write failing tests for interaction semantics**

Add tests that assert the search input has an accessible label, the submit button exposes `Searching...` and is disabled while loading, and result labels/values remain rendered. Do not assert CSS implementation details.

```tsx
it('labels the search field and exposes the loading state', () => {
  render(<SearchForm onSearch={vi.fn()} loading />);
  expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Searching...' })).toBeDisabled();
});
```

- [ ] **Step 2: Run the focused tests and verify the new test fails for the missing semantics**

Run:

```bash
npm test -- app/login/__tests__/page.test.tsx app/__tests__/page.test.tsx
```

Expected: the new search accessibility assertion fails before the component change; existing behavior tests remain green.

- [ ] **Step 3: Update SearchForm without changing behavior**

Add a visible or visually-hidden label associated with the existing input, apply the shared control/button classes, preserve trimming and empty-query behavior, keep loading disabled, and retain the exact button text values `Search` and `Searching...`. Use responsive grid/flex classes so controls stack below the narrow breakpoint.

- [ ] **Step 4: Update HomePage and ResultCard presentation**

Wrap the existing search page in the shared shell, preserve the admin conditional and sign-out action, add a clear heading/supporting text, mark request feedback with semantic `role="status"` or `role="alert"` as appropriate, and style `ResultCard` as an accessible responsive data surface. Do not change fetch logic or result iteration order.

- [ ] **Step 5: Update LoginPage presentation**

Wrap the current login content in the shared shell and a compact card, preserve the error copy and exact Google sign-in call, and ensure the primary button remains at least 44px tall with visible focus/disabled states.

- [ ] **Step 6: Run focused tests, full tests, and build**

```bash
npm test -- app/login/__tests__/page.test.tsx app/__tests__/page.test.tsx
npm test
npm run build
```

Expected: all existing and new tests pass and the production build succeeds.

- [ ] **Step 7: Commit the login/search UI**

```bash
git add app/login/page.tsx app/page.tsx components/SearchForm.tsx components/ResultCard.tsx app/login/__tests__/page.test.tsx app/__tests__/page.test.tsx
git commit -m "style: polish login and search experience"
```

### Task 3: Admin mapping UX and state feedback

**Files:**
- Modify: `app/admin/page.tsx`
- Modify: `app/admin/__tests__/page.test.tsx`

**Interfaces:**
- Preserves the existing `GET /api/admin/config` and `POST /api/admin/config` calls and payload `{ searchColumn, resultColumns }`.
- Preserves automatic removal of displayed rows matching a newly selected search column.
- Preserves one remaining empty displayed row when removal would otherwise leave zero rows.
- Preserves all current accessible labels used by tests: `Search column`, `Displayed column N`, `Add display column`, `Remove displayed column N`, and `Save`.

- [ ] **Step 1: Add failing tests for admin semantic states**

Add tests that assert the mapping page exposes a page heading, explanatory section labels, and a semantic status region after save. Keep all existing business-rule tests intact.

```tsx
it('exposes mapping guidance and a status region', async () => {
  setupFetchMock();
  render(<AdminPage />);
  await waitForPageToLoad();
  expect(screen.getByRole('heading', { name: /column mapping/i })).toBeInTheDocument();
  expect(screen.getByText(/what can be searched/i)).toBeInTheDocument();
  expect(screen.getByText(/what is displayed/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused admin test and verify the new assertion fails**

```bash
npm test -- app/admin/__tests__/page.test.tsx
```

Expected: the new presentation assertion fails before the markup change; existing mapping behavior remains green.

- [ ] **Step 3: Apply the responsive admin layout**

Use the shared shell and separate surface sections for the search-column control and displayed-column repeater. Keep native selects, visible labels, fieldset/legend semantics, and the current option filtering/row-key logic unchanged. Stack each row on narrow screens and keep Remove/Add/Save controls at least 44px tall.

- [ ] **Step 4: Improve status and loading/failure feedback**

Give loading a stable shell, make load failure actionable with a retry control that re-runs the existing configuration fetch, and mark save success/errors with status semantics. Preserve all current user-facing error strings and ensure failed POSTs do not show `Saved.`.

- [ ] **Step 5: Run focused tests, full tests, and build**

```bash
npm test -- app/admin/__tests__/page.test.tsx
npm test
npm run build
```

Expected: all tests and build pass.

- [ ] **Step 6: Commit the admin UI**

```bash
git add app/admin/page.tsx app/admin/__tests__/page.test.tsx
git commit -m "style: polish admin mapping experience"
```

### Task 4: Whole-branch verification and production handoff documentation

**Files:**
- Modify: `docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md`
- Create: `docs/superpowers/checkpoints/2026-09-01-stocklooker-ui-redesign-verification.md`

**Interfaces:**
- Documentation only; no runtime behavior changes.

- [ ] **Step 1: Run the full verification suite**

```bash
npm test
npm run build
npm audit --omit=dev
```

Record exact pass/fail output and any pre-existing audit condition without exposing secrets.

- [ ] **Step 2: Perform browser/responsive QA**

Verify `/login`, `/`, and `/admin` at 375px, 768px, 1024px, and 1440px widths, including narrow landscape. Check keyboard traversal, visible focus, no horizontal scrolling, reduced motion, loading, success, error, empty, and disabled states. Verify the admin save payload and search result projection remain behaviorally unchanged.

- [ ] **Step 3: Write the verification checkpoint**

Document the reviewed commit range, commands and outcomes, viewport matrix, accessibility checks, unchanged production-flow checks, and rollback reference `codex/baseline-stocklooker-source-94684f6`. Do not record credentials, tokens, or secret environment values.

- [ ] **Step 4: Update the production runbook**

Add a UI release checklist covering responsive viewport checks, keyboard/focus checks, error/loading/success states, and the explicit no-cost guardrail.

- [ ] **Step 5: Commit verification documentation**

```bash
git add docs/superpowers/runbooks/2026-09-01-stocklooker-production-runbook.md docs/superpowers/checkpoints/2026-09-01-stocklooker-ui-redesign-verification.md
git commit -m "docs: record StockLooker UI verification"
```

## Plan self-review

- Spec coverage: shared foundation covers tokens, contrast, focus, motion, shell, and responsive gutters; Task 2 covers login/search; Task 3 covers admin mapping and feedback; Task 4 covers required verification and runbook evidence.
- Behavioral safety: no task changes route handlers, auth, Google/Sheets code, configuration payloads, or mapping rules.
- Cost safety: no paid APIs, hosted assets, new managed resources, or unnecessary dependencies are introduced.
- Test-first order: every runtime task starts with a behavior/semantics test, runs it red, then implements the minimum UI change and runs it green.
- Responsive risk: all three user-facing pages are included in the viewport matrix, with narrow admin repeater rows explicitly handled.
- Rollback: documentation and each UI area are committed independently; existing baseline tag and prior uncommitted production-hardening work remain untouched.
