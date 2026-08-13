# Phase 1 — Shell and navigation

## Goal

Deliver the planning console **app shell** and **route structure** so every later phase plugs into a stable layout and URL scheme. This phase **depends on Phase 0** completing the design token layer.

## What ships

### Shell regions (anatomy)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (hidden    │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │  until      │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │  phase 2+)  │
│  │  ───────────────  │  │  │                  │ │Views │ │     │ │Menu│ │             │
│  │  ◀ Review Queue   │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │    Tasks          │  │                                                  │             │
│  │    Commitments    │  │  ┌──────────────────────────────────────────────┐│             │
│  │    Tech Review    │  │  │                                              ││             │
│  │    Blockers       │  │  │         MAIN CONTENT                         ││             │
│  │    Standup         │  │  │         (Outlet — phases 2+ plug in here)   ││             │
│  │    Schedule        │  │  │                                              ││             │
│  │  ──────────────    │  │  │  ┌──────────────────────────────────────────┐││             │
│  │    Reports         │  │  │  │                                          │││             │
│  │    Admin           │  │  │  │   [ Empty state: "Select a workspace" ]  │││             │
│  └───────────────────┘  │  │  │                                          │││             │
│                          │  │  └──────────────────────────────────────────┘││             │
│  [workspace placeholder]│  └──────────────────────────────────────────────┘│             │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Left Rail (256px, fixed)

```
┌─────────────────────────┐
│  V2E Planning   [─][□]   │  ← Logo + window controls (minimize, maximize)
│  ─────────────────────  │
│  ◀ Review Queue          │  ← Active state: left 3px brand border + bg tint
│    Tasks                 │  ← Inactive: ghost button style
│    Commitments           │      (hover → bg-surface-secondary)
│    Tech Review           │
│    Blockers              │
│    Standup               │
│    Schedule              │
│  ─────────────────────    │
│    Reports               │
│    Admin                 │
│  ─────────────────────    │
│  [Project / Site ctx]   │  ← Placeholder: "Select workspace" dropdown
└─────────────────────────┘
```

### Top Bar (56px, fixed)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────┐  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │  🔍 Search or jump to...    │  │ Saved  │  │ Filter │  │ User   │        │
│  │                             │  │ Views  │  │ Panel  │  │ Menu   │        │
│  └─────────────────────────────┘  └────────┘  └────────┘  └────────┘        │
│                                                                               │
│  [breadcrumb: Planning Console]                           [Import] [+ New]  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Responsive behavior

- **< 1024px (tablet/mobile):** Left rail collapses to icon-only (48px) or hidden; bottom tab bar appears
- **≥ 1024px (desktop):** Left rail always visible at 256px; right panel slides in as overlay/drawer
- **≥ 1440px (wide desktop):** Right panel can pin at 384px alongside main content

## Components built in this phase

### Shell components

| Component | File | Description |
|-----------|------|-------------|
| `PlanningRootLayout` | `shell/planning-root-layout.tsx` | Three-region shell; renders `PlanningLeftRail`, `PlanningTopBar`, `<Outlet />` |
| `PlanningLeftRail` | `shell/planning-left-rail.tsx` | 256px fixed left nav; logo, nav items, workspace context footer |
| `PlanningTopBar` | `shell/planning-top-bar.tsx` | 56px fixed top; search stub, saved views, filter toggle, user menu |
| `WorkspaceSwitcher` | `shell/workspace-switcher.tsx` | Project/site/org context switcher (stub: non-functional dropdown) |
| `NavItem` | `shell/nav-item.tsx` | Single nav item; accepts `icon`, `label`, `badge?`, `active`, `to` |
| `NavSection` | `shell/nav-section.tsx` | Grouped nav with section label divider |

### Page structure components

| Component | File | Description |
|-----------|------|-------------|
| `PlanningPageHeader` | `page/planning-page-header.tsx` | Page title + optional subtitle + right-side actions slot |
| `PlanningEmptyShellState` | `states/planning-empty-shell-state.tsx` | Full-page empty state shown when no child route is active |

### Layout utilities (Phase 0 dependency)

All Phase 0 layout utilities (`planning-layout.ts`, `cx()`, `planningContainerClass()`, etc.) must be available before building shell components.

## Key data entities

- **Org context only** — `Project`, `Site`, `Team` selection wired to contracts when auth/session exists
- No persistence in this phase; context stored in React context from `useProject()` (mirrors field-app pattern)

## Routes

```
/console                        → redirect to /console/review-queue
/console/review-queue           → Review queue workspace (Phase 2, stub = empty state)
  /console/review-queue/:itemId → Review item detail (Phase 2)
/console/*                     → All other routes reserved; 404 if accessed before phase ships
```

Router: **TanStack Router** (per repo standard). Route tree auto-generated.

### Route tree structure

