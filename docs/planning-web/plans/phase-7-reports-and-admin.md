# Phase 7 — Reports and admin

## Goal

Close the loop with **operational reporting** and **guardrailed admin** for teams, projects, and roles.

**Prerequisite:** All previous phases complete.

## What ships

### Reports workspace

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (hidden)   │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │             │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │             │
│  │  ───────────────  │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │    Review Queue   │  │                                                  │             │
│  │    Tasks          │  │  [ Reports ]        [Throughput ◀ ▼] [Export]    │             │
│  │    Commitments    │  │  ─────────────────────────────────────────────│             │
│  │    Tech Review    │  │                                                  │             │
│  │    Blockers       │  │  ┌──────────────────────────────────────────────┐│             │
│  │    Standup        │  │  │                                              ││             │
│  │    Schedule       │  │  │  REPORT DASHBOARD                            ││             │
│  │  ──────────────    │  │  │  ────────────────                          ││             │
│  │  ▶ Reports        │  │  │                                              ││             │
│  │    Admin          │  │  │  ## KPI Grid                                 ││             │
│  │                    │  │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐││             │
│  │                    │  │  │  │ Through│ │ Blocker│ │Sprint  │ │ Commitment││             │
│  │                    │  │  │  │ put    │ │ Aging  │ │ Reliab.│ │ Rate    │││             │
│  │                    │  │  │  │  42    │ │  2.3d  │ │   78%  │ │   85%   │││             │
│  │                    │  │  │  │ tasks  │ │ avg    │ │        │ │         │││             │
│  │                    │  │  │  └────────┘ └────────┘ └────────┘ └────────┘││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  │  ## Throughput Over Time                     ││             │
│  │                    │  │  │  [Chart: bars or line over sprints]          ││             │
│  │                    │  │  │  ████ ████ ████ ████ ████                   ││             │
│  │                    │  │  │  Sp8  Sp9  Sp10 Sp11 Sp12                   ││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  │  ## Commitment Reliability                   ││             │
│  │                    │  │  │  [Chart: planned vs delivered per sprint]   ││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  │  ## WIP / Flow                              ││             │
│  │                    │  │  │  [Chart: cumulative flow diagram]           ││             │
│  │                    │  │  │                                              ││             │
│  │                    │  │  └──────────────────────────────────────────────┘│             │
│  └───────────────────┘  │                                                  │             │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Reports dashboard sub-views

```
Report type selector: [Throughput] [Blocker Aging] [Sprint Reliability] [WIP/Flow] [DMAIC]

THROUGHPUT:
  ████ 42 tasks completed this sprint
  ████ 38 tasks completed last sprint
  ████ 45 tasks completed 2 sprints ago

BLOCKER AGING:
  [Bar chart: count of blockers by age bucket]
  24h+ ████ 4
  48h+ ██ 2
  72h+ █ 1

SPRINT RELIABILITY (Commitment Rate):
  [Line chart: % delivered per sprint]
  85% ──────────────────── Sprint 12 (current)
  92% ──────────────────── Sprint 11
  78% ──────────────────── Sprint 10

WIP / FLOW (Cumulative Flow):
  [Stacked area chart over time]
  [open ░░░░░]
  [wip  ████████]
  [done ████████████████]
```

### Admin workspace

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (varies)   │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │             │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │             │
│  │  ───────────────  │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │    Review Queue   │  │                                                  │             │
│  │    Tasks          │  │  [ Admin ]                       [+ Add Project] │             │
│  │    Commitments    │  │  ─────────────────────────────────────────────│             │
│  │    Tech Review    │  │                                                  │             │
│  │    Blockers       │  │  ┌──────────────────────────────────────────────┐│             │
│  │    Standup        │  │  │                                              ││             │
│  │    Schedule       │  │  │  ADMIN TABS                                  ││             │
│  │  ──────────────    │  │  │  [Projects] [Teams] [Locations] [Roles]    ││             │
│  │    Reports        │  │  │  ─────────────────────────────────────────  ││             │
│  │  ▶ Admin          │  │  │                                              ││             │
│  │                    │  │  │  ┌──────────────────────────────────────┐   ││             │
│  │                    │  │  │  │ ## Projects                         │   ││             │
│  │                    │  │  │  │                                      │   ││             │
│  │                    │  │  │  │ Project A        [Active]  [Edit]  │   ││             │
│  │                    │  │  │  │ Project B        [Active]  [Edit]  │   ││             │
│  │                    │  │  │  │ Project C        [Inactive][Edit]  │   ││             │
│  │                    │  │  │  │                                      │   ││             │
│  │                    │  │  │  └──────────────────────────────────────┘   ││             │
│  │                    │  │  │                                              ││             │
│  └───────────────────┘  │  └──────────────────────────────────────────────┘│             │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Admin tab panels

