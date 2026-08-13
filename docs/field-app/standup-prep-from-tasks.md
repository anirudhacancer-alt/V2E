# Standup prep: task-derived lists (no line-item CSVs or tables)

Standup **prep** for execution leads and **historical standup detail** derive `planned`, `completed`, `blocked`, and **carry-forward** lists from **`tasks`** (and optional joins to `updates` later). We removed redundant persisted rows: standalone CSVs (`standup_planned_items.csv`, etc.) and DB tables (`standup_planned_items`, …) are gone; migration `0004_drop_standup_line_item_tables.sql` drops those tables.

## Timezone

Rules use **UTC calendar days** (`YYYY-MM-DD` from ISO timestamps via `getUTC*`). This matches SQLite-stored ISO strings and keeps “today” / “yesterday” unambiguous in code (`apps/api/src/lib/standup-prep-from-tasks.ts`, `packages/database/src/demo-seed/standup-aggregates.ts`, `docs/demo/tools/validate_demo_datasets.mjs`).

## API: `GET …/standup-prep`

Response shape: `packages/contracts/src/api-responses.ts` — `StandupPrepResponseSchema`.

| Section (UI) | Field(s) | Rule |
|----------------|----------|------|
| **Planned for today** | `plannedItems` | `tasks.status === "In-progress"` and **due date** (UTC) equals **today**. |
| **Completed yesterday** | `yesterdayCompleted` | `tasks.status === "Done"` and **`completedAt`** (UTC) falls on **yesterday**. |
| **Needs discussion — blockers** | `activeBlockers` | Tasks whose **derived UI state** is `Blocked` via `deriveSupervisorTaskState` (`apps/api/src/lib/task-state.ts`). **Note:** that helper returns `Overdue` before it evaluates DB `Blocked`, so a task with `status === "Blocked"` but **due in the past** surfaces as **`Overdue`**, not `Blocked`, in derived UI state — only **non-overdue** blocked rows appear here. |
| **Needs discussion — carry-forward** | `carryForwardDueYesterday` | **Not** the old CSV “yesterday blocked” concept. **Carry-forward** = work that was **planned for yesterday** but is **still incomplete** and **not blocked**: DB **`status === "In-progress"`**, **`dueDate`** (UTC) equals **yesterday**. This excludes `Done` and `Blocked` task rows by definition. |

**Merge in the UI:** “Needs discussion” combines **`activeBlockers`** and **`carryForwardDueYesterday`** (different semantics; both surface under one heading).

## Historical standup `GET /standups/:id`

**Removed.** There is no persisted `standups` table or standup-by-id route; prep uses **`standupPrepDateBounds()`** against **today** (`GET /v1/standup-prep?projectId=...`). For a past calendar day, the helper **`standupPrepDateBoundsForStandupDate`** exists for future use if we add a date query param or historical view.

## Demo bundles

- No `standups.csv` in the current validator bundle list (`docs/demo/tools/validate_demo_datasets.mjs` — `attendance_sessions.csv` + `attendances.csv` instead).
- **List types** for the UI remain in **`StandupPrepResponseSchema`** and `packages/contracts/src/standup.ts` (planned/completed/blocked item shapes); they are **not** duplicate rows in CSV.

## Related

- [update.md](../data-model/update.md) (**Updates ↔ tasks**) — how notes connect to tasks (`sourceUpdateId`, `linkedTaskId`); AI/risk child tables are not redundant with task rows.

## Code map

| Area | Location |
|------|----------|
| Date bounds + filters | `apps/api/src/lib/standup-prep-from-tasks.ts` |
| Standup prep route | `apps/api/src/routes/projects.ts` |
| Standup summary (AI) | `POST /v1/ai/standup-summary` in `apps/api/src/routes/ai-jobs.ts` |
| Contracts | `StandupPrepResponseSchema`, `StandupPrepCarryForwardItemSchema` — `packages/contracts/src/api-responses.ts` |
| Field app UI | `apps/field-app/src/routes/supervisor/standup.tsx` |
