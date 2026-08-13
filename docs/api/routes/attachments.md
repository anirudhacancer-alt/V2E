# `/v1/attachments`

**Source:** `apps/api/src/routes/attachments.ts`  
**Mount:** `v1.route("/attachments", attachmentsRouter)`.

This is the unified public attachment facade. The API uses `parentType` and `parentId` instead of separate task/update attachment route parents.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/attachments?parentType=task\|update&parentId=...` | No | List attachments for one task or update. |
| `GET` | `/v1/attachments/:attachmentId` | No | Get one attachment. |
| `POST` | `/v1/attachments` | Bearer | Create attachment for a task or update. Accepts JSON or multipart form data with `parentType` and `parentId`. |
| `DELETE` | `/v1/attachments/:attachmentId` | Bearer | Delete one attachment. |

Implementation detail: the route still dispatches to the existing `task_attachments` and `update_attachments` tables internally.

Parent: [AGENTS.md](AGENTS.md).
