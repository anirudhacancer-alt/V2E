# Planning console — delivery plans

Active **planning-web** delivery tracking: phased work for `apps/planning-web`, aligned with [`AGILE-EXECUTION-DATA-MODEL.md`](../../strategy/AGILE-EXECUTION-DATA-MODEL.md) and the planning console IA in [`PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md`](../../strategy/PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md).

## Critical implementation rule

- **Enact UI** primitives only for UI. **Do not** import app-level React from `apps/field-app`, `apps/mobile`, or `apps/marketing-site`. Use a **separate** global CSS entry and theme/flavour for `apps/planning-web` (see [ADR 0003](../../architecture/adr/0003-independent-enact-ui-surfaces-no-cross-app-react.md)).

## Plans

| Plan | Status | Focus |
|------|--------|-------|
| [PLAN-OVERVIEW.md](PLAN-OVERVIEW.md) | Active | Shell layout diagram, screen map, phase summary |
| [phase-0-components-inventory.md](phase-0-components-inventory.md) | Planned | **Design tokens on enact-ui** — `planning-material-*` CSS, wrapper components, layout utilities |
| [phase-1-shell-and-navigation.md](phase-1-shell-and-navigation.md) | Planned | App shell, routes, left rail, top bar, workspace context |
| [phase-2-review-queue-workspace.md](phase-2-review-queue-workspace.md) | Planned | Review queue workspace (default landing) |
| [phase-3-task-workspace.md](phase-3-task-workspace.md) | Planned | Task workspace (table, board, timeline) |
| [phase-4-sprint-board-and-commitments.md](phase-4-sprint-board-and-commitments.md) | Planned | Sprint board, work cycles, commitments |
| [phase-5-technical-review-and-blockers.md](phase-5-technical-review-and-blockers.md) | Planned | Technical review, blocker workspace |
| [phase-6-standup-prep-and-schedule.md](phase-6-standup-prep-and-schedule.md) | Planned | Standup prep, schedule |
| [phase-7-reports-and-admin.md](phase-7-reports-and-admin.md) | Planned | Reports, admin |

> **Phase 0 is the critical foundation.** Every subsequent phase depends on the design tokens, `planning-material-*` CSS classes, and `Planning*` wrapper components built there. Start here before any UI work begins.

Update the **Status** column as phases land.

Update the **Status** column as phases land.

Parent: [`../AGENTS.md`](../AGENTS.md).
