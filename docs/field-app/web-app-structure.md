# Web app structure (`apps/field-app`)

Audit date: `2026-03-24`

## Purpose

Describe how **V2E web** organizes routes, the **app shell**, and **shared field app UI** so new work extends existing boundaries instead of duplicating layout and chrome.

For Enact UI consumption, Vite, and Tailwind, see [Web UI and Enact UI](./web-ui-enact-ui.md). For behavioral rules on field-app screens, see [Field app UI invariants](./field-app-ui-invariants.md).

## Route entry and shell

| Location | Role |
| -------- | ---- |
| [`apps/field-app/src/routes/__root.tsx`](../../apps/field-app/src/routes/__root.tsx) | Root route only: renders `SupervisorRootLayout` (thin file). |
| [`apps/field-app/src/components/shell/supervisor-root-layout.tsx`](../../apps/field-app/src/components/shell/supervisor-root-layout.tsx) | **App shell:** desktop sidebar, mobile header, main `<Outlet />`, mobile bottom nav + Record FAB. |
| [`apps/field-app/src/components/shell/`](../../apps/field-app/src/components/shell/) | Shell pieces: `desktop-sidebar`, `mobile-header`, `mobile-bottom-nav`, `project-select` (desktop vs mobile). |
| [`apps/field-app/src/lib/navigation.ts`](../../apps/field-app/src/lib/navigation.ts) | Shared nav item config (`supervisorSidebarNavItems`, `supervisorBottomNavItems`), record path, `isRecordRouteActive`, `isNavPathActive`. |

Global mobile safe-area and bottom padding for nav clearance remain in [`apps/field-app/src/lib/supervisor-layout.ts`](../../apps/field-app/src/lib/supervisor-layout.ts) (`supervisorPageClass`, etc.) and global CSS as documented in [Web UI and Enact UI](./web-ui-enact-ui.md).

## Field app UI primitives

| Location | Role |
| -------- | ---- |
| [`apps/field-app/src/components/supervisor/`](../../apps/field-app/src/components/supervisor/) | Modular components: page header, list header, section/empty/error states, entity list cards, chip/meta rows, split action bar, stats grid, pagination footer. |
| [`apps/field-app/src/components/supervisor-ui.tsx`](../../apps/field-app/src/components/supervisor-ui.tsx) | **Barrel re-export** of `./supervisor` for stable imports from routes (`import { … } from "../../components/supervisor-ui"`). |

Prefer **Enact** primitives (`Button`, `Card`, `Badge`, `EmptyState`, …) inside these wrappers; see [web-reusable-components.md](./web-reusable-components.md) for contributor notes.

## Layout helpers

| Location | Role |
| -------- | ---- |
| [`apps/field-app/src/lib/supervisor-layout.ts`](../../apps/field-app/src/lib/supervisor-layout.ts) | `cx`, `supervisorContainerClass`, `supervisorPageClass`, `supervisorHeaderClass`, container width tokens. |
| [`apps/field-app/src/lib/project-context.tsx`](../../apps/field-app/src/lib/project-context.tsx) | Current project and project list for shell + routes. |
| [`apps/field-app/src/lib/api.ts`](../../apps/field-app/src/lib/api.ts) | Typed API client; mutations send `Authorization` when configured. |

## Supervisor routes

File-based routes live under [`apps/field-app/src/routes/supervisor/`](../../apps/field-app/src/routes/supervisor/). Nested layouts (e.g. tasks list + detail) use a parent file with `<Outlet />` — see [Field app UI invariants](./field-app-ui-invariants.md#tanstack-router-nested-field-app-routes).

## Related docs

- [Field app UI invariants](./field-app-ui-invariants.md)
- [Web UI and Enact UI](./web-ui-enact-ui.md)
- [Web reusable components (contributor)](./web-reusable-components.md)
