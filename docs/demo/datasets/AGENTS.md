# Demo Datasets (Contract-Schema Aligned)

CSV files under `docs/` are stored with **Git LFS** (see root `.gitattributes`). After clone, run `git lfs install` and `git lfs pull` so full CSV content is present locally.

This folder contains demo bundles split by contract (`project`) ID. Each bundle lives in a **project-code folder** (not `contract-<id>`):

- `RES-1328/` — contract **1328**
- `COM-1330/` — contract **1330**
- `PROC-2101/` — contract **2101** (factory process operations)
- `PKG-2102/` — contract **2102** (factory packaging and dispatch)

`pnpm --filter @v2e/database db:seed` maps contract IDs to the folders above and rematerializes time-sensitive fields relative to the current day. For deterministic demos, pass `--anchor-date YYYY-MM-DD`. Legacy `contract-1328/` layouts are still accepted by `docs/demo/tools/validate_demo_datasets.mjs` if present.

Factory bundles (`PROC-2101`, `PKG-2102`) share a common site and site manager so project switching can stay within one operational campus context.

Each bundle combines:

1. Real filtered PM exports
2. Synthetic operational data aligned to `packages/contracts/src` schemas and enums
3. Shared-site modeling, where multiple projects can belong to the same site

## Real Filtered Source Files Per Contract

- `pm_tasks_contract_<id>.csv` from [docs/demo/pm-reference/Construction_Data_PM_Tasks_All_Projects.csv](../pm-reference/Construction_Data_PM_Tasks_All_Projects.csv) where `project == <id>`
- `pm_forms_contract_<id>.csv` from [docs/demo/pm-reference/Construction_Data_PM_Forms_All_Projects.csv](../pm-reference/Construction_Data_PM_Forms_All_Projects.csv) where `Project == <id>`

## Contract-Schema CSV Files Per Contract

- `users.csv` -> `UserSchema`
- `sites.csv` -> `SiteSchema`
- `projects.csv` -> `ProjectSchema` (`siteId` link enables one-site-many-projects)
- `team_members.csv` -> `TeamMemberSchema`
- `updates.csv` -> `UpdateSchema` (base fields; optional `linkedTaskId` for human follow-up on a task — may be empty in raw CSV; **seed** assigns edges; see [update.md](../../data-model/update.md))
- `update_attachments.csv` -> `Update.attachments[]` (`Image` / `Audio` / `Video` / `Document`)
- `update_ai_outputs.csv` -> `AIProcessedOutputSchema` (flattened, one row per `updateId`) plus explicit review contract columns:
  `reviewRequired`, `reviewPrompt`, `reviewReasonsJson`, `reviewFieldsJson`, `reviewedAt`, `reviewedBy`
- `update_risk_downstream_effects.csv` -> `RiskAssessment.downstreamEffects[]`
- `update_risk_recommended_actions.csv` -> `RiskAssessment.recommendedActions[]`
- `tasks.csv` -> `TaskSchema`
- `task_attachments.csv` -> `Task.attachments[]`
- `attendance_sessions.csv` -> `AttendanceSessionSchema` (one row per roll-call / “standup as a point in time”; `sessionDate` is `YYYY-MM-DD` UTC)
- `attendances.csv` -> `AttendanceSchema` (`sessionId` → `attendance_sessions.id`; **not** `standupId`)
- `update_attachments.csv` may include optional **`taskId`** (denormalized for task-level media queries; seed can fill from tasks + updates if omitted)

**Legacy files (not loaded by `db:seed` or `validate_demo_datasets.mjs`):** `standups.csv` and `standup_attendance_records.csv` may remain in the tree for historical PM-style exports; the app DB uses **`attendance_sessions` + `attendances`** instead.

Standup **prep lists** (`planned` / `completed` / `blocked`) are **not** CSV rows — they are derived from **`tasks.csv`** at read time (same UTC rules as `GET …/standup-prep`). See [standup-prep-from-tasks](../../field-app/standup-prep-from-tasks.md).

## Notes on Types

- Enum values are generated from `packages/contracts/src/enums.ts`.
- Media attachment values are generated from `packages/contracts/src/media.ts`.
- IDs are UUID format strings.
- Date/datetime columns are ISO 8601 strings for easy conversion to JS `Date`.
- Rows with a `createdAt` may omit `updatedAt`; seeding and validation treat missing `updatedAt` as equal to `createdAt`.
- Nested objects/arrays are normalized into child CSV files.
- `Task`, `Update`, and `attendance_sessions` rows include `projectId` and `siteId` where applicable.
- `1328` and `1330` share the same `siteId` while using distinct `projectId` values.
- Review intent is part of the dataset itself, not inferred only at seed time. Any reviewable AI row should carry an explicit supervisor-facing ask beginning with `Confirm:`.

## Deterministic Regeneration

Run from repo root (use `.` instead of a machine-specific path):

`python docs/demo/tools/generate_demo_datasets.py --repo-root . --contracts 1328 1330 --rows 120`

Factory bundle generation:

`node docs/demo/tools/generate_factory_demo_datasets.mjs --rows=80`

Output summary is written to:

- `docs/demo/datasets/generation_summary.csv`

## End-to-End Zod Validation

1. Build contracts package:

`pnpm --filter @v2e/contracts build`

2. Validate generated CSV bundles against actual schemas:

`node docs/demo/tools/validate_demo_datasets.mjs --repo-root . --contracts 1328,1330`