```
consoleRoute.ts (layout route)
├── consoleIndexRoute.ts        → redirect to review-queue
├── reviewQueueRoute.ts         → /console/review-queue (Phase 2 stub)
├── reviewQueueItemRoute.ts     → /console/review-queue/:itemId (Phase 2)
├── tasksRoute.ts               → /console/tasks (Phase 3, reserved)
├── commitmentsRoute.ts         → /console/commitments (Phase 4, reserved)
├── technicalReviewRoute.ts     → /console/technical-review (Phase 5, reserved)
├── blockersRoute.ts            → /console/blockers (Phase 5, reserved)
├── blockersItemRoute.ts        → /console/blockers/:blockerId (Phase 5)
├── standupRoute.ts             → /console/standup (Phase 6, reserved)
├── standupSessionRoute.ts      → /console/standup/:sessionId (Phase 6)
├── scheduleRoute.ts            → /console/schedule (Phase 6, reserved)
├── reportsRoute.ts             → /console/reports (Phase 7, reserved)
└── adminRoute.ts               → /console/admin (Phase 7, reserved)
```

## Design token usage in this phase

| Token | Applied where |
|-------|--------------|
| `--color-surface-base` | Page canvas (`planning-material-page`) |
| `--color-surface-raised` | Left rail background |
| `--color-surface-primary` | Top bar background |
| `--color-surface-brand` | Active nav item accent |
| `--color-content-primary` | Nav labels, page titles |
| `--color-content-secondary` | Inactive nav labels, placeholders |
| `--color-border-muted` | Left rail dividers |
| `planning-material-page` | Main content canvas |
| `planning-material-panel` | Left rail surface |
| `planning-material-frost` | Top bar |
| `planning-material-nav-item` | Nav item base style |
| `planning-material-nav-item-active` | Active nav item |

## Exit criteria

1. Dev server (`pnpm --filter @v2e/planning-web dev`) loads the shell at `localhost:3002`
2. Navigation via left rail nav items switches routes without full reload
3. All Phase 2–7 routes exist but render `PlanningEmptyShellState` or redirect
4. No imports of `apps/field-app` React component trees or `supervisor-material-*` classes
5. `planning-material-*` CSS classes applied consistently
6. Dark mode toggle works for all shell regions (top bar, left rail, content area)
7. Responsive collapse at < 1024px tested (left rail → hamburger or icon rail)

## Out of scope (later phases)

- Functional search (Phase 2+)
- Filter panel (Phase 2+)
- Right panel / detail drawer (Phase 2+)
- Any data fetching or API calls
- Review queue list content
- Task workspace views
- Any CRUD operations

## Dependencies

- **Phase 0** must be complete before this phase starts
- `@enact-ui/react` themed for planning-web
- `packages/contracts` for type references
- `packages/shared` for utilities if needed

## Files created in this phase

```
apps/planning-web/src/
├── routes/
│   ├── __root.tsx                    # Console layout route (PlanningRootLayout)
│   ├── console/
│   │   ├── index.tsx                 # Redirect to review-queue
│   │   ├── reviews.tsx          # Phase 2 stub (empty state)
│   │   ├── review-queue.$itemId.tsx  # Phase 2 stub
│   │   ├── tasks.tsx                 # Reserved (Phase 3)
│   │   ├── tasks.board.tsx           # Reserved (Phase 3)
│   │   ├── tasks.timeline.tsx        # Reserved (Phase 3)
│   │   ├── tasks.$taskId.tsx         # Reserved (Phase 3)
│   │   ├── commitments.tsx           # Reserved (Phase 4)
│   │   ├── technical-review.tsx      # Reserved (Phase 5)
│   │   ├── blockers.tsx              # Reserved (Phase 5)
│   │   ├── blockers.$blockerId.tsx   # Reserved (Phase 5)
│   │   ├── standup.tsx               # Reserved (Phase 6)
│   │   ├── standup.$sessionId.tsx    # Reserved (Phase 6)
│   │   ├── schedule.tsx              # Reserved (Phase 6)
│   │   ├── reports.tsx               # Reserved (Phase 7)
│   │   └── admin.tsx                  # Reserved (Phase 7)
│   └── routeTree.gen.ts               # Auto-generated
├── components/
│   └── planning/
│       ├── shell/                     # Phase 0 component files (see phase-0)
│       │   ├── planning-root-layout.tsx
│       │   ├── planning-left-rail.tsx
│       │   ├── planning-top-bar.tsx
│       │   ├── workspace-switcher.tsx
│       │   ├── nav-item.tsx
│       │   └── nav-section.tsx
│       ├── page/                      # Phase 0 component files
│       │   ├── planning-page-header.tsx
│       │   └── planning-empty-shell-state.tsx
│       └── index.ts                   # Barrel
└── lib/
    ├── planning-layout.ts            # Phase 0 utility module
    ├── planning-color-scheme.ts       # Phase 0 dark mode init
    └── brand-gradient.ts              # Phase 0 brand gradients
```

Parent: [`AGENTS.md`](AGENTS.md).
