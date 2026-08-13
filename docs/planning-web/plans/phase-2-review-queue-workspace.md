# Phase 2 — Review queue workspace

## Goal

Ship the **default landing** experience: human review of AI extraction / review items at planning speed. This is the first productive workspace users encounter.

**Prerequisite:** Phase 1 (shell) must be complete.

## What ships

### Workspace layout (split: list + detail)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (384px)    │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │             │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │             │
│  │  ───────────────  │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │  ▶ Review Queue   │  │                                                  │             │
│  │    Tasks          │  │  [ Review Queue ]                   [filters] │             │
│  │    Commitments    │  │  ─────────────────────────────────────────────│             │
│  │    Tech Review    │  │                                                  │             │
│  │    Blockers       │  │  ┌─────────────────────┐  ┌────────────────────┐ │  ┌────────┐ │
│  │    Standup        │  │  │  REVIEW QUEUE LIST  │  │   RIGHT PANEL      │ │  │ Detail │ │
│  │    Schedule       │  │  │  ────────────────   │  │   ─────────────   │ │  │ Drawer │ │
│  │  ──────────────    │  │  │ □ [item card]      │◀─│                   │ │  │        │ │
│  │    Reports        │  │  │ □ [item card]      │  │  [ReviewItem]      │ │  │ Extracted│
│  │    Admin          │  │  │ ■ [item card] ←sel │  │  Detail            │ │  │  Data   │ │
│  └───────────────────┘  │  │ □ [item card]      │  │                   │ │  │        │ │
│                          │  │ □ [item card]      │  │  [Approve][Reject]│ │  │        │ │
│  [workspace context]    │  └─────────────────────┘  └────────────────────┘ │  └────────┘ │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Review queue list anatomy

```
┌─────────────────────────────────────┐
│  Review Queue        [All ◀ ▼] [⋮] │  ← Header: title, filter dropdown, menu
│  ─────────────────────────────────  │
│  ┌─────────────────────────────────┐│
│  │ □ Urgent: Site access issue    ││  ← PlanningReviewItemCard
│  │   Trade: Electrical  ·  2h ago  ││    - Checkbox (for bulk select)
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ ■ Safety check needed           ││  ← Selected (brand left border)
│  │   Severity: High  ·  45m ago   ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ □ Material delivery delayed     ││
│  │   Severity: Medium  ·  1d ago   ││
│  └─────────────────────────────────┘│
│  ...                                │
│  ─────────────────────────────────  │
│  [Bulk: 3 selected] [Approve] [Reject] │  ← BulkActionBar (appears when checked)
└─────────────────────────────────────┘
```

### Right panel detail anatomy

```
┌─────────────────────────────────────┐
│  ✕  Review Item              [⋯]   │  ← Close button + kebab menu
│  ─────────────────────────────────  │
│                                     │
│  ⚠️ High · Electrical               │  ← PlanningBadge (severity + trade)
│                                     │
│  ## Extracted Summary              │
│  "Site access gate B is blocked    │
│   by stored materials. Safety      │
│   check required before resuming." │
│                                     │
│  ─────────────────────────────────  │
│  ## Original Transcript            │
│  "Hey, we got a safety issue at    │
│   gate B, materials are blocking  │
│   the access..."                    │
│                                     │
│  ─────────────────────────────────  │
│  ## Linked Task                     │
│  [Task: Clear gate B access]        │  ← PlanningEntityCard (compact)
│                                     │
│  ─────────────────────────────────  │
│  ## Extracted Fields               │
│  Location: Gate B                  │
│  Trade: Electrical                │
│  Severity: High                    │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [Reject]              [Approve ✓] │  ← PlanningSplitActionBar
└─────────────────────────────────────┘
```

## Components built in this phase

### List components

| Component | File | Description |
|-----------|------|-------------|
| `ReviewQueuePage` | `review-queue/review-queue-page.tsx` | Main page: split layout (list + detail) |
| `ReviewQueueList` | `review-queue/review-queue-list.tsx` | Scrollable list of `PlanningReviewItemCard` |
| `ReviewQueueListHeader` | `review-queue/review-queue-list-header.tsx` | Title, filter dropdown, column toggle |
| `ReviewQueueItemCard` | `review-queue/review-queue-item-card.tsx` | Single item in queue; wraps `PlanningEntityCard` |
| `ReviewQueueBulkActionBar` | `review-queue/review-queue-bulk-action-bar.tsx` | Appears when items checked; approve/reject |
| `ReviewQueueFilters` | `review-queue/review-queue-filters.tsx` | Filter panel (severity, trade, date range) |

