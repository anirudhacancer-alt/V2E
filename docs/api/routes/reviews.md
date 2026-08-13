# `/v1/reviews`

**Mount:** `v1.route("/reviews", reviewsRouter)`.

**Router module:** `apps/api/src/routes/reviews.ts` — technical review queue read model at **`GET /v1/reviews`**. Review **actions** live on [tasks.md](tasks.md) as nested task routes.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/reviews?projectId=...` | No | Technical review queue for one project. Optional pagination stays in query params. |

**Related**

- [tasks.md](tasks.md) — nested task review actions
- [task-reviews.md](task-reviews.md) — task review action details

Parent: [AGENTS.md](AGENTS.md).
