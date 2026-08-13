# Phase 6 — Standup prep and schedule

## Goal

Provide **standup prep** outputs and a **schedule** view for horizon planning and milestone risk.

**Prerequisite:** Phase 3 (task workspace) and Phase 5 (blockers) should be complete.

## What ships

### Standup prep workspace

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (384px)    │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │             │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │             │
│  │  ───────────────  │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │    Review Queue   │  │                                                  │             │
│  │    Tasks          │  │  [ Standup Prep ]         [Today ◀ ▼]            │             │
│  │    Commitments    │  │  ─────────────────────────────────────────────│             │
│  │    Tech Review    │  │                                                  │             │
│  │    Blockers       │  │  ┌──────────────────────────────────────────────┐│             │
│  │  ▶ Standup       │  │  │                                              ││             │
│  │    Schedule       │  │  │  STANDUP PREP (read-model)                  ││             │
│  │  ──────────────    │  │  │  ────────────────                          ││             │
│  │    Reports        │  │  │                                              ││             │
│  │    Admin          │  │  │  ## Agenda                                   ││             │
│  │                    │  │  │  ┌──────────────────────────────────────┐  ││             │
│  │                    │  │  │  │ 1. 🔴 Blockers (3)                   │  ││             │
│  │                    │  │  │  │ 2. 🟡 Yesterday (what done)           │  ││             │
│  │                    │  │  │  │ 3. 🔵 Today (what next)              │  ││             │
│  │                    │  │  │  │ 4. 🟢 Risks (what could slip)        │  ││             │
│  │                    │  │  │  └──────────────────────────────────────┘  │  ││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  │  ## 🔴 Blockers (3)                        ││             │
│  │                    │  │  │  [BlockerCard] [BlockerCard] [BlockerCard] ││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  │  ## 🟡 Yesterday                           ││             │
│  │                    │  │  │  • T-0042: Cleared gate B access (done)  ││             │
│  │                    │  │  │  • T-0038: Ordered rebar (done)          ││             │
│  │                    │  │  │  • R-0091: Approved (review done)         ││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  │  ## 🔵 Today                               ││             │
│  │                    │  │  │  • T-0045: Install electrical panel      ││             │
│  │                    │  │  │  • T-0046: Schedule safety inspection    ││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  │  ## 🟢 Risks                              ││             │
│  │                    │  │  │  • Permit may delay wiring (2d)          ││             │
│  │                    │  │  │                                              ││             │
│  └───────────────────┘  │  └──────────────────────────────────────────────┘│             │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Schedule workspace

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (384px)    │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │             │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │             │
│  │  ───────────────  │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │    Review Queue   │  │                                                  │             │
│  │    Tasks          │  │  [ Schedule ]      [Month ◀ ▼] [◀ ▶]            │             │
│  │    Commitments    │  │  ─────────────────────────────────────────────│             │
│  │    Tech Review    │  │                                                  │             │
│  │    Blockers       │  │  ┌──────────────────────────────────────────────┐│             │
│  │  ▶ Standup        │  │  │                                              ││             │
│  │    Schedule       │  │  │  GANTT / TIMELINE VIEW                      ││             │
│  │  ──────────────    │  │  │  ────────────────                           ││             │
│  │    Reports        │  │  │                                              ││             │
│  │    Admin          │  │  │  [═══════════════════════════════════════] ││             │
│  │                    │  │  │  Mar 27         Mar 31         Apr 4        ││             │
│  │                    │  │  │  Sprint 12                              ───││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  │  [──── Task A ────]                         ││             │
│  │                    │  │  │           [── Task B ─────]                 ││             │
│  │                    │  │  │                      [─ Task C ─]           ││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ││             │
│  │                    │  │  │  Apr 7          Apr 11        Apr 15        ││             │
│  │                    │  │  │  Sprint 13                                 ──││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  └──────────────────────────────────────────────┘│             │
│  │                    │  │                                                  │             │
│  │                    │  │  ## Milestone Risk                              ││             │
│  │                    │  │  [PlanningSectionCard: at-risk milestones]     ││             │
│  └───────────────────┘  │  └──────────────────────────────────────────────┘│             │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Milestone risk panel

```
┌─────────────────────────────────────┐
│  ## Milestone Risk                  │
│                                     │
│  ⚠️ Electrical Rough-In              │
│  Due: Apr 4  ·  4d away             │
│  Risk: Permit blocker (T-0042)      │
│                                     │
│  ⚠️ Fire Inspection                  │
│  Due: Apr 8  ·  8d away             │
│  Risk: Low — on track               │
│                                     │
│  🔴 Final Walkthrough               │
│  Due: Apr 15  ·  15d away          │
│  Risk: Equipment delivery (T-0099) │
│                                     │
└─────────────────────────────────────┘
```

### Standup session detail

```
┌─────────────────────────────────────┐
│  ✕  Standup: Mar 27, 2026           │
│  ─────────────────────────────────  │
│                                     │
│  Sprint 12  ·  Day 3 of 10          │
│                                     │
│  ─────────────────────────────────  │
│  ## Attendees (6)                   │
│  [@JD ✓] [@SAR ✓] [@MK ◐]          │
│  [@TP ✓] [@AL ○] [@JC ◐]           │
│                                     │
│  ─────────────────────────────────  │
│  ## Notes                           │
│  Gate B cleared. Awaiting permit.   │
│  Rebar ordered.                     │
│                                     │
│  ─────────────────────────────────  │
│  ## Action Items                    │
│  • @SAR: Follow up on permit (today)│
│  • @JD: Schedule inspection        │
│                                     │
└─────────────────────────────────────┘
```

