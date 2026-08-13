# Phase 4 — Sprint board and commitments

## Goal

Tie planning to **work cycles** and **commitments**: what was promised vs delivered, carry-overs, and sprint-level reliability signals.

**Prerequisite:** Phase 3 (task workspace) should be complete.

## What ships

### Commitments workspace layout

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (384px)    │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │             │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │             │
│  │  ───────────────  │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │    Review Queue   │  │                                                  │             │
│  │    Tasks          │  │  [ Commitments ]  [Cycle: Sprint 12 ◀ ▼]        │             │
│  │  ▶ Commitments   │  │  ─────────────────────────────────────────────│             │
│  │    Tech Review   │  │                                                  │             │
│  │    Blockers      │  │  ┌──────────────────────────────────────────────┐│             │
│  │    Standup        │  │  │                                              ││             │
│  │    Schedule       │  │  │  SPRINT COMMITMENT BOARD                    ││             │
│  │  ──────────────    │  │  │  ─────────────────                         ││             │
│  │    Reports        │  │  │  Cycle: Sprint 12  ·  Mar 24 – Apr 4       ││             │
│  │    Admin          │  │  │                                              ││             │
│  └───────────────────┘  │  │  ┌────────────────────────────────────┐    ││             │
│                          │  │  │ ## Commitment Reliability          │    ││             │
│  [workspace context]     │  │  │  ████████████░░░░░░░░  67%        │    ││             │
│                          │  │  │  24 of 36 tasks completed          │    ││             │
│                          │  │  └────────────────────────────────────┘    ││             │
│                          │  │                                              ││             │
│                          │  │  ## Planned vs Done                         ││             │
│                          │  │  ┌──────────────┐ ┌──────────────┐           ││             │
│                          │  │  │  PLANNED    │ │   DONE      │           ││             │
│                          │  │  │  36 tasks   │ │  24 tasks   │           ││             │
│                          │  │  │  8 carry-ov │ │  0 carry-ov │           ││             │
│                          │  │  └──────────────┘ └──────────────┘           ││             │
│                          │  │                                              ││             │
│                          │  │  ## Carry-overs from Sprint 11               ││             │
│                          │  │  [PlanningSectionCard with carry-over list] ││             │
│                          │  │                                              ││             │
│                          │  └──────────────────────────────────────────────┘│             │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Sprint board view (kanban-style)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Commitments      [Sprint 12 ◀ ▼]  [+ New Commitment]                  │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  SPRINT 12: Mar 24 – Apr 4           [68% complete]                      │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  ● Committed     │ ◐ In Progress   │ ◐ At Risk        │ ✓ Delivered     │
│  (was: planned)  │                 │ (behind schedule)│                │
│  ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────┐   │ ┌─────────────┐ │
│  │ [task]     │ │ │ [task]     │ │ │ [task]     │   │ │ [task]     │ │
│  │ [task]     │ │ │ [task]     │ │ │             │   │ │ [task]     │ │
│  │ [task]     │ │ │             │ │ │             │   │ │ [task]     │ │
│  │ ...        │ │ │             │ │ │             │   │ │ ...        │ │
│  └─────────────┘ └─────────────┘ └─────────────────┘   └─────────────┘ │
│                                                                          │
│  ## Carry-overs (Sprint 11 → Sprint 12)                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ 8 tasks carried over from Sprint 11                                 ││
│  │ [task] [task] [task] [task] [task] [task] [task] [task]             ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Right panel: commitment detail

```
┌─────────────────────────────────────┐
│  ✕  Commitment Detail      [Edit]  │
│  ─────────────────────────────────  │
│                                     │
│  ## Clear gate B by Friday          │
│  ⚠️ At Risk · Electrical            │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Cycle    │ Sprint 12           │ │
│  │ Planned │ Mar 24             │ │
│  │ Due      │ Apr 4              │ │
│  │ Status  │ ◐ At Risk          │ │
│  │ Tasks    │ 3 of 5 done        │ │
│  └───────────────────────────────┘ │
│                                     │
│  ─────────────────────────────────  │
│  ## Tasks in Commitment             │
│  ☑ Clear gate B (done)             │
│  ☑ Order replacement barrier (done)│
│  ◐ Schedule safety check (wip)     │
│  ○ Conduct safety check (open)     │
│  ○ Sign off on gate clearance      │
│                                     │
│  ─────────────────────────────────  │
│  ## Notes                          │
│  Vendor delayed on barrier parts.  │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [Delete Commitment]    [Mark ✓ Done]│
└─────────────────────────────────────┘
```

### WorkCycle selector

```
┌─────────────────────────────────────┐
│  Cycle: [ Sprint 12 ◀ ▼ ]          │  ← PlanningSelect dropdown
│          Sprint 11 (completed)      │
│          Sprint 10 (completed)     │
│          Sprint 12 (current)  ◀──selected│
│          Sprint 13 (planned)       │
└─────────────────────────────────────┘
```

