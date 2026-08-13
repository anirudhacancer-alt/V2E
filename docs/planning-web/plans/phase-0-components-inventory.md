# Phase 0 — Components inventory & design tokens

## Goal

Establish the **planning-web design token layer** on top of Enact UI before any phase ships UI. This gives every later phase a consistent vocabulary for colors, spacing, typography, and shared layout primitives — the same role `supervisor-material-*` plays for field-app.

## What ships

- **Design token CSS file** — canonical Enact UI tokens + planning-web overrides
- **Planning shell component library** — wrapper components mirroring field-app supervisor patterns
- **Layout utility module** — `planning-layout.ts` equivalent to `supervisor-layout.ts`
- **Brand gradient module** — cohesive accent palette for planning console
- **Component inventory doc** — visual+code reference for every shared component

## ASCII shell layout (all phases)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px fixed)  │              TOP BAR (56px fixed)           │ RIGHT PANEL │
│                            │                                           │  (384px,    │
│  ┌──────────────────────┐  │  ┌─────────────┐ ┌──────┐ ┌──────┐ ┌────┐  │  collapsible)│
│  │  V2E Planning        │  │  │ 🔍 Search   │ │Saved │ │Filter│ │User│  │             │
│  │  ─────────────────   │  │  │             │ │Views │ │     │ │Menu│  │  ┌────────┐ │
│  │  ◀ Review Queue      │  │  └─────────────┘ └──────┘ └──────┘ └────┘  │  │ Detail │ │
│  │    Tasks             │  │                                          │  │ Drawer │ │
│  │    Commitments       │  │  ┌──────────────────────────────────────┐ │  │        │ │
│  │    Tech Review       │  │  │                                      │ │  │  Task  │ │
│  │    Blockers          │  │  │         MAIN CONTENT                  │ │  │  Item  │ │
│  │    Standup           │  │  │         (scrollable)                  │ │  │  etc.  │ │
│  │    Schedule          │  │  │                                      │ │  │        │ │
│  │    ──────────────    │  │  │  ┌──────────┐ ┌──────────┐           │ │  └────────┘ │
│  │    Reports           │  │  │  │ Table    │ │ Board    │           │ │             │
│  │    Admin             │  │  │  │ View     │ │ View     │           │ │             │
│  └──────────────────────┘  │  │  └──────────┘ └──────────┘           │ │             │
│                            │  └──────────────────────────────────────┘ │             │
│  [workspace context]       │                                          │             │
└────────────────────────────┴──────────────────────────────────────────┴─────────────┘
```

### Left Rail anatomy

```
┌─────────────────────────┐
│  V2E Planning   [─][□]  │  ← Logo + workspace switcher (phase 1)
│  ─────────────────────   │  ← Hairline divider
│  ◀ Review Queue         │  ← Active nav item (brand accent left border)
│    Tasks                │  ← Inactive nav item (ghost button)
│    Commitments          │
│    Tech Review          │
│    Blockers             │
│    Standup              │
│    Schedule             │
│  ─────────────────────   │  ← Section divider
│    Reports              │
│    Admin                │
│  ─────────────────────   │
│  [Project / Site ctx]   │  ← Workspace context footer (phase 1 placeholder)
└─────────────────────────┘
```

### Top Bar anatomy

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────┐  ┌────────┐  ┌────────┐  ┌────────┐ │
│ │ 🔍 Search or jump to...      │  │ Saved  │  │ Filter │  │ User   │ │
│ └──────────────────────────────┘  │ Views  │  │ Panel  │  │ Menu   │ │
│                                     └────────┘  └────────┘  └────────┘ │
│  [breadcrumbs / page title]                               [actions]   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Right Panel anatomy (detail drawer)

```
┌─────────────────────────────────────┐
│  ✕  [Title]              [actions]  │  ← Header with close + actions
│  ─────────────────────────────────  │
│                                     │
│  [metadata grid]                    │
│                                     │
│  [tab bar: Details | Activity]      │
│                                     │
│  [scrollable content]               │
│                                     │
│  ─────────────────────────────────  │
│  [footer: Primary Action]           │  ← CTA (Save, Approve, Reject, etc.)
└─────────────────────────────────────┘
```

## Design token layer

### Base: Enact UI tokens (read-only)

Planning-web inherits all Enact UI tokens without modification:

| Token | Value | Role |
|-------|-------|------|
| `--color-surface-base` | `#FFFFFF` / `#111316` | Page canvas |
| `--color-surface-raised` | elevated surfaces | Cards, panels |
| `--color-surface-primary` | primary controls | Inputs, focused elements |
| `--color-surface-secondary` | secondary surfaces | Subtle backgrounds |
| `--color-surface-brand` | `#147F80` teal | Brand accent (light) |
| `--color-content-primary` | primary text | Body, headings |
| `--color-content-secondary` | muted text | Labels, captions |
| `--color-border-muted` | hairline borders | Dividers |
| `--color-border-default` | default borders | Card outlines |
| `--font-body` | system sans | All typography |