```
PROJECTS TAB:
  ┌─────────────────────────────────────────────────────────────────┐
  │ ## Projects                                     [+ Add Project] │
  │ ─────────────────────────────────────────────────────────────── │
  │ Name          │ Status    │ Teams │ Locations │ Actions         │
  │───────────────┼───────────┼───────┼───────────┼────────────────│
  │ Project Alpha │ ● Active  │ 3     │ 5         │ [Edit] [Delete]│
  │ Project Beta  │ ● Active  │ 2     │ 2         │ [Edit] [Delete]│
  │ Project Gamma │ ○ Inactive│ 1     │ 1         │ [Edit] [Delete]│
  └─────────────────────────────────────────────────────────────────┘

TEAMS TAB:
  ┌─────────────────────────────────────────────────────────────────┐
  │ ## Teams                                         [+ Add Team]  │
  │ ─────────────────────────────────────────────────────────────── │
  │ Team          │ Project   │ Members │ Locations  │ Actions    │
  │───────────────┼───────────┼─────────┼────────────┼─────────────│
  │ Alpha-East    │ Project A │ 12     │ Gate A,B   │ [Edit]      │
  │ Alpha-West    │ Project A │ 8      │ Gate C,D   │ [Edit]      │
  │ Beta-Site     │ Project B │ 15     │ Site 1,2   │ [Edit]      │
  └─────────────────────────────────────────────────────────────────┘

LOCATIONS TAB:
  ┌─────────────────────────────────────────────────────────────────┐
  │ ## Locations                                    [+ Add Location]│
  │ ─────────────────────────────────────────────────────────────── │
  │ Location       │ Project   │ Type    │ Status     │ Actions    │
  │────────────────┼───────────┼─────────┼────────────┼────────────│
  │ Gate A         │ Project A │ Entry   │ ● Active   │ [Edit]     │
  │ Gate B         │ Project A │ Entry   │ ● Active   │ [Edit]     │
  │ Building 1     │ Project A │ Zone    │ ● Active   │ [Edit]     │
  └─────────────────────────────────────────────────────────────────┘

ROLES TAB:
  ┌─────────────────────────────────────────────────────────────────┐
  │ ## Roles                                          [+ Add Role]  │
  │ ─────────────────────────────────────────────────────────────── │
  │ Role Code      │ Label          │ Permissions  │ Actions      │
  │────────────────┼────────────────┼──────────────┼──────────────│
  │ SiteSupervisor │ Site Supervisor│ plan, review │ [Edit]      │
  │ ProjectManager │ Project Manager│ plan, admin  │ [Edit]      │
  │ SafetyOfficer  │ Safety Officer │ review, block│ [Edit]      │
  └─────────────────────────────────────────────────────────────────┘
```

## Components built in this phase

### Report dashboard components

| Component | File | Description |
|-----------|------|-------------|
| `ReportsPage` | `reports/reports-page.tsx` | Main reports workspace shell |
| `ReportTypeSelector` | `reports/report-type-selector.tsx` | Tab bar for report categories |
| `KpiGrid` | `reports/kpi-grid.tsx` | Row of `PlanningStatCard` for KPIs |
| `ThroughputChart` | `reports/throughput-chart.tsx` | Bar chart: tasks per sprint |
| `BlockerAgingChart` | `reports/blocker-aging-chart.tsx` | Bar chart: blockers by age |
| `CommitmentReliabilityChart` | `reports/commitment-reliability-chart.tsx` | Line chart: % delivered per sprint |
| `WipFlowChart` | `reports/wip-flow-chart.tsx` | Cumulative flow diagram |
| `ReportExportButton` | `reports/report-export-button.tsx` | CSV/PNG export for current report |

Charts: use Recharts (already in repo) or Chart.js.

### Admin components

| Component | File | Description |
|-----------|------|-------------|
| `AdminPage` | `admin/admin-page.tsx` | Main admin shell with tab navigation |
| `AdminTabs` | `admin/admin-tabs.tsx` | Projects / Teams / Locations / Roles tabs |
| `AdminTable` | `admin/admin-table.tsx` | Generic sortable admin table |
| `AdminTableRow` | `admin/admin-table-row.tsx` | Single row with actions |
| `AdminTableCell` | `admin/admin-table-cell.tsx` | Typed cells (text, status, count, actions) |
| `ProjectAdminPanel` | `admin/project-admin-panel.tsx` | Project CRUD panel |
| `TeamAdminPanel` | `admin/team-admin-panel.tsx` | Team CRUD panel |
| `LocationAdminPanel` | `admin/location-admin-panel.tsx` | Location CRUD panel |
| `RoleAdminPanel` | `admin/role-admin-panel.tsx` | Role config panel (read-only display + guardrail notes) |
| `AdminDialog` | `admin/admin-dialog.tsx` | Generic create/edit dialog |
| `AdminConfirmDelete` | `admin/admin-confirm-delete.tsx` | Delete confirmation dialog |

### Shared (Phase 0)

