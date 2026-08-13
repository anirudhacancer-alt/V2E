# Tasks router

**Source:** `apps/api/src/routes/tasks-flat.ts` (flat CRUD), `task-reviews.ts` (nested review actions). There is no `tasks.ts` in the pilot API.

**Mount:**

- `v1.route("/tasks", tasksFlatRouter)` → **`/v1/tasks`**
- `v1.route("/tasks", taskReviewsRouter)` → same prefix (review commands)

## Flat routes (`/v1/tasks`)

Per `NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md` §12.12:

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/tasks` | No | List tasks with filters (`projectId`, `siteId`, `sourceUpdateId`, `status`, `kind`, `reporterTeamMemberId`, `severity`, `ownerId`, `dueBefore`, `dueAfter`, `overdueOnly`, `department`, …) and pagination. |
| `GET` | `/v1/tasks/:taskId` | No | Get single task by ID with full details including transcript notes and attachments. |
| `PATCH` | `/v1/tasks/:taskId` | Bearer | Update task status (Active, Blocked, Done). |
| `POST` | `/v1/tasks` | Bearer | Create new task (requires `projectId` in body). |

## Technical review commands

Implemented as nested task routes:

- `POST /v1/tasks/:taskId/review/submit`
- `POST /v1/tasks/:taskId/review/approve`
- `POST /v1/tasks/:taskId/review/request-rework`

Queue list: **`GET /v1/reviews?projectId=...`** — [reviews.md](reviews.md).

## Dependencies

Dependency edges (`POST` / `GET` / `PATCH` / `DELETE` / override) live under **`/v1/dependencies`** — [dependencies.md](dependencies.md). The pilot API does **not** expose `GET /v1/projects/:projectId/tasks/:taskId/dependencies`; use **`GET /v1/dependencies/:dependencyId`** or list/filter dependencies via the supported dependency APIs.

---

## Related

- [dependencies.md](./dependencies.md)
- [updates.md](./updates.md)
- [update.md](../../data-model/update.md) (updates ↔ tasks)
- [updates-tasks-workflow-invariants.md](../../data-model/invariants/updates-tasks-workflow-invariants.md)

Parent: [AGENTS.md](AGENTS.md).