## Components built in this phase

### Commitment components

| Component | File | Description |
|-----------|------|-------------|
| `CommitmentsPage` | `commitments/commitments-page.tsx` | Main commitments workspace |
| `SprintBoard` | `commitments/sprint-board.tsx` | Kanban-style sprint board |
| `SprintBoardColumn` | `commitments/sprint-board-column.tsx` | Single column (committed/in-progress/at-risk/delivered) |
| `SprintBoardCard` | `commitments/sprint-board-card.tsx` | Commitment card (compact task info) |
| `CommitmentDetailPanel` | `commitments/commitment-detail-panel.tsx` | Full commitment detail |
| `CommitmentReliabilityWidget` | `commitments/commitment-reliability-widget.tsx` | Progress bar + % complete |
| `PlannedVsDoneWidget` | `commitments/planned-vs-done-widget.tsx` | Two-column stat display |
| `CarryOverList` | `commitments/carry-over-list.tsx` | List of tasks carried from previous cycle |
| `WorkCycleSelector` | `commitments/work-cycle-selector.tsx` | Sprint/cycle dropdown selector |
| `NewCommitmentDialog` | `commitments/new-commitment-dialog.tsx` | Create commitment modal |
| `CommitmentTaskChecklist` | `commitments/commitment-task-checklist.tsx` | Checklist of tasks in commitment |

### Sprint components

| Component | File | Description |
|-----------|------|-------------|
| `SprintHeader` | `commitments/sprint-header.tsx` | Sprint name, dates, overall progress |
| `SprintProgressBar` | `commitments/sprint-progress-bar.tsx` | Visual progress bar for sprint |

### Shared (Phase 0/3)

- All Phase 0 card/badge/button wrappers
- Phase 3 task components where reusable (e.g., task board card)

## Key data entities

| Entity | Source | Notes |
|--------|--------|-------|
| `Commitment` | `@v2e/contracts` | Core commitment entity |
| `WorkCycle` | `@v2e/contracts` | Sprint/cycle entity |
| `Task` | `@v2e/contracts` | Tasks linked to commitments |
| `StandupSession` | `@v2e/contracts` | Link for standup context |

## Routes

```
/console/commitments              → CommitmentsPage (current sprint default)
/console/commitments?sprint=sprintId  → Same, with specific sprint selected
```

## Design token usage

| Token | Applied where |
|-------|--------------|
| `--color-planning-amber` | At-risk status, carry-over indicators |
| `--color-planning-amber-subtle` | At-risk badge backgrounds |
| `--color-surface-brand` | On-track/delivered status |
| `planning-material-badge-commitment` | Commitment status badges |
| `planning-progress-bar` | Commitment reliability widget |

## Empty and error states

| State | Component | Shown when |
|-------|-----------|------------|
| No commitments | `PlanningEmptyState` | Sprint has no commitments |
| No tasks in commitment | Inline empty in checklist | Commitment has no linked tasks |
| Loading | Skeleton cards | API fetching |

## Exit criteria

1. Commitments board shows all commitments for selected cycle
2. WorkCycle selector switches between sprints and shows correct data
3. Commitment cards show linked task count and progress
4. Carry-over list appears when previous sprint has incomplete tasks
5. Clicking a commitment opens detail in right panel
6. Commitment reliability widget shows % with progress bar
7. "New Commitment" button opens creation dialog
8. Filtering commitments by status works

## Out of scope

- Actual drag-and-drop task assignment to commitments (Phase 3 has task workspace)
- Full API persistence (mock handlers acceptable)
- Integration with actual standup sessions (Phase 6)

## Dependencies

- Phase 3 (task workspace) complete preferred but not required
- Phase 0 (components) complete
- `@v2e/contracts` for `Commitment`, `WorkCycle` types
- TanStack Query for data fetching

## Files created in this phase

```
apps/planning-web/src/routes/console/
└── commitments.tsx               # Commitments route

apps/planning-web/src/components/planning/
├── commitments/
│   ├── commitments-page.tsx
│   ├── sprint-board.tsx
│   ├── sprint-board-column.tsx
│   ├── sprint-board-card.tsx
│   ├── commitment-detail-panel.tsx
│   ├── commitment-reliability-widget.tsx
│   ├── planned-vs-done-widget.tsx
│   ├── carry-over-list.tsx
│   ├── work-cycle-selector.tsx
│   ├── new-commitment-dialog.tsx
│   ├── commitment-task-checklist.tsx
│   ├── sprint-header.tsx
│   └── sprint-progress-bar.tsx
```

Parent: [`AGENTS.md`](AGENTS.md).
