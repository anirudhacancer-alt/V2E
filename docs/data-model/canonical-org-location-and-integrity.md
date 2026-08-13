# Canonical org, location, and runtime integrity

This document is the **single canonical view** for:

- SQLite **master data** and **FK columns** (roles, departments, locations)
- **Public JSON** field names on the HTTP API (aligned with `packages/contracts`)
- **Runtime behavior**: `DATA_INTEGRITY` (500) vs extraction validation (422)
- How this relates to **seed** vs **live API** (no duplicate matrices elsewhere)

Other architecture notes **link here** instead of re-listing full column/API mappings.

---

## Authority chain

| Layer | Source of truth |
| ----- | ---------------- |
| **Database shape** | `packages/database/src/schema.ts` + migrations under `packages/database/drizzle/` |
| **API / UI types** | `packages/contracts` (Zod), especially `enums.ts`, `task.ts`, `api-responses.ts`, `update.ts` |
| **Read-model assembly** | `apps/api/src/routes/*.ts` with `apps/api/src/lib/resolve-person.ts` |
| **Integrity errors** | `apps/api/src/lib/data-integrity.ts` (`DataIntegrityError`, `code: DATA_INTEGRITY`) |

---

## Master tables (SQLite)

### `role_types`

| Column | Meaning |
| ------ | ------- |
| `code` | **Primary key.** Canonical `SCREAMING_SNAKE` identifier (e.g. `SITE_SUPERVISOR`, `ENGINEER`). FK target for assignee and org-role fields. |
| `name` | Display string for UI (human-readable role title). |
| `level` | Canonical role level. Current invariant: exactly one of `manager`, `execution_lead`, `crew`. |

Role labels can vary per pillar (construction, factory, field reps), but every role code must map into this shared 3-level model.

### `departments`

| Column | Meaning |
| ------ | ------- |
| `code` | **Primary key.** Aligns with `DepartmentEnum` in `packages/contracts/src/enums.ts` (e.g. `Electrical`, `Civil`, `QAQC`). |

### `locations` (project-scoped)

| Column | Meaning |
| ------ | ------- |
| `id` | UUID; FK on `updates.locationId`, `tasks.locationId`, `update_ai_outputs.locationId`. |
| `projectId` | Scopes the row to a project. |
| `listLabel` | **Compact** one-line label for field execution lists (`locationList` in JSON). Required for integrity: if a row references `locationId`, list endpoints resolve **non-empty** `listLabel` for that id within the project. |
| `displayLabel` | Richer label; copied to `tasks.location` for legacy/display text on task rows. |

---

## FK columns on operational tables

| Table | Column | References | Notes |
| ----- | ------ | ---------- | ----- |
| `users` | `orgRoleCode` | `role_types.code` | Site/office user directory. |
| `team_members` | `orgRoleCode` | `role_types.code` | Site roster; task owner must be a team member; **task create** requires `assigneeRoleCode === team_members.orgRoleCode` for the chosen `ownerId`. |
| `tasks` | `assigneeRoleCode` | `role_types.code` | **NOT NULL** |
| `tasks` | `departmentCode` | `departments.code` | Nullable on historical rows; **create** requires a valid code. |
| `tasks` | `locationId` | `locations.id` | **NOT NULL** |
| `updates` | `locationId` | `locations.id` | **NOT NULL** |
| `update_ai_outputs` | `ownerRoleCode` | `role_types.code` | **NOT NULL** (persisted extraction) |
| `update_ai_outputs` | `departmentCode` | `departments.code` | Nullable when extraction omits discipline. |
| `update_ai_outputs` | `locationId` | `locations.id` | **NOT NULL** |

---

## Public JSON field names (HTTP API)

Use **codes + names** explicitly. Do not use a single ambiguous `role` string as the only assignee identifier.

| Concept | JSON fields |
| ------- | ----------- |
| Task discipline | `departmentCode` (`departments.code` or null on read when unset) |
| Task assignee role | `assigneeRoleCode` + `assigneeRoleName` (name from `role_types.name`) |
| Team member row | `orgRoleCode` + `roleTypeName` |
| Update + AI payload (detail) | `departmentCode` (top-level); nested `aiOutput` uses `assigneeRoleCode`, `assigneeRoleName`, `departmentCode` |
| Updates list row | `locationList` — **non-empty** string from `locations.listLabel` for the update’s `locationId` |
| Standup expected attendee | `orgRoleCode`, `roleTypeName` |

### Task creation (`POST /v1/tasks` with `projectId` in body)

Body must include:

- `departmentCode` — must exist in `departments`
- `assigneeRoleCode` — must exist in `role_types` and **match** `team_members.orgRoleCode` for `ownerId`

---

## Runtime integrity (`DATA_INTEGRITY`)

When persisted data violates master-data expectations (orphan FK, missing `role_types` row for a stored code, missing/empty `listLabel` for a referenced `locationId`, etc.), route handlers throw **`DataIntegrityError`** and return **HTTP 500** with:

```json
{ "error": { "code": "DATA_INTEGRITY", "message": "…", "details": { } } }
```

This is intentional: **no silent fallbacks** (no `?? orgRoleCode`, no empty `locationList`, no `"Unknown"` owner names) that mask bad data.

Implementation: `apps/api/src/lib/data-integrity.ts`, `apps/api/src/lib/resolve-person.ts` (strict joins), and project/task/AI routes that enforce location and role resolution.

---

## AI extraction validation (422)

Before persisting extraction output, the API validates mapping to master rows. Failures return **422** with explicit codes, for example:

- `EXTRACTION_DEPARTMENT_UNRESOLVED` / `EXTRACTION_DEPARTMENT_UNKNOWN`
- `EXTRACTION_OWNER_ROLE_UNRESOLVED`

See `apps/api/src/routes/update-actions.ts` (update-scoped commands) and `apps/api/src/routes/ai-jobs.ts` (one-shot AI jobs).

---

## Seed and CSV

- Materialization may still **read** legacy string columns from CSV (`role`, `ownerRole`, `department` labels).
- **Persisted** SQLite rows must use **canonical codes**; mapping is deterministic in `packages/database/src/demo-seed/persist.ts` and `packages/database/src/org-canonical.ts`.
- **Validation rules** for the seed pipeline: [demo-seed-script-validations.md](../demo/demo-seed-script-validations.md).

---

## Contracts reference

| File | Contents |
| ---- | -------- |
| `packages/contracts/src/enums.ts` | `DepartmentEnum`, `RoleTypeCodeSchema`, `DEPARTMENT_CODES` |
| `packages/contracts/src/task.ts` | `TaskSchema`, `TaskCardSchema`, task lifecycle |
| `packages/contracts/src/api-responses.ts` | `UpdateListItemSchema`, `StandupPrepResponseSchema`, pagination |
| `packages/contracts/src/update.ts` | Update + AI output shapes where applicable |

---

## Related documents

| Document | Topic |
| -------- | ----- |
| [update.md](./update.md) | Edges between `updates` and `tasks` (`sourceUpdateId`, `linkedTaskId`; **Updates ↔ tasks (canonical)**) |
| [demo-seed-script-validations.md](../demo/demo-seed-script-validations.md) | Seed invariants for the same canonical model |
| [overview.md](../api/overview.md) | API stack and boundaries |
| [routes/AGENTS.md](../api/routes/AGENTS.md) | Per-route API docs |