## Components built in this phase

### Standup components

| Component | File | Description |
|-----------|------|-------------|
| `StandupPrepPage` | `standup/standup-prep-page.tsx` | Main standup prep workspace |
| `StandupAgenda` | `standup/standup-agenda.tsx` | Agenda sections (blockers, yesterday, today, risks) |
| `StandupAgendaSection` | `standup/standup-agenda-section.tsx` | Single agenda section with icon + count |
| `StandupAgendaItem` | `standup/standup-agenda-item.tsx` | Single item in agenda (task, blocker, update) |
| `StandupSessionSelector` | `standup/standup-session-selector.tsx` | Date picker for session |
| `StandupSessionDetail` | `standup/standup-session-detail.tsx` | Past standup session display |
| `StandupAttendeeList` | `standup/standup-attendee-list.tsx` | Avatar list with attendance status |
| `StandupNotesEditor` | `standup/standup-notes-editor.tsx` | Notes for current session |

### Schedule components

| Component | File | Description |
|-----------|------|-------------|
| `SchedulePage` | `schedule/schedule-page.tsx` | Main schedule/timeline workspace |
| `GanttChart` | `schedule/gantt-chart.tsx` | Full Gantt/timeline chart |
| `GanttRow` | `schedule/gantt-row.tsx` | Single row (task, milestone, sprint) |
| `GanttBar` | `schedule/gantt-bar.tsx` | Visual bar for task duration |
| `GanttMilestone` | `schedule/gantt-milestone.tsx` | Diamond milestone marker |
| `GanttHeader` | `schedule/gantt-header.tsx` | Date axis header |
| `MilestoneRiskPanel` | `schedule/milestone-risk-panel.tsx` | At-risk milestones list |
| `ScheduleNavigator` | `schedule/schedule-navigator.tsx` | Month/week toggle + prev/next |

### Read-model derivation

Standup prep is a **read model** derived from tasks, blockers, and updates — not a separate stored entity. This mirrors field-app's approach documented in `docs/field-app/standup-prep-from-tasks.md`.

## Key data entities

| Entity | Source | Notes |
|--------|--------|-------|
| `Task` | `@v2e/contracts` | Yesterday's done, today's next |
| `Blocker` | `@v2e/contracts` | Blockers section |
| `Update` | `@v2e/contracts` | Yesterday's activity feed |
| `StandupSession` | `@v2e/contracts` | Persisted session (when saved) |

## Routes

```
/console/standup                       → StandupPrepPage (today's prep)
/console/standup/:sessionId          → Past standup session detail
/console/schedule                     → SchedulePage
```

## Design token usage

| Token | Applied where |
|-------|--------------|
| `--color-surface-brand` | "Today" section accent |
| `--color-planning-amber` | "Yesterday" (amber = completed), at-risk milestones |
| `--color-surface-error` | "Blockers" section header |
| `--color-planning-slate` | Risks/neutral items |
| `rounded-lg` | Cards, timeline bars |

## Empty and error states

| State | Component | Shown when |
|-------|-----------|------------|
| No standup data | `PlanningEmptyState` | No tasks/blockers for today |
| No sessions | Inline empty state | No standup sessions yet |
| No milestones | Inline empty state | Schedule has no milestones |

## Exit criteria

1. Standup agenda shows blockers, yesterday, today, risks sections
2. Each section populated from tasks/blockers/updates read model
3. Schedule/Gantt shows tasks and milestones on date axis
4. Milestone risk panel surfaces at-risk milestones with reasons
5. Past standup sessions are browsable by date
6. Standup session detail shows attendees and notes
7. Schedule navigator switches between month/week views

## Out of scope

- Actual standup meeting facilitation (video/voice)
- Push notifications for standup reminders
- Full Gantt drag-and-drop (future phase)
- Actual API persistence for standup sessions (mock acceptable)

## Dependencies

- Phase 3 (task workspace) complete for read model derivation
- Phase 5 (blockers) complete for blocker section
- Phase 0 (components) complete
- `@v2e/contracts` for `StandupSession`, `Task`, `Blocker`, `Update` types
- TanStack Query for data fetching

## Files created in this phase

```
apps/planning-web/src/routes/console/
├── standup.tsx                      # Standup prep route
├── standup.$sessionId.tsx          # Past session route
└── schedule.tsx                    # Schedule route

apps/planning-web/src/components/planning/
├── standup/
│   ├── standup-prep-page.tsx
│   ├── standup-agenda.tsx
│   ├── standup-agenda-section.tsx
│   ├── standup-agenda-item.tsx
│   ├── standup-session-selector.tsx
│   ├── standup-session-detail.tsx
│   ├── standup-attendee-list.tsx
│   └── standup-notes-editor.tsx
└── schedule/
    ├── schedule-page.tsx
    ├── gantt-chart.tsx
    ├── gantt-row.tsx
    ├── gantt-bar.tsx
    ├── gantt-milestone.tsx
    ├── gantt-header.tsx
    ├── milestone-risk-panel.tsx
    └── schedule-navigator.tsx
```

Parent: [`AGENTS.md`](AGENTS.md).