### Planning-web token overrides

These override Enact UI tokens for the planning surface:

```css
/* Planning surface tokens */
:root {
  --color-surface-brand: oklch(65% 0.15 185);      /* Deeper teal — more "ops" than field */
  --color-surface-brand-subtle: oklch(95% 0.03 185);
  --color-surface-brand-muted: oklch(88% 0.06 185);
  
  --color-content-on-brand: #ffffff;
  
  --color-ring-brand: oklch(65% 0.15 185);
  
  /* Planning-specific semantic colors */
  --color-planning-amber: oklch(75% 0.15 75);     /* Commitments, deadlines */
  --color-planning-amber-subtle: oklch(95% 0.05 75);
  --color-planning-violet: oklch(65% 0.18 300);    /* Technical review, discipline accents */
  --color-planning-violet-subtle: oklch(95% 0.05 300);
  --color-planning-slate: oklch(55% 0.05 250);     /* Admin, settings */
  --color-planning-slate-subtle: oklch(95% 0.03 250);
}
```

### Planning material classes

Analogous to field-app's `supervisor-material-*`, planning-web gets `planning-material-*`:

| Class | Purpose | Light mode | Dark mode |
|-------|---------|------------|-----------|
| `planning-material-page` | Page canvas | `--color-surface-base` + subtle radial gradient | `#0f1214` + vertical gradient |
| `planning-material-card` | Raised card surface | white + inner top highlight + soft shadow | `#1a1d21` + layered shadow |
| `planning-material-card-raised` | Elevated card variant | stronger shadow, higher contrast border | stronger shadow |
| `planning-material-frost` | Frosted glass header | `backdrop-blur-md` + `bg-surface-primary/80` | same with dark tint |
| `planning-material-panel` | Sidebar/panel surface | `--color-surface-secondary` | darker panel |
| `planning-material-border` | Default card border | `1px solid var(--color-border-default)` | same |
| `planning-material-divider` | Section divider | `border-t border-border-muted` | same |
| `planning-material-interactive` | Press state | `scale(0.98)` on active | same |
| `planning-material-nav-item` | Nav list item | hover: `bg-surface-secondary` | hover: `bg-surface-raised` |
| `planning-material-nav-item-active` | Active nav item | left `3px solid var(--color-surface-brand)` + subtle bg | same |
| `planning-material-badge-commitment` | Commitment badge | amber bg | amber dark |
| `planning-material-badge-technical-review` | Technical review badge | violet bg | violet dark |
| `planning-material-badge-sla` | SLA/schedule badge | slate bg | slate dark |

### Typography scale

```
Display:   text-2xl font-bold tracking-tight        /* Page titles */
Heading:   text-lg font-semibold                    /* Section headers */
Subhead:   text-sm font-medium text-content-secondary  /* Subheadings */
Body:      text-sm leading-relaxed                  /* Default text */
Caption:   text-xs text-content-tertiary            /* Metadata, timestamps */
Label:     text-xs font-medium uppercase tracking-wider  /* Field labels */
Mono:      font-mono text-xs                        /* IDs, codes */
```

### Spacing scale

Based on 4px grid, planning density is tighter than field-app:

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Icon gaps, dense list |
| `--space-2` | 8px | Component internal padding |
| `--space-3` | 12px | Compact list rows, table cells |
| `--space-4` | 16px | Card padding (default) |
| `--space-5` | 20px | Section spacing |
| `--space-6` | 24px | Major section gaps |
| `--space-8` | 32px | Page-level padding |

### Border radius

| Class | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Badges, small chips |
| `rounded-md` | 6px | Inputs, small buttons |
| `rounded-lg` | 8px | Cards (planning — tighter than field) |
| `rounded-xl` | 12px | Modals, popovers |
| `rounded-full` | 9999px | Pills, avatars |

Note: Planning uses `rounded-lg` for cards (not `rounded-3xl` like field-app) to signal a more "operational" aesthetic.

## Component inventory

### Shell components

