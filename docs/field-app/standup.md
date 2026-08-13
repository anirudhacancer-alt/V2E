# Daily Standup Page

## Purpose

Run the daily standup using attendance, planned work, completed work, and blockers with a shareable summary.

## Screen preview

```
┌────────────────────────────────────────────────────────────┐
│ Standup · Mar 24, 2026 · 1328 · Lead: Alex                 │
├────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│ │ Attd │ │ Plan │ │ Done │ │ Risk │                        │
│ │ 92%  │ │  14  │ │  11  │ │  3   │                        │
│ └──────┘ └──────┘ └──────┘ └──────┘                        │
│ Attendance    ☑ Name  ☑ Name  ☐ Name …                    │
│ Planned by trade    RCC · MEP · …                           │
│ Completed    items with % …                                 │
│ Blocked      [High] Steel delay — L3 — Task #…             │
│ Summary      Auto paragraph…              [ Copy / share ]  │
├────────────────────────────────────────────────────────────┤
│  Home      Board      (+)      Standup      Me             │
│                                ●                            │
└────────────────────────────────────────────────────────────┘
```

## Primary Data Inputs

- `standups.csv`
- `standup_attendance_records.csv`
- `tasks.csv` (planned / completed / blocked **lists** for each standup are derived from tasks + standup date — no separate line-item CSVs)
- `attendances.csv`

Standup prep API and “Needs discussion” semantics (blockers vs **carry-forward**: Active, due yesterday): see [standup-prep-from-tasks](./standup-prep-from-tasks.md).
Update `Review` state does not suppress task execution state for standup prep; planned / blocked / overdue rollups come from task execution semantics, not the review queue alone (see [workflow invariants](../data-model/invariants/updates-tasks-workflow-invariants.md)).

## Page Layout

1. Header
   - Date
   - Contract
   - Conducted by
2. Summary Cards
   - Attendance rate
   - Tasks planned
   - Completed
   - At risk
3. Attendance Section
   - Present/Absent checklist
   - Notes for absentees
4. Planned Items Section
   - List grouped by trade
5. Completed Items Section
   - List with completion percentage
6. Blocked Items Section
   - Severity chips
   - Blocker reason
   - Linked task when present
7. Summary Text
   - Auto-generated paragraph
   - Copy/share action

## Render Rules

- Attendance rate = `(present / total) * 100`.
- Blockers should default sort by severity then location.
- Completion chart uses standup summary fields, not raw list length only.

## Empty States

- No standup exists for today: show "Start standup" flow.
- No blockers: show positive state card.
