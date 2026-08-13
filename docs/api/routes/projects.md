# `/v1/projects`

**Source:** `apps/api/src/routes/projects.ts`

**Mount:** `v1.route("/projects", projectsRouter)` — paths under **`/v1/projects`**.

The projects router implements **project list and single-project CRUD** only. Older docs showed many read models nested under `/v1/projects/:projectId/...`; those are now **flat routes** with `projectId` as a **query** (GET) or **JSON body** (POST/PATCH) — see [AGENTS.md](AGENTS.md) and [`ROUTE-INVENTORY.md`](../../../ROUTE-INVENTORY.md).

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/projects` | No | List projects (demo). Query: `siteId`, `isActive`, `type`, `status`. |
| `GET` | `/v1/projects/:projectId` | No | Get project. |
| `POST` | `/v1/projects` | Bearer | Create project. |
| `PATCH` | `/v1/projects/:projectId` | Bearer | Update project. |
| `DELETE` | `/v1/projects/:projectId` | Bearer | Soft-delete project (deactivate + cancelled). |

## Project-scoped data (flat canonical routes)

| Need | Route | Doc |
| ---- | ----- | --- |
| Dashboard metrics | `GET /v1/dashboard?projectId=...` | `apps/api/src/routes/dashboard.ts` |
| Updates list | `GET /v1/updates?projectId=...` | [updates.md](updates.md) |
| Tasks list | `GET /v1/tasks?projectId=...` | [tasks.md](tasks.md) |
| Team members | `GET /v1/members?projectId=...` | [members.md](members.md) |
| Locations | `GET /v1/locations?projectId=...` | [locations.md](locations.md) |
| Standup prep read model | `GET /v1/standup-prep?projectId=...` | [`../../field-app/standup-prep-from-tasks.md`](../../field-app/standup-prep-from-tasks.md) |
| Commitment cards by horizon | `GET /v1/commitments/horizon?projectId=...` | [commitments.md](commitments.md) |
| Technical review queue | `GET /v1/reviews?projectId=...` | [reviews.md](reviews.md) |

**Note:** Task **detail / create / patch** — [tasks.md](tasks.md). Update create is **`POST /v1/updates`**; attachments are under **`/v1/attachments`**. Standup summary generation is **`POST /v1/ai/standup-summary`** — [ai.md](ai.md).

## Legacy note on uploads

Older docs may mention `uploads.ts` mounted under `/v1/projects`. Canonical create-update and attachment routes:

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `POST` | `/v1/updates` | Bearer | Create update. |
| `POST` | `/v1/attachments` | Bearer | Add attachment to an existing update or task. |

Files are written under **`apps/api/uploads`**. **Serving** URLs are **`GET /uploads/*`** on the root app — [root.md](root.md). Production object storage: [overview.md](../overview.md).

---

## Related

- [Canonical org, location, and integrity](../../data-model/canonical-org-location-and-integrity.md)
- [overview.md](../overview.md)

Parent: [AGENTS.md](AGENTS.md).
