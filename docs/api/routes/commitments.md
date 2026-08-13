# `/v1/commitments`

**Source:** `apps/api/src/routes/commitments.ts`  
**Mount:** `v1.route("/commitments", commitmentsRouter)`.

Creates require **`projectId` in the JSON body**. Lists filter with **`projectId` query** (and optional filters).

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `POST` | `/v1/commitments` | Bearer | Create commitment — body includes `projectId`, `title`, `ownerId`, `assigneeRoleCode`, `commitDate`, `targetDate`, optional fields. |
| `GET` | `/v1/commitments` | No | List commitments (`projectId` and other filters as implemented). |
| `GET` | `/v1/commitments/:commitmentId` | Bearer | Get commitment by ID. |
| `PATCH` | `/v1/commitments/:commitmentId` | Bearer | Update commitment (status transitions enforced in handler). |
| `GET` | `/v1/commitments/horizon` | No | Task-derived commitment **cards by horizon** (`projectId` required; optional `status`, `ownerId`, `horizon` filters). Replaces older nested `GET /v1/projects/:projectId/commitments`. |

**Project context:** [projects.md](projects.md) lists this route alongside other `projectId` query routes.

**Data model:** [commitment.md](../../data-model/commitment.md).

Parent: [AGENTS.md](AGENTS.md).
