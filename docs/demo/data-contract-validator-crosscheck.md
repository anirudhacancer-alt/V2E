# Data contracts and demo validator cross-check

This ties **demo CSV bundles**, **Zod contracts** in `packages/contracts`, and **`docs/demo/tools/validate_demo_datasets.mjs`**.

**Persistence model and ER diagram:** [entity-relationship-diagram.md](../data-model/entity-relationship-diagram.md). **Runtime schema and API field names (roles, departments, locations, integrity):** [canonical org, location, and integrity](../data-model/canonical-org-location-and-integrity.md).

## Summary

| Layer | Role |
|-------|------|
| **Demo bundles** | `docs/demo/datasets/RES-1328/` and `COM-1330/` — normalized CSVs + filtered PM exports. |
| **Contracts** | Canonical shapes for API and UI; `UpdateSchema`, `TaskSchema`, `AttendanceSessionSchema`, etc. |
| **Validator** | Reads CSVs, denormalizes nested tables where needed, parses dates/booleans, runs `safeParse` on assembled objects. |

**Update ↔ task edges** (see [update.md](../data-model/update.md)): `tasks.sourceUpdateId` (voice/AI spawned task), `updates.linkedTaskId` (human follow-up). Seeded demo data connects updates to tasks via one or both mechanisms. **`update_ai_outputs` / risk / attachments** are normalized **update** fields — they are not redundant duplicates of `tasks.csv` rows.

## Join keys (demo bundle CSVs)

| From | To | Key |
|------|-----|-----|
| `sites.csv` | `projects.csv` | `projects.siteId` → `sites.id` |
| `updates.csv` | `sites.csv` / `projects.csv` | `siteId`, `projectId` |
| `updates.csv` | `users.csv` | `recordedBy` → `users.id` |
| `update_ai_outputs.csv` | `updates.csv` | `updateId` → `updates.id` (0..1 row) |
| `update_risk_*.csv` | `updates.csv` | `updateId`; ordered by `order` |
| `update_attachments.csv` | `updates.csv` | `updateId` |
| `tasks.csv` | `updates.csv` | `tasks.sourceUpdateId` → originating note; `updates.linkedTaskId` → human follow-up on an existing task |
| `tasks.csv` | `users.csv` | `ownerId` |
| `task_attachments.csv` | `tasks.csv` | `taskId` |
| `attendance_sessions.csv` | `sites.csv` / `projects.csv` | `siteId`, `projectId` |
| `attendances.csv` | `attendance_sessions.csv`, `team_members.csv` | `sessionId`, `teamMemberId` |

**Contract scope:** Same physical `siteId` can appear in both bundles; `projectId` distinguishes contract `1328` vs `1330` projects (see `projects.csv` per bundle).

## External / reference datasets (not FK-linked to bundles)

| Dataset | Relationship |
|---------|----------------|
| `docs/demo/pm-reference/*.csv` | PM exports; filtered by `project` / `Project` when generating bundle inputs. No UUID FK into app entities in the reference tree. |
| `docs/demo/transcripts/construction_calls_dataset.csv.csv` | NLP research set; standalone IDs; vocabulary / model work, not joined to demo CRM rows. |

## Validator vs CSV columns

`validate_demo_datasets.mjs` expects these files per contract directory:

`users`, `sites`, `projects`, `locations`, `team_members`, `updates`, `update_ai_outputs`, `update_attachments`, `update_risk_downstream_effects`, `update_risk_recommended_actions`, `tasks`, `task_attachments`, `attendance_sessions`, `attendances`.

It builds nested `Update.aiOutput`, `Update.attachments`, and `Task.attachments` from child CSV rows. Location master validation is applied against `locations.csv`.

## Contract highlights

- **Update.status** (`packages/contracts/src/update.ts`): `Pending` | `Processed` | `ConvertedToTask` | `Escalated` | `Saved`.
- **Task.source** (`packages/contracts/src/task.ts`): includes `VoiceUpdate`, `AIGenerated`, etc.; `sourceUpdateId` optional (set when task came from a note).
- **Update.linkedTaskId** (`packages/contracts/src/update.ts`): optional; human follow-up on an existing task (distinct from `sourceUpdateId` on the task).
- **Attendance** (`packages/contracts/src/attendance.ts`): `attendance_sessions` + `attendances` rows; roll-call semantics per [attendance.md](../data-model/attendance.md).

## Validation command

From repository root (after building contracts):

```bash
pnpm --filter @v2e/contracts build
node docs/demo/tools/validate_demo_datasets.mjs --repo-root . --contracts 1328,1330
```

Parent: [AGENTS.md](./AGENTS.md).
