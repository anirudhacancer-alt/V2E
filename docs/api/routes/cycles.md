# `/v1/cycles`

**Source:** `apps/api/src/routes/cycles.ts`  
**Mount:** `v1.route("/cycles", cyclesRouter)`.

Project scope is **`projectId` in the JSON body** (create) or **`projectId` query** (list), not in the URL path.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `POST` | `/v1/cycles` | Bearer | Create work cycle — body must include `projectId`, `name`, `startDate`, `endDate`, optional `status`, `goal`. |
| `GET` | `/v1/cycles?projectId=…` | Bearer | List work cycles for a project (`projectId` **required**). Optional `status`. |
| `GET` | `/v1/cycles/:workCycleId` | Bearer | Get work cycle by ID. |
| `PATCH` | `/v1/cycles/:workCycleId` | Bearer | Update work cycle. |

**Data model:** [cycle.md](../../data-model/cycle.md).

Parent: [AGENTS.md](AGENTS.md).
