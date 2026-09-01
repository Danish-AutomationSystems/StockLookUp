# StockLooker UI Redesign Design

**Date:** 2026-09-01  
**Status:** Approved direction; implementation pending  
**Scope:** Visual and responsive UX improvements for the login, search, and admin mapping pages.

## Goal

Make StockLooker feel like a reliable internal enterprise tool: clear at a glance, comfortable on mobile, efficient for repeated lookup, and polished enough for production use. Existing authentication, search behavior, admin authorization, column-mapping rules, API contracts, and Google Sheets integration remain unchanged.

## Design direction

Use a clean enterprise light interface with restrained depth:

- Navy as the brand anchor, blue for the primary action, green only for successful confirmation.
- Soft neutral page background, white surfaces, clear borders, and a small consistent shadow scale.
- One shared application shell across pages: brand/header area, constrained content measure, predictable page title, and contextual navigation.
- Typography with a modern system-first sans-serif stack; no external font or paid asset dependency.
- Native semantic controls remain the foundation, styled consistently rather than replaced with fragile custom widgets.

## Page experience

### Login

- Center a compact sign-in card with product name, purpose statement, and one primary Google sign-in action.
- Keep access-denied feedback visible and specific without exposing implementation details.
- Preserve the existing `signIn('google', { callbackUrl: '/' })` behavior.

### Search

- Present the lookup as the primary task with a clear page heading and supporting instruction.
- Use a responsive form: stacked controls on narrow screens and inline controls when space allows.
- Keep the search input and button at least 44px tall, with an explicit label or visually-hidden accessible label.
- Show loading in the button without layout shift; preserve disabled behavior during the request.
- Render result data in a readable responsive surface. Preserve configured result-column order and never add the search column.
- Show errors in an accessible alert region close to the form/result area; preserve existing messages and request behavior.
- Keep admin navigation visible only for admin sessions and sign-out available without competing with search.

### Admin mapping

- Use a clear page header with a return link and a short explanation of the configuration impact.
- Place “What can be searched” and “What is displayed” in separate visual sections.
- Keep exactly one search-column native select and at least one displayed-column native select row.
- Displayed rows remain repeatable, ordered, removable except for the final row, and filtered according to current business rules.
- Make Save the single primary action; Add display column and Remove are secondary actions.
- Keep validation and server/network feedback in an accessible status region near the controls. Never report Saved after a failed request.
- Loading and load-failure states should reserve a stable layout and provide a clear retry path without changing the API.

## Responsive behavior

- Mobile-first layout with gutters that scale from 16px on phones to 24–32px on larger screens.
- Verify at 375px, 768px, 1024px, and 1440px widths, plus narrow landscape.
- No horizontal scrolling. Admin form rows stack on narrow screens; action controls remain full-width or comfortably tappable.
- Use `min-height: 100dvh` where full-height layout is needed and preserve browser zoom.
- Keep body text at least 16px on mobile and use a readable content measure on desktop.
- Preserve logical keyboard order and visible focus rings.

## Accessibility and interaction

- All form fields retain visible labels and programmatic associations.
- Interactive targets are at least 44px; icon-only controls require accessible names. Use inline SVG only if an icon is needed; no emoji icons.
- Use semantic `button`, `a`, `form`, `label`, `fieldset`, `legend`, and alert/status semantics.
- Use semantic color plus text for success/error; do not rely on color alone.
- Add restrained 150–250ms transitions for hover/focus/press states and disable nonessential motion under `prefers-reduced-motion`.
- Maintain visible focus styling and sufficient contrast for text, borders, disabled states, and action states.

## Technical boundaries

- Prefer shared CSS classes/design tokens in `app/globals.css` and small reusable presentational components where they reduce duplication.
- Do not modify route handlers, auth rules, Google auth, Sheets logic, environment variables, or data validation.
- Do not add a paid service, new hosted asset, billing-enabled resource, or unnecessary runtime dependency.
- Existing tests must continue to pass; add UI assertions only where the redesign introduces meaningful accessibility or responsive-state behavior.
- Keep changes independently revertible from the earlier production-hardening worktree state.

## Verification

- Focused page tests for login, search, and admin flows.
- Full `npm test`, `npm run build`, and `npm audit --omit=dev`.
- Manual/browser QA at required viewport sizes, keyboard navigation, reduced motion, error/loading/success states, and no-horizontal-scroll checks.
- Confirm the API request shapes and result projection are unchanged.

## Self-review

- The design has one clear primary CTA per page.
- The approved admin mapping behavior is preserved exactly, including automatic removal of a displayed column when it becomes the search column.
- Authenticated access and second-admin support are outside the redesign scope and remain untouched.
- No production cost surface is introduced.
- The design is implementable with the existing Next.js, React, Tailwind, and native-control stack.