| Component | File | Description |
|-----------|------|-------------|
| `PlanningRootLayout` | `shell/planning-root-layout.tsx` | App shell — Three-region layout (left rail, main, right panel) |
| `PlanningLeftRail` | `shell/planning-left-rail.tsx` | Left nav rail (256px) with logo, nav items, workspace context |
| `PlanningTopBar` | `shell/planning-top-bar.tsx` | Top bar (56px) with search, saved views, filter toggle, user menu |
| `PlanningRightPanel` | `shell/planning-right-panel.tsx` | Detail drawer (384px, collapsible) |
| `NavItem` | `shell/nav-item.tsx` | Single nav item (icon + label + optional badge) |
| `NavSection` | `shell/nav-section.tsx` | Grouped nav items with section label |
| `WorkspaceSwitcher` | `shell/workspace-switcher.tsx` | Project/org context switcher in left rail header |

### Layout utilities (`planning-layout.ts`)

| Export | Value | Purpose |
|--------|-------|---------|
| `planningPageClass` | `"min-h-screen planning-material-page"` | Page canvas |
| `planningContainerClass(width?)` | `"mx-auto w-full px-6"` + max-width | Container widths |
| `planningCardRadiusClass` | `"rounded-lg"` | Card corner radius |
| `planningControlRadiusClass` | `"rounded-md"` | Input/button radius |
| `planningPanelWidthClass` | `"w-96"` | Right panel width |
| `planningLeftRailWidthClass` | `"w-64"` | Left rail width |
| `cx(...)` | utility | Class name merger |

### Card components

| Component | File | Wraps | Usage |
|-----------|------|-------|-------|
| `PlanningSectionCard` | `cards/planning-section-card.tsx` | Enact `Card` | Grouped content with title/icon/actions |
| `PlanningEntityCard` | `cards/planning-entity-card.tsx` | Enact `Card` | List item for Task, ReviewItem, Blocker, etc. |
| `PlanningStatCard` | `cards/planning-stat-card.tsx` | Enact `Card` | KPI tile (value + label + trend) |
| `PlanningTimelineCard` | `cards/planning-timeline-card.tsx` | Enact `Card` | Timeline event item |
| `PlanningCommitmentCard` | `cards/planning-commitment-card.tsx` | Enact `Card` | Commitment item with progress |
| `PlanningBlockerCard` | `cards/planning-blocker-card.tsx` | Enact `Card` | Blocker item with severity |
| `PlanningReviewItemCard` | `cards/planning-review-item-card.tsx` | Enact `Card` | Review queue item |

### Button components

| Component | File | Wraps | Usage |
|-----------|------|-------|-------|
| `PlanningCtaButton` | `buttons/planning-cta-button.tsx` | Enact `Button` | Primary brand action (teal gradient) |
| `PlanningSecondaryButton` | `buttons/planning-secondary-button.tsx` | Enact `Button` | Secondary action (outline/ghost) |
| `PlanningDangerButton` | `buttons/planning-danger-button.tsx` | Enact `Button` | Destructive actions (red) |
| `PlanningIconButton` | `buttons/planning-icon-button.tsx` | Enact `Button` | Icon-only button (toolbar, card actions) |
| `PlanningBulkActionButton` | `buttons/planning-bulk-action-button.tsx` | Enact `Button` | Checkbox + action combo for bulk ops |

### Form components

| Component | File | Wraps | Usage |
|-----------|------|-------|-------|
| `PlanningInput` | `forms/planning-input.tsx` | native `<input>` | Text input with planning styling |
| `PlanningSelect` | `forms/planning-select.tsx` | native `<select>` | Styled select |
| `PlanningTextarea` | `forms/planning-textarea.tsx` | native `<textarea>` | Multi-line input |
| `PlanningCheckbox` | `forms/planning-checkbox.tsx` | native `<input type="checkbox">` | Checkbox with label |
| `PlanningToggle` | `forms/planning-toggle.tsx` | Enact `Toggle` | Toggle switch |
| `PlanningFilterChip` | `forms/planning-filter-chip.tsx` | div + button | Filter tag (removable) |
| `PlanningSearchInput` | `forms/planning-search-input.tsx` | `PlanningInput` | Search input with icon |

### Data display components

| Component | File | Wraps | Usage |
|-----------|------|-------|-------|
| `PlanningBadge` | `badges/planning-badge.tsx` | Enact `Badge` | Status, severity badges |
| `PlanningAvatar` | `avatars/planning-avatar.tsx` | Enact `Avatar` | User avatar |
| `PlanningChip` | `chips/planning-chip.tsx` | div | Tag, category chip |
| `PlanningChipRow` | `chips/planning-chip-row.tsx` | div | Row of chips with overflow |
| `PlanningMetaRow` | `meta/planning-meta-row.tsx` | div | Key-value metadata row |
| `PlanningProgressBar` | `progress/planning-progress-bar.tsx` | div | Progress indicator |
| `PlanningSkeleton` | `states/planning-skeleton.tsx` | Enact `Skeleton` | Loading placeholder |
| `PlanningEmptyState` | `states/planning-empty-state.tsx` | Enact `EmptyState` | Empty state display |
| `PlanningErrorState` | `states/planning-error-state.tsx` | div | Error state display |

