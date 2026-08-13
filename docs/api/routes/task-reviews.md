# Task review actions

**Source:** `apps/api/src/routes/task-reviews.ts`  
**Mount:** `v1.route("/tasks", taskReviewsRouter)` — full paths are nested under `/v1/tasks/:taskId/review/...`.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `POST` | `/v1/tasks/:taskId/review/submit` | Bearer | Submit task for technical review; body includes `{ projectId, submittedBy, notes? }`. |
| `POST` | `/v1/tasks/:taskId/review/approve` | Bearer | Approve after technical review; body includes `{ projectId, approvedBy, notes? }`. |
| `POST` | `/v1/tasks/:taskId/review/request-rework` | Bearer | Request rework; body includes `{ projectId, requestedBy, reason }`. |

**Queue (read model):** `GET /v1/reviews?projectId=...` — [reviews.md](reviews.md).

Parent: [AGENTS.md](AGENTS.md).