### Detail panel components

| Component | File | Description |
|-----------|------|-------------|
| `ReviewItemDetailPanel` | `review-queue/review-item-detail-panel.tsx` | Full detail panel content |
| `ReviewItemExtractedData` | `review-queue/review-item-extracted-data.tsx` | AI extraction output display |
| `ReviewItemTranscriptBlock` | `review-queue/review-item-transcript-block.tsx` | Original transcript display |
| `ReviewItemLinkedTask` | `review-queue/review-item-linked-task.tsx` | Linked task preview card |
| `ReviewItemActions` | `review-queue/review-item-actions.tsx` | Approve/reject action buttons |

### Form components

| Component | File | Description |
|-----------|------|-------------|
| `RejectDialog` | `review-queue/reject-dialog.tsx` | Modal dialog for rejection reason |
| `BulkRejectDialog` | `review-queue/bulk-reject-dialog.tsx` | Modal dialog for bulk rejection |

### Shared (Phase 0)

All card wrappers, badges, buttons, and layout utilities come from Phase 0.

## Key data entities

| Entity | Source | Notes |
|--------|--------|-------|
| `ReviewItem` | `@v2e/contracts` | Queue item with AI extraction output |
| `Update` | `@v2e/contracts` | Source update linked to review item |
| `Task` | `@v2e/contracts` | Linked task (if extracted) |
| `Severity` | `@v2e/contracts` enum | `high` / `medium` / `low` |
| `Trade` | `@v2e/contracts` enum | Trade category |

## Routes

```
/console/review-queue              → ReviewQueuePage (split layout, empty if no selection)
/console/review-queue/:itemId     → Same page with itemId selected in detail panel
```

## Design token usage

| Token | Applied where |
|-------|--------------|
| `--color-planning-amber` | Severity badge background (high/warning) |
| `--color-planning-amber-subtle` | Severity badge text |
| `planning-material-nav-item-active` | Review Queue nav item |
| `rounded-lg` | All cards (planning radius, not field radius) |
| `planning-material-border` | Card outlines |
| `text-xs` | Metadata, timestamps (compact density) |

## Empty and error states

| State | Component | Shown when |
|-------|-----------|------------|
| Empty queue | `PlanningEmptyState` | No review items for current filters |
| No item selected | `ReviewQueueEmptySelection` | Queue loaded but no item clicked |
| Loading | `PlanningSkeleton` per row | API fetching |
| Error | `PlanningErrorState` | API failure |

## Exit criteria

1. Queue loads with at least demo/mock data; items display severity, trade, time ago
2. Clicking an item opens it in the right panel (split layout functional)
3. Selecting multiple items enables bulk action bar
4. Approve/Reject buttons call appropriate handlers (mock or API)
5. Filter dropdown changes visible items
6. Empty state renders when queue is empty
7. Right panel closes cleanly when ✕ clicked

## Out of scope

- Actual API integration (can use mock/demo data)
- Persisting approve/reject actions (mock handlers)
- Task creation from review items (Phase 3)

## Dependencies

- Phase 1 (shell) complete
- Phase 0 (components) complete
- `@v2e/contracts` for `ReviewItem`, `Severity`, `Trade` types
- TanStack Query for data fetching (per repo standard)

## Files created in this phase

```
apps/planning-web/src/routes/console/
├── reviews.tsx               # Main review queue route
└── review-queue.$itemId.tsx       # Item detail route (nested)

apps/planning-web/src/components/planning/
├── review-queue/                   # All phase 2 components
│   ├── review-queue-page.tsx
│   ├── review-queue-list.tsx
│   ├── review-queue-list-header.tsx
│   ├── review-queue-item-card.tsx
│   ├── review-queue-bulk-action-bar.tsx
│   ├── review-queue-filters.tsx
│   ├── review-item-detail-panel.tsx
│   ├── review-item-extracted-data.tsx
│   ├── review-item-transcript-block.tsx
│   ├── review-item-linked-task.tsx
│   ├── review-item-actions.tsx
│   ├── reject-dialog.tsx
│   └── bulk-reject-dialog.tsx
```

Parent: [`AGENTS.md`](AGENTS.md).
