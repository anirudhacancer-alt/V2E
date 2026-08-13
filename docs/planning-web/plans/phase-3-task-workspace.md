# Phase 3 — Task workspace

## Goal

Deliver the **task workspace** with multiple views for execution planning: table (default), board, and timeline. This is the primary operational surface for planning and tracking work.

**Prerequisite:** Phase 1 (shell) must be complete.

## What ships

### Workspace layout (multi-view shell with right panel)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (384px)    │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │             │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │             │
│  │  ───────────────  │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │    Review Queue   │  │                                                  │             │
│  │  ▶ Tasks          │  │  [ Tasks ]  [Table] [Board] [Timeline]           │             │
│  │    Commitments    │  │  ─────────────────────────────────────────────│             │
│  │    Tech Review    │  │                                                  │             │
│  │    Blockers       │  │  ┌──────────────────────────────────────────────┐│             │
│  │    Standup        │  │  │                                              ││             │
│  │    Schedule       │  │  │         TABLE VIEW (default)                ││             │
│  │  ──────────────    │  │  │         ────────────────                     ││             │
│  │    Reports        │  │  │  [filters: status | trade | assignee | …]    ││             │
│  │    Admin          │  │  │  ┌────┬──────────┬──────┬────────┬────────┐ ││             │
│  └───────────────────┘  │  │  │ □  │ Task     │Trade │Assignee│ Status│ ││             │
│                          │  │  ├────┼──────────┼──────┼────────┼────────┤ ││             │
│  [workspace context]    │  │  │ □  │ Task...  │Elec.  │ @JD    │ ● Open│ ││             │
│                          │  │  │ ■  │ Task...  │Plumb. │ @SAR   │ ◐ WIP │ ││             │
│                          │  │  │ □  │ Task...  │HVAC   │ @MK    │ ● Open│ ││             │
│                          │  │  └────┴──────────┴──────┴────────┴────────┘ ││             │
│                          │  └──────────────────────────────────────────────┘│             │
│                          │                                                  │             │
│                          │  ┌──────────────────────────────────────────────┐│             │
│                          │  │  BOARD VIEW (when toggled)                   ││             │
│                          │  │  ────────────────                           ││             │
│                          │  │  ● Open    │ ◐ WIP   │ ◐ Review │ ✓ Done  ││             │
│                          │  │  [card]    │ [card]   │ [card]   │ [card]  ││             │
│                          │  │  [card]    │ [card]   │          │ [card]  ││             │
│                          │  │            │          │          │         ││             │
│                          │  └──────────────────────────────────────────────┘│             │
│                          │                                                  │             │
│                          │  ┌──────────────────────────────────────────────┐│             │
│                          │  │  TIMELINE VIEW (when toggled)               ││             │
│                          │  │  ────────────────                           ││             │
│                          │  │  [Gantt-style bars on date axis]             ││             │
│                          │  └──────────────────────────────────────────────┘│             │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Table view anatomy

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Tasks                           [+ New Task]  [Export]  [⋮]          │
│  ─────────────────────────────────────────────────────────────────────  │
│  [All Status ◀ ▼] [All Trades ◀ ▼] [All Assignees ◀ ▼]  [Clear]        │  ← Filter bar
│  ─────────────────────────────────────────────────────────────────────  │
│  ┌────┬────────────────────┬──────────┬───────────┬────────┬───────┐│
│  │ □  │ Task                │ Trade    │ Assignee  │ Status │ Due   ││  ← Sticky header
│  ├────┼────────────────────┼──────────┼───────────┼────────┼───────┤│
│  │ □  │ Clear gate B access│ Electrical│ @JD      │ ● Open │ Today ││
│  │ ■  │ Fix safety barrier │ Safety   │ @SAR     │ ◐ WIP  │ —     ││  ← Selected
│  │ □  │ Order rebar         │ Materials│ @MK      │ ● Open │ Fri   ││
│  │ □  │ Inspect fire exits  │ Safety   │ @JD      │ ✓ Done │ Mon   ││
│  └────┴────────────────────┴──────────┴───────────�┴────────┴───────┘│
│  ─────────────────────────────────────────────────────────────────────  │
│  Showing 47 tasks                          [<] 1 of 5 [>]  [50 per ▼] │
└─────────────────────────────────────────────────────────────────────────┘
```

### Board view anatomy

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Tasks     [Table] [▶ Board] [Timeline]              [+ New Task]     │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ● Open (12)        ◐ WIP (5)       ◐ Review (2)      ✓ Done (28)       │
│  ┌──────────────┐  ┌────────────┐ ┌────────────┐  ┌────────────┐  │
│  │ ┌──────────┐  │  │ ┌────────┐ │ │ ┌────────┐ │  │ ┌────────┐ │  │
│  │ │Card       │  │  │ │Card    │ │ │ │Card    │ │  │ │Card    │ │  │
│  │ │Title      │  │  │ │Title   │ │ │ │Title   │ │  │ │Title   │ │  │
│  │ │Trade · 2d │  │  │ │Trade   │ │ │ │Trade   │ │  │ │Trade   │ │  │
│  │ └──────────┘  │  │ └────────┘ │ │ └────────┘ │  │ └────────┘ │  │
│  │ ┌──────────┐  │  │ ┌────────┐ │ │            │  │ ┌────────┐ │  │
│  │ │Card       │  │  │ │Card    │ │ │            │  │ │Card    │ │  │
│  │ │...        │  │  │ │...     │ │ │            │  │ │...     │ │  │
│  │ └──────────┘  │  │ └────────┘ │ │            │  │ └────────┘ │  │
│  └──────────────┘  └────────────┘ └────────────┘  └────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Timeline view anatomy

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Tasks     [Table] [Board] [▶ Timeline]               [+ New Task]    │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  Today          Fri 28         Mon 31         Wed 2         Thu 3       │
│  ├──────────────┼──────────────┼──────────────┼──────────────┤         │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  Clear gate B
│  ░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  Order rebar
│  ░░░░░░░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  Inspect fire exits
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Right panel detail anatomy (task detail)

```
┌─────────────────────────────────────┐
│  ✕  Task Detail            [Edit]  │
│  ─────────────────────────────────  │
│                                     │
│  #T-0042  ● Open                   │  ← Task ID + status badge
│                                     │
│  Clear gate B access               │  ← Title (editable in edit mode)
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Trade     │ Electrical        │ │  ← Metadata grid (2-col)
│  │ Assignee  │ @JD               │ │
│  │ Due Date  │ Today             │ │
│  │ Priority  │ High              │ │
│  │ Location  │ Gate B            │ │
│  └───────────────────────────────┘ │
│                                     │
│  ─────────────────────────────────  │
│  ## Description                    │
│  Materials are blocking gate B.    │
│  Safety check required before      │
│  work can resume.                  │
│                                     │
│  ─────────────────────────────────  │
│  ## Linked Updates                 │
│  [Update from @JD · 2h ago]        │
│                                     │
│  ─────────────────────────────────  │
│  ## Dependencies                   │
│  [T-0039: Material delivery]       │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [Delete]              [Mark Done ✓]│
└─────────────────────────────────────┘
```

## Components built in this phase

### Task workspace shell

| Component | File | Description |
|-----------|------|-------------|
| `TaskWorkspacePage` | `tasks/task-workspace-page.tsx` | Main page: view switcher + content area |
| `TaskViewSwitcher` | `tasks/task-view-switcher.tsx` | Table / Board / Timeline toggle tabs |
| `TaskFilterBar` | `tasks/task-filter-bar.tsx` | Row of `PlanningFilterChip` for status/trade/assignee |
| `TaskListPaginationFooter` | `tasks/task-list-pagination-footer.tsx` | Pagination (per page selector + prev/next) |

### Table view

| Component | File | Description |
|-----------|------|-------------|
| `TaskDataTable` | `tasks/table/task-data-table.tsx` | Sortable, selectable data table |
| `TaskTableHeader` | `tasks/table/task-table-header.tsx` | Sticky column headers (click to sort) |
| `TaskTableRow` | `tasks/table/task-table-row.tsx` | Single task row |
| `TaskTableCell` | `tasks/table/task-table-cell.tsx` | Typed cells (text, badge, avatar, date) |

### Board view

| Component | File | Description |
|-----------|------|-------------|
| `TaskBoardView` | `tasks/board/task-board-view.tsx` | Container for all columns |
| `TaskBoardColumn` | `tasks/board/task-board-column.tsx` | Single status column (header + card stack) |
| `TaskBoardCard` | `tasks/board/task-board-card.tsx` | Compact task card (title, trade, age) |

### Timeline view

| Component | File | Description |
|-----------|------|-------------|
| `TaskTimelineView` | `tasks/timeline/task-timeline-view.tsx` | Gantt-style timeline container |
| `TaskTimelineRow` | `tasks/timeline/task-timeline-row.tsx` | Single task as timeline bar |
| `TaskTimelineHeader` | `tasks/timeline/task-timeline-header.tsx` | Date axis header |

### Detail panel

| Component | File | Description |
|-----------|------|-------------|
| `TaskDetailPanel` | `tasks/detail/task-detail-panel.tsx` | Full task detail panel |
| `TaskMetadataGrid` | `tasks/detail/task-metadata-grid.tsx` | 2-col key-value metadata |
| `TaskLinkedUpdatesList` | `tasks/detail/task-linked-updates-list.tsx` | List of linked updates |
| `TaskDependenciesList` | `tasks/detail/dependencies-list.tsx` | List of task dependencies |

### Task creation/edit

| Component | File | Description |
|-----------|------|-------------|
| `NewTaskDialog` | `tasks/new-task-dialog.tsx` | Modal for creating new task |
| `TaskEditForm` | `tasks/detail/task-edit-form.tsx` | Inline or panel edit form |
| `TaskStatusSelect` | `tasks/detail/task-status-select.tsx` | Status dropdown |
| `TaskTradeSelect` | `tasks/detail/task-trade-select.tsx` | Trade dropdown |
| `TaskAssigneeSelect` | `tasks/detail/task-assignee-select.tsx` | Assignee multi-select |

### Shared (Phase 0)

All card wrappers, badges, buttons, and layout utilities come from Phase 0.

## Key data entities

| Entity | Source | Notes |
|--------|--------|-------|
| `Task` | `@v2e/contracts` | Core task entity |
| `TaskDependency` | `@v2e/contracts` | Dependency edges |
| `Project` | `@v2e/contracts` | Org context |
| `Team` | `@v2e/contracts` | Team context |
| `Location` | `@v2e/contracts` | Task location |
| `User` | `@v2e/contracts` | Assignee |
| `WorkCycle` | `@v2e/contracts` | Sprint selector stub |
| `Trade` | `@v2e/contracts` enum | Trade category |
| `TaskStatus` | `@v2e/contracts` enum | `open` / `wip` / `review` / `done` |

## Routes

```
/console/tasks                    → TaskWorkspacePage (default: table view)
/console/tasks/board             → TaskWorkspacePage (board view)
/console/tasks/timeline           → TaskWorkspacePage (timeline view)
/console/tasks/:taskId            → TaskWorkspacePage (task selected in detail panel)
```

Query params:
- `?status=open,wip&trade=electrical&assignee=userId` for shared filter state across views

## Design token usage

| Token | Applied where |
|-------|--------------|
| `--color-surface-brand` | View switcher active tab |
| `--color-planning-amber` | High priority, deadline approaching |
| `--color-planning-amber-subtle` | Amber badge backgrounds |
| `--color-planning-slate` | Admin/settings-adjacent badges |
| `planning-material-card` | Task cards in board view |
| `planning-material-border` | Table borders |
| `rounded-lg` | Cards, buttons |
| `rounded-sm` | Badges, table cells |

## Empty and error states

| State | Component | Shown when |
|-------|-----------|------------|
| Empty task list | `PlanningEmptyState` | No tasks for current filters |
| No task selected | Inline empty state in right panel | URL has no `:taskId` |
| Loading | `PlanningSkeleton` table rows | API fetching |
| Error | `PlanningErrorState` | API failure |

## Exit criteria

1. Table view loads with task data; columns sortable by click
2. Board view shows status columns with task cards
3. Timeline view shows task bars on date axis
4. Clicking a task opens detail in right panel
5. Filter bar filters are reflected in all three views simultaneously
6. "New Task" button opens creation dialog
7. Right panel shows task metadata, description, linked updates, dependencies
8. Pagination works in table view

## Out of scope

- Drag-and-drop in board view (Phase 4 for commitments integration)
- Actual API persistence (mock handlers acceptable)
- WorkCycle/sprint integration (Phase 4)

## Dependencies

- Phase 1 (shell) complete
- Phase 0 (components) complete
- `@v2e/contracts` for `Task`, `TaskStatus`, `Trade`, `TaskDependency` types
- TanStack Query for data fetching
- TanStack Virtual for large list virtualization (if needed)

## Files created in this phase

```
apps/planning-web/src/routes/console/
├── tasks.tsx                     # Task workspace (view switcher)
├── tasks.board.tsx              # Board view route
├── tasks.timeline.tsx           # Timeline view route
└── tasks.$taskId.tsx           # Task detail route

apps/planning-web/src/components/planning/
├── tasks/
│   ├── task-workspace-page.tsx
│   ├── task-view-switcher.tsx
│   ├── task-filter-bar.tsx
│   ├── task-list-pagination-footer.tsx
│   ├── table/
│   │   ├── task-data-table.tsx
│   │   ├── task-table-header.tsx
│   │   ├── task-table-row.tsx
│   │   └── task-table-cell.tsx
│   ├── board/
│   │   ├── task-board-view.tsx
│   │   ├── task-board-column.tsx
│   │   └── task-board-card.tsx
│   ├── timeline/
│   │   ├── task-timeline-view.tsx
│   │   ├── task-timeline-row.tsx
│   │   └── task-timeline-header.tsx
│   ├── detail/
│   │   ├── task-detail-panel.tsx
│   │   ├── task-metadata-grid.tsx
│   │   ├── task-linked-updates-list.tsx
│   │   ├── dependencies-list.tsx
│   │   ├── task-edit-form.tsx
│   │   ├── task-status-select.tsx
│   │   ├── task-trade-select.tsx
│   │   └── task-assignee-select.tsx
│   └── new-task-dialog.tsx
```

Parent: [`AGENTS.md`](AGENTS.md).
