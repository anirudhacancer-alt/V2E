# Entity: Task dependency

**Table:** `task_dependencies`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`taskDependencies`)

## Purpose

Explicit predecessor/successor edges between tasks in the same project; supports hard constraints and cycle checks.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `tenantId` | text | notNull | |
| `projectId` | text | notNull, FK → `projects.id` | |
| `predecessorTaskId` | text | notNull, FK → `tasks.id` | |
| `successorTaskId` | text | notNull, FK → `tasks.id` | |
| `dependencyType` | text | notNull, default `finish_to_start` | `blocks` \| `finish_to_start` \| `start_to_start` \| `finish_to_finish` |
| `lagDays` | integer | notNull, default 0 | |
| `isHardConstraint` | integer | notNull, default 1 | SQLite boolean |
| `reason` | text | optional | |
| `createdBy` | text | notNull, FK → `team_members.id` | |
| `createdAt` | text | notNull | |
| `updatedAt` | text | notNull | |

## Contracts

- [`packages/contracts/src/dependency.ts`](../../packages/contracts/src/dependency.ts)

## API

- [dependencies.md](../api/routes/dependencies.md)
- Task-scoped summary: [tasks.md](../api/routes/tasks.md)

## See also

- [index.md](./index.md)
