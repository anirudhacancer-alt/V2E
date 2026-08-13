# Web app reusable components

This document describes how field app UI is organized after the reusable-components refactor.

## Import paths

- **Supervisor primitives** (headers, list chrome, entity cards, empty/error states): import from `apps/field-app/src/components/supervisor-ui.tsx` (re-exports everything) or `apps/field-app/src/components/supervisor/index.ts` directly.
- **App shell** (desktop sidebar, mobile header, bottom nav, project selects): `apps/field-app/src/components/shell/index.ts`.
- **Navigation config** (paths, active helpers): `apps/field-app/src/lib/navigation.ts`.

## Route vs feature code

- **Route files** under `apps/field-app/src/routes/` should stay small: wiring data (TanStack Query), `createFileRoute`, and composing shared components.
- **Reusable UI** belongs in `components/supervisor/*` or `components/shell/*`, built on `@enact-ui/react` (and other `@enact-ui/*` packages) where possible.

## Enact UI first

- Prefer **Enact** primitives (`Button`, `Card`, `Badge`, `EmptyState`, etc.) before adding bespoke markup.
- Patterns that are **generic** and stable should be **upstreamed** to the Enact monorepo (`../enact-ui`) with a changeset, instead of living only in V2E.

## Verification

After changing shared components:

```bash
pnpm --filter @v2e/field-app typecheck
pnpm test
```
