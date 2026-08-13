# Home Dashboard Page

## Purpose

Give execution leads a fast snapshot of current execution health for the selected contract.

## Screen preview

```
┌────────────────────────────────────────────────────────────┐
│ Good morning, Alex          Riverside Site    [1328 ▼]     │
│ Mon Mar 24, 2026                                           │
├────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                        │
│ │ Open │ │Block │ │ Updt │ │ Attd │                        │
│ │  12  │ │  3   │ │  5   │ │ 94%  │                        │
│ └──────┘ └──────┘ └──────┘ └──────┘                        │
│ Trends (7d)  updates ·····   standups ·····                 │
│ Risk   [severity bars]   Top blocked: L3, Roof            │
│ Recent   Update A…   Task B status…   …                     │
│ Quick actions                                               │
│  [ Record update ]  [ Task board ]  [ Start standup ]      │
├────────────────────────────────────────────────────────────┤
│  Home      Board      (+)      Standup      Me             │
│   ●                                                         │
└────────────────────────────────────────────────────────────┘
```

## Primary Data Inputs

- `tasks.csv`
- `updates.csv`
- `standups.csv`

Blocked work in the app comes from **task** status / derived UI task state, not from removed standup line-item CSVs. See [standup-prep-from-tasks](./standup-prep-from-tasks.md).

## Page Layout

1. Header
   - Greeting
   - Site label
   - Project switch (`1328` / `1330`)
   - Current date
2. KPI Cards
   - Open tasks
   - Blocked tasks
   - Updates today
   - Attendance rate (latest standup)
3. Trends Row
   - Daily updates trend (7 days)
   - Standup completion trend (7 days)
4. Risk Panel
   - Blocker severity distribution
   - Top blocked locations
5. Recent Activity
   - Last 5 updates
   - Last 5 task changes
6. Quick Actions
   - Record update
   - Open task board
   - Start standup

## Render Rules

- Header context = selected `siteId` + selected `projectId`.
- `Open tasks` = tasks with `status` in `Active` or `Blocked`.
- `Blocked tasks` = tasks with `status` = `Blocked`.
- `Updates today` = updates with `createdAt` date = today.
- Attendance card uses latest standup `attendanceRate`.

## Empty States

- No standup data: show "No standup yet today. Start standup."
- No updates: show "No updates captured yet. Record the first update."
