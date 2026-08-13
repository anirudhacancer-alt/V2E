# `/v1/dependencies`

**Source:** `apps/api/src/routes/dependencies.ts`  
**Mount:** `v1.route("/dependencies", dependenciesRouter)`.

Creates use a **flat** body: `projectId`, `predecessorTaskId`, `successorTaskId` (or legacy `taskId` for successor), `createdBy`, optional type/lag/hard/ reason. Deletes are **by dependency id** only.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `POST` | `/v1/dependencies` | Bearer | Create dependency edge. |
| `DELETE` | `/v1/dependencies/:dependencyId` | Bearer | Delete dependency. |
| `GET` | `/v1/dependencies/:dependencyId` | Bearer | Get dependency by ID. |
| `PATCH` | `/v1/dependencies/:dependencyId` | Bearer | Update dependency. |
| `POST` | `/v1/dependencies/override` | Bearer | Override hard constraint. Body: `dependencyId`, `projectId`, `reason`, optional `overriddenBy`. |

There is **no** `GET /v1/projects/:projectId/tasks/:taskId/dependencies` route; use **`GET /v1/dependencies/:dependencyId`** or create/list edges via the table above. See [tasks.md](tasks.md) for task CRUD.

**Data model:** [dependency.md](../../data-model/dependency.md).

Parent: [AGENTS.md](AGENTS.md).
