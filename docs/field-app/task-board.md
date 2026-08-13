# Task Board Page

## Purpose

Show actionable work with clear priority and ownership so the execution lead can drive execution.

## Screen preview

```
┌────────────────────────────────────────────────────────────┐
│ Tasks · Site A · [1328 ▼]                    24 shown        │
│ [Status▼][Sev▼][Trade▼][Owner▼][Overdue]                   │
├────────────────────────────────────────────────────────────┤
│  Active          Blocked           Done                     │
│ ┌──────────┐    ┌──────────┐      ┌──────────┐               │
│ │Pour slab │    │Steel del.│      │Sign-off  │               │
│ │High·Mason│    │Crit·Proc │      │Low·QA    │               │
│ └──────────┘    └──────────┘      └──────────┘               │
│   ... more cards ...                                        │
├────────────────────────────────────────────────────────────┤
│  Home      Board      (+)      Standup      Me             │
│             ●                                               │
└────────────────────────────────────────────────────────────┘

  Slide-over (card tap)                    ┌──────────────────┐
                                           │ ✕  Pour slab    │
                                           │ Full description│
                                           │ Due · Owner · … │
                                           │ Att: 2 img · 1 aud │
                                           └──────────────────┘
```

## Primary Data Inputs

- `tasks.csv`
- `task_attachments.csv`
- `users.csv`
- `team_members.csv`

## Page Layout

1. Header
   - Title
   - Site label + project switch
   - Task count
2. Filter Bar
   - Status
   - Severity
   - Trade
   - Owner
   - Overdue toggle
3. Board Columns
   - Active
   - Blocked
   - Done
4. Task Card
   - Title
   - Severity chip
   - Trade chip
   - Owner role
   - Location
   - Due date
   - AI / voice lineage if `sourceUpdateId` exists on the task; separate **Linked** queue on the Updates screen uses `updates.linkedTaskId` ([update.md](../data-model/update.md))
   - Task execution state remains independent from update queue state: a task can be `Active` / `Blocked` / `Overdue` while the source update still sits in `Review` for execution-lead confirmation ([workflow invariants](../data-model/invariants/updates-tasks-workflow-invariants.md))
   - Attachment count by type (image/audio/video/document)
5. Slide-over details
   - Full description
   - Start and due dates
   - Source lineage
   - Attachment list

## Render Rules

- Use enum values from contracts for status and severity chips.
- Query scope must include selected `projectId` and `siteId`.
- Sort default by due date ascending, then severity descending.
- Mark overdue only when `dueDate < now` and `status != Done`.
- Do not reinterpret task execution state from update queue state alone.

## Empty States

- Filter no match: show "No tasks match current filters."
- No tasks at all: show "No tasks created yet. Process an update to create one."
