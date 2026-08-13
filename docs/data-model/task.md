# Entity: Task (and attachments)

**Primary table:** `tasks`  
**Child table:** `task_attachments`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts)

## Purpose

**Execution work item**: title, description, owner, assignee role, severity, department, location, lifecycle **status**, source, dates. Links back to a spawning update via **`sourceUpdateId`** when created from voice/AI.

## `tasks` Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the task |
| `siteId` | text | notNull | FK to `sites.id` |
| `projectId` | text | notNull | FK to `projects.id` |
| `title` | text | notNull | Task title |
| `description` | text | notNull | Task description |
| `ownerId` | text | notNull | User ID of task owner |
| `assigneeRoleCode` | text | notNull | FK to `role_types.code` |
| `severity` | text | notNull | Task severity level |
| `departmentCode` | text | optional | FK to `departments.code` |
| `createdBy` | text | optional | User ID who created the task |
| `updatedBy` | text | optional | User ID who last updated the task |
| `location` | text | notNull | Location text (denormalized) |
| `locationId` | text | notNull | FK to `locations.id` |
| `status` | text | notNull | Task status |
| `source` | text | notNull | Source of task (AI, manual, etc.) |
| `sourceUpdateId` | text | optional | FK to `updates.id` (if spawned from voice) |
| `startDate` | text | notNull | Task start date |
| `dueDate` | text | notNull | Task due date |
| `completedAt` | text | optional | When task was completed |
| `createdAt` | text | notNull | Timestamp |
| `updatedAt` | text | notNull | Timestamp |

## `task_attachments` Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of attachment |
| `taskId` | text | notNull | FK to `tasks.id` |
| `url` | text | notNull | Attachment URL |
| `type` | text | notNull | Attachment type (image, video, etc.) |
| `uploadedAt` | text | notNull | Timestamp |

## Edge from updates

If `tasks.sourceUpdateId` is set, that task was created from the referenced update. If `updates.linkedTaskId` is set, the update is a follow-up on an existing task. See [`update.md`](./update.md) (**Updates ↔ tasks (canonical)**).

## Child: `task_attachments`

Media attached to the task (distinct from update attachments).

## Contracts

- [`packages/contracts/src/task.ts`](../../packages/contracts/src/task.ts)
- [`packages/contracts/src/media.ts`](../../packages/contracts/src/media.ts)

## Enums

Defined in [`packages/contracts/src/enums.ts`](../../packages/contracts/src/enums.ts) unless noted.

| Field (contract) | Zod | Values |
| ---------------- | --- | ------ |
| `status` | `TaskStatusEnum` | `Review`, `New`, `Planned`, `In-progress`, `Blocked`, `Done` |
| `severity` | `SeverityEnum` | `Critical`, `High`, `Medium`, `Low` |
| `departmentCode` | `DepartmentEnum` (optional) | See [department.md](./department.md) |
| `assigneeRoleCode` | `RoleTypeCodeSchema` | See [role.md](./role.md) |
| `source` | `z.enum` in `task.ts` | `Manual`, `VoiceUpdate`, `AIGenerated`, `Escalated` |

**Attachments** (`MediaAssetSchema`): `type` uses **`MediaTypeEnum`** (`Image`, `Audio`, `Video`, `Document`) in [`media.ts`](../../packages/contracts/src/media.ts).

**Note:** Field-app `PATCH` in demos may restrict **`status`** to a subset (e.g. `Active` / `Blocked` / `Done`) depending on API layer—canonical contract list is above.

## API Endpoints

### Flat Routes (Phase F)

Implemented per `NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md` §12.12:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/tasks` | List tasks with filters (projectId, siteId, sourceUpdateId, status, kind, reporterTeamMemberId, severity, ownerId, dueBefore, dueAfter, overdueOnly, department) and pagination |
| `GET` | `/v1/tasks/:taskId` | Get single task by ID with full details including transcript notes and attachments |
| `PATCH` | `/v1/tasks/:taskId` | Update task status (Active, Blocked, Done) |
| `POST` | `/v1/tasks` | Create new task (requires projectId in body) |

### Dependencies and reviews

- **Dependencies:** `POST` / `GET` / `PATCH` / `DELETE` / override under **`/v1/dependencies`** — [dependencies.md](../api/routes/dependencies.md). There is no project-prefixed task dependency path.
- **Technical review commands:** nested under **`/v1/tasks/:taskId/review/...`** — [task-reviews.md](../api/routes/task-reviews.md).

### Implementation

- **Flat routes source:** `apps/api/src/routes/tasks-flat.ts`
- **Flat task API:** [tasks.md](../api/routes/tasks.md)

## Project Scope Integrity

All task write operations enforce project-scope integrity:

- **Flat creation** (`POST /v1/tasks`): Validates `projectId` in body exists, then validates all FKs (location, owner, department, role type) belong to that project
- **Flat update** (`PATCH /v1/tasks/:taskId`): Uses task's existing `projectId` for audit logging
- **Cross-project validation**: Returns 400 error if any referenced entity doesn't belong to the specified project

## See also

- [index.md](./index.md) — data model index
- [update.md](./update.md) — update entity and task linkage