All card, badge, button, and layout utilities come from Phase 0.

## Key data entities

| Entity | Source | Notes |
|--------|--------|-------|
| `Task` | `@v2e/contracts` | Throughput, WIP/flow aggregations |
| `Blocker` | `@v2e/contracts` | Blocker aging aggregations |
| `Commitment` | `@v2e/contracts` | Commitment reliability |
| `ImprovementAction` | `@v2e/contracts` | DMAIC trends |
| `Project` | `@v2e/contracts` | Admin: projects |
| `Team` | `@v2e/contracts` | Admin: teams |
| `Location` | `@v2e/contracts` | Admin: locations |
| `User` | `@v2e/contracts` | Admin: users |
| `RoleTypeCode` | `@v2e/contracts` | Admin: roles (canonical codes) |

## Routes

```
/console/reports                     → ReportsPage
/console/reports/throughput         → Throughput report
/console/reports/blocker-aging      → Blocker aging report
/console/reports/commitment-reliability → Commitment rate report
/console/reports/wip-flow          → WIP/flow report
/console/reports/improvement        → DMAIC improvement trends
/console/admin                      → AdminPage (projects tab default)
/console/admin/projects             → Project admin
/console/admin/teams                → Team admin
/console/admin/locations            → Location admin
/console/admin/roles               → Role admin
```

## Design token usage

| Token | Applied where |
|-------|--------------|
| `--color-planning-slate` | Admin section styling |
| `--color-planning-slate-subtle` | Admin badge backgrounds |
| `--color-planning-amber` | SLA reports, at-risk KPIs |
| `--color-surface-brand` | On-track KPIs, positive trends |
| `--color-surface-error` | Negative trends, overdue |
| Charts | Use enact/brand colors for series |
| `rounded-lg` | Stat cards, chart containers |

## Empty and error states

| State | Component | Shown when |
|-------|-----------|------------|
| No report data | `PlanningEmptyState` + message | No tasks/blockers for period |
| No projects | `PlanningEmptyState` + "Add first project" CTA | Admin: no projects |
| Insufficient data | Inline message | Report needs minimum data points |
| Loading | `PlanningSkeleton` + chart outlines | API fetching |
| Error | `PlanningErrorState` | API failure |

## Exit criteria

1. Reports page shows KPI grid with all 4 KPIs populated
2. Report type selector switches between all 5 report types
3. Throughput chart shows bars per sprint
4. Blocker aging chart shows count by age bucket
5. Commitment reliability chart shows % delivered per sprint
6. WIP/flow chart shows cumulative flow over time
7. Admin tabs switch between Projects, Teams, Locations, Roles
8. Admin tables are sortable by column
9. Create/Edit dialog opens for all entity types
10. Delete confirmation works
11. Report export button downloads current view as CSV

## Admin guardrails

The admin panel is **guardrailed** — it manages team/project/location membership and role assignments, but does NOT expose raw permission editing. Role definitions (what each role code can do) are defined in contracts and documented, not edited in the UI.

## Out of scope

- User management (invite, remove users) — external identity provider
- Raw RBAC permission editor
- Custom report builder
- Scheduled report email delivery
- Actual API persistence for admin changes (mock handlers)

## Dependencies

- All previous phases complete
- Phase 0 (components) complete
- `@v2e/contracts` for all entity types
- TanStack Query for data fetching
- Recharts or Chart.js for charts

## Files created in this phase

```
apps/planning-web/src/routes/console/
├── reports.tsx                      # Reports main route
├── reports.throughput.tsx           # Throughput report
├── reports.blocker-aging.tsx       # Blocker aging report
├── reports.commitment-reliability.tsx # Commitment rate report
├── reports.wip-flow.tsx            # WIP/flow report
├── reports.improvement.tsx         # DMAIC trends
└── admin/
    ├── index.tsx                   # Admin main route
    ├── projects.tsx               # Project admin
    ├── teams.tsx                  # Team admin
    ├── locations.tsx              # Location admin
    └── roles.tsx                  # Role admin

apps/planning-web/src/components/planning/
├── reports/
│   ├── reports-page.tsx
│   ├── report-type-selector.tsx
│   ├── kpi-grid.tsx
│   ├── throughput-chart.tsx
│   ├── blocker-aging-chart.tsx
│   ├── commitment-reliability-chart.tsx
│   ├── wip-flow-chart.tsx
│   └── report-export-button.tsx
└── admin/
    ├── admin-page.tsx
    ├── admin-tabs.tsx
    ├── admin-table.tsx
    ├── admin-table-row.tsx
    ├── admin-table-cell.tsx
    ├── project-admin-panel.tsx
    ├── team-admin-panel.tsx
    ├── location-admin-panel.tsx
    ├── role-admin-panel.tsx
    ├── admin-dialog.tsx
    └── admin-confirm-delete.tsx
```

Parent: [`AGENTS.md`](AGENTS.md).
