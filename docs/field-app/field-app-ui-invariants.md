# Field app UI invariants (`supervisor/` segment)

**Former filename:** `supervisor-ui-invariants.md` (renamed for discoverability; same scope).

Audit date: `2026-03-24`

**Naming:** Product surface is the **field execution web app**. Routes, folders, and `Supervisor*` React symbols keep the `supervisor` prefix for code compatibility.

## Decision Summary

- The field app experience must have **one shared page shell system**, not route-by-route layout logic.
- The field app shell must express repeated patterns through **shared React components**, not duplicated JSX and class strings.
- Route files under `apps/field-app/src/routes/supervisor/` should remain **composition layers**: data fetching, route params, and page-specific state only.
- Layout, spacing, empty/error states, sticky page headers, and common section containers are **architectural concerns**, not local route concerns.
- Mobile-safe spacing and bottom-nav clearance are owned by the **root shell + shared layout primitives** (`supervisor-layout.ts`) and must not be re-solved ad hoc in individual pages.

## Why This Exists

The field-app routes (`supervisor/` segment) drifted into multiple local layout systems:

- different container widths
- different header spacing
- repeated error and empty states
- repeated voice-flow section wrappers
- local fixes for mobile overflow and bottom-nav overlap

That causes regressions because every new screen or tweak recreates the same decisions. These invariants exist to prevent that drift from returning.

## Scope

These rules apply to:

- `apps/field-app/src/routes/supervisor/*.tsx`
- `apps/field-app/src/routes/supervisor/$updateId.*.tsx`
- shared view primitives in `apps/field-app/src/components/supervisor/` (re-exported from `supervisor-ui.tsx`)
- shared layout helpers in `apps/field-app/src/lib/`
- app shell in `apps/field-app/src/components/shell/` (wired from `__root.tsx`)

These rules do **not** override app-wide shell concerns already owned by:

- `apps/field-app/src/routes/__root.tsx` (delegates to `SupervisorRootLayout`)
- `apps/field-app/src/index.css`

## Source of Truth

### Layout primitives

The only approved source of truth for field route shell sizing and spacing is:

- `apps/field-app/src/lib/supervisor-layout.ts`

That file owns:

- page shell classes
- gradient page shell classes
- container width tokens
- sticky/non-sticky header wrapper classes
- shared header inner spacing

### Shared field-app UI primitives

The approved source of truth for repeated field-route-level UI patterns is:

- **Implementation:** `apps/field-app/src/components/supervisor/*.tsx` (modular files)
- **Stable import surface:** `apps/field-app/src/components/supervisor-ui.tsx` (barrel re-export)

That layer owns (non-exhaustive):

- `SupervisorPageHeader`, `SupervisorPageErrorState`, `SupervisorPageMessageState`, `SupervisorInlineAlert`
- `SupervisorSectionCard`, `SupervisorEmptyCard`, `SupervisorListPageHeader`
- `SupervisorEntityCard`, `SupervisorChipRow`, `SupervisorMetaRow`, `SupervisorMetaItem`, `SupervisorSplitActionBar`, `SupervisorStatsGrid`, `SupervisorListPaginationFooter`

Navigation chrome (sidebar, bottom nav, project selectors) lives in **`components/shell/`** with config in **`lib/navigation.ts`** — see [Web app structure](./web-app-structure.md).

## Invariants

### 1. Route files are composition layers

Field-app route files should own:

- route params
- queries and mutations
- page-local state
- mapping API data into view props

Field-app route files should not become the place where we define a new layout system.

### 2. All field-app pages must use shared page shell primitives

A field-app route must use `supervisor-layout.ts` primitives for:

- outer page wrapper
- width constraints
- header wrapper treatment
- standard page spacing

Do not introduce new one-off values like:

- bespoke `max-w-*` wrappers per page without adding a new shared width token
- bespoke `pb-*` compensation for mobile nav overlap
- bespoke sticky header spacing rules per route

If a new shell variant is needed, add it once to `supervisor-layout.ts`.

### 3. Repeated UI patterns must be extracted by the second use

If the same page-level JSX pattern exists in two or more field-app routes, it must move into a shared component instead of being copied again.

Examples:

- page header with title + description + back action
- sticky list header with refresh + filter pills
- red error state card
- empty result card
- bordered content section with icon/title/actions

### 4. List pages must use one list-header pattern

List pages such as tasks and updates must use `SupervisorListPageHeader`.

That means:

- title/count row stays consistent
- mobile refresh affordance stays consistent
- filter presentation stays consistent
- sticky header spacing stays consistent

If a list page needs a new variant, extend `SupervisorListPageHeader`; do not fork the pattern in-route.

### 5. Voice flow pages must use one flow-shell pattern

The record, review, and extraction flow must share:

- the `flow` container width
- a common top header pattern
- common section-card styling
- common error/message treatment

Do not let `/supervisor/record`, `/supervisor/$updateId/review`, and `/supervisor/$updateId/extraction` diverge into separate visual systems.

### 6. Error, empty, and message states are shared product language

The following are not route-specific inventions:

- load failure cards
- “not found” message screens
- no-data empty states
- inline destructive alerts

They must use the shared `Supervisor*` UI primitives unless there is a documented product reason not to.

### 7. Mobile safe-area and bottom-nav clearance are global concerns

Pages must assume that:

- mobile safe-area handling is owned by the root shell and global CSS
- baseline bottom clearance is owned by shared page classes

Do not patch around nav overlap inside a single page with local bottom padding unless the page has a page-specific floating action that genuinely requires extra room.

### 8. Section styling must be centralized

Bordered white content blocks used across field-app screens must come from a shared section-card abstraction instead of repeating:

- `bg-surface-primary`
- `border border-border-primary`
- `rounded-2xl`
- `p-5`

If the section treatment changes, we should be able to update it in one place.

### 9. New page chrome belongs in shared primitives first

Before adding any new page chrome, ask:

1. Is this route-specific content?
2. Or is this a reusable shell/section/state/header pattern?

If the answer is reusable, add it to the shared primitives first and then consume it from the route.

## TanStack Router: nested field-app routes

File-based routes under `apps/field-app/src/routes/supervisor/` may define **parent + child** paths (for example `/supervisor/tasks` with a child `/supervisor/tasks/$taskId`).

- The **parent route component must render `<Outlet />`** from `@tanstack/react-router` wherever a child route should appear. If the parent only renders the list UI and omits `<Outlet />`, navigation to the child URL will not mount the child screen (clicks can appear to do nothing).
- The current pattern for the task board is: **`tasks.tsx`** (layout, outlet only) + **`tasks.index.tsx`** (list) + **`tasks.$taskId.tsx`** (detail). Regenerate the route tree after adding or renaming route files: from `apps/field-app`, run `pnpm dlx @tanstack/router-cli generate` (or `pnpm generate-routes` if `tsr` is on `PATH`).

This is a **routing architecture** rule, not a visual design rule; it belongs here because field-app feature work repeatedly touches these files.

## Forbidden Patterns

The following are architecture violations unless there is a documented exception:

- parent route files that declare child routes but omit `<Outlet />` (broken nested navigation)
- duplicating the same error-card JSX across field-app routes
- duplicating the same “back + title + description” header across flow pages
- duplicating sticky list-filter headers across list pages
- introducing a new one-off container width directly in a route
- introducing page-local mobile nav compensation that bypasses shared layout classes
- copying a section-card pattern instead of using `SupervisorSectionCard`

## Allowed Route-Level Variation

Variation is still expected for:

- page-specific charts and cards
- page-specific forms and controls
- route-specific action buttons
- domain-specific list items like `TaskCard`, `UpdateCard`, or standup checklist rows

The invariant is not “all pages must look identical.”

The invariant is “shared structural patterns must have one implementation.”

## Change Workflow

When adding or changing a field-app page:

1. Start with `supervisor-layout.ts`, `components/shell/` (if chrome changes), and `components/supervisor/` (or import via `supervisor-ui.tsx`).
2. Reuse an existing primitive if it already matches the pattern.
3. If the pattern is new and reusable, extend the shared primitive layer first.
4. Keep the route focused on data + behavior.
5. Only add route-local structure when it is genuinely page-specific.

## Review Checklist

Any PR touching field-app routes should be reviewed against these questions:

- Did this add a new local shell pattern that should live in `supervisor-layout.ts`?
- Did this duplicate a reusable header, state card, or section container?
- Did this add page-local mobile spacing that should be global?
- Did this make one flow screen diverge from the other flow screens?
- Did this make one list page diverge from the list-header standard?

If the answer to any of these is “yes,” the PR is not done yet.

## Suggested Next Enforcement Steps

This document is the rule set. The next layer should be tooling and review support:

- add visual regression coverage for field-app routes at a mobile viewport
- add a PR checklist item for field-app UI invariants
- consider lightweight ESLint rules or codemod checks for duplicated shell patterns
- keep `supervisor-layout.ts` and the field-app primitive layer small and curated so teams actually reuse them

**90% round (2026-03):** standup summary and pilot metrics UIs use `SupervisorSectionCard` / `Card` within existing page shells; flow pages keep `SupervisorPageHeader` + shared layout tokens.

**2026-03 refactor:** shared app shell extracted to `components/shell/`; field-app primitives split into `components/supervisor/*` with barrel `supervisor-ui.tsx`; nav config centralized in `lib/navigation.ts`. See [Web app structure](./web-app-structure.md).

## Related Docs

- [Web app structure](./web-app-structure.md) (shell, primitives, navigation)
- [Web UI and Enact UI](./web-ui-enact-ui.md) (TanStack Router + Vite proxy details)
- [Mobile strategy](./mobile-strategy.md)
- [Phase 2 - Read models and field workspace](./phase-2-read-models-and-supervisor-workspace.md)
- [Phase 3 - Voice capture and transcript review](./phase-3-voice-capture-and-transcript-review.md)
- [Phase 4 - AI extraction and task creation loop](./phase-4-ai-extraction-and-task-creation-loop.md)