### Layout/page structure components

| Component | File | Usage |
|-----------|------|-------|
| `PlanningPageHeader` | `page/planning-page-header.tsx` | Page title + subtitle + actions |
| `PlanningListPageHeader` | `page/planning-list-page-header.tsx` | List page header with bulk-select |
| `PlanningSplitActionBar` | `page/planning-split-action-bar.tsx` | Bottom action bar (cancel/confirm) |
| `PlanningTabBar` | `tabs/planning-tab-bar.tsx` | Tab navigation for panel/detail |
| `PlanningCollapsibleSection` | `layout/planning-collapsible-section.tsx` | Collapsible content section |
| `PlanningStatsGrid` | `layout/planning-stats-grid.tsx` | KPI grid (2-4 columns) |
| `PlanningListPaginationFooter` | `list/planning-list-pagination-footer.tsx` | Pagination controls |
| `PlanningCompactListHeader` | `list/planning-compact-list-header.tsx` | Sortable column headers |

### List/table components

| Component | File | Usage |
|-----------|------|-------|
| `PlanningDataTable` | `table/planning-data-table.tsx` | Sortable, selectable data table |
| `PlanningTableRow` | `table/planning-table-row.tsx` | Single table row |
| `PlanningTableCell` | `table/planning-table-cell.tsx` | Single table cell |
| `PlanningBoardColumn` | `board/planning-board-column.tsx` | Kanban column (status lane) |
| `PlanningBoardCard` | `board/planning-board-card.tsx` | Kanban card (draggable) |
| `PlanningTimeline` | `timeline/planning-timeline.tsx` | Timeline container |
| `PlanningTimelineRow` | `timeline/planning-timeline-row.tsx` | Single timeline row |

### Detail/panel components

| Component | File | Usage |
|-----------|------|-------|
| `PlanningDetailHeader` | `detail/planning-detail-header.tsx` | Panel header (title, close, actions) |
| `PlanningDetailSection` | `detail/planning-detail-section.tsx` | Metadata section in detail panel |
| `PlanningDetailActivity` | `detail/planning-detail-activity.tsx` | Activity feed in detail panel |

## Routes

Phase 0 is infrastructure-only — no routes added.

## Key data entities

None — this phase is pure UI infrastructure.

## Exit criteria

- `planning-material-*` CSS classes defined and documented
- `Planning*` wrapper components available via barrel export
- `planning-layout.ts` utility exports functional
- Dark mode works for all planning-material classes
- No imports of field-app React components or supervisor-material classes

## Dependencies

- `@enact-ui/react` installed and themed for planning-web
- `packages/contracts` for type references
- No API dependency

## Files to create

```
apps/planning-web/src/
├── index.css                          # Token layer + planning-material-* classes
├── lib/
│   ├── planning-layout.ts            # Layout utility exports (cx, container classes, etc.)
│   ├── planning-color-scheme.ts       # Dark mode initialization (mirrors field-app)
│   └── brand-gradient.ts              # Brand gradient classes for planning
└── components/
    └── planning/
        ├── shell/                     # Shell components (8 files)
        ├── cards/                      # Card wrappers (7 files)
        ├── buttons/                    # Button variants (5 files)
        ├── forms/                      # Form components (7 files)
        ├── badges/                     # Badge components (1 file)
        ├── avatars/                    # Avatar components (1 file)
        ├── chips/                      # Chip components (2 files)
        ├── meta/                       # Metadata components (1 file)
        ├── progress/                   # Progress components (1 file)
        ├── states/                     # Empty/error/skeleton states (3 files)
        ├── page/                       # Page structure (3 files)
        ├── tabs/                       # Tab components (1 file)
        ├── layout/                     # Layout components (2 files)
        ├── list/                       # List components (2 files)
        ├── table/                      # Table components (3 files)
        ├── board/                      # Kanban components (2 files)
        ├── timeline/                   # Timeline components (2 files)
        └── detail/                     # Detail panel components (3 files)
        └── index.ts                    # Barrel export for all planning components
```

Parent: [`AGENTS.md`](AGENTS.md).
