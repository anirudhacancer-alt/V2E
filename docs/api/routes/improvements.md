# `/v1/improvements`

**Source:** `apps/api/src/routes/improvements.ts`  
**Mount:** `v1.route("/improvements", improvementsRouter)`.

List/create use **`projectId` in query** (GET) or **JSON body** (POST).

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/improvements?projectId=…` | No | List improvement actions (`projectId` **required**). Optional `status`, `category`, `ownerId`. |
| `POST` | `/v1/improvements` | Bearer | Create improvement action — body includes `projectId`, … |
| `GET` | `/v1/improvements/:improvementActionId` | No | Get by ID. |
| `PATCH` | `/v1/improvements/:improvementActionId` | Bearer | Update. |

**Execution reliability and pilot KPIs** are separate mounts — [metrics.md](metrics.md).

**Technical review task commands** — [task-reviews.md](task-reviews.md).

**Data model:** [improvement.md](../../data-model/improvement.md).

Parent: [AGENTS.md](AGENTS.md).
