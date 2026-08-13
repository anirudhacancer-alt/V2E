# `/v1/ai`

**Source:** `apps/api/src/routes/ai-jobs.ts`  
**Mount:** `v1.route("/ai", aiJobsRouter)`.

Use this namespace for **one-shot AI jobs** that are not modeled as CRUD on a persisted resource.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `POST` | `/v1/ai/voice-note-extraction` | Bearer | Run extraction for one update; body includes `{ updateId, projectId }`. Persists/updates the extraction row and may auto-create a task. |
| `POST` | `/v1/ai/standup-summary` | Bearer | Generate a standup summary for one project; body includes `{ projectId }`. Returns generated text only and does **not** persist a summary row. On AI/runtime failure, responds with **`{ error: { code, message, details? } }`** and **`502`** (or **`503`** when the gateway signals unavailable). There is **no** template or non-AI fallback body. |

**Related**

- [updates.md](updates.md) — update CRUD, nested update actions, nested extraction subresource
- [standups.md](standups.md) — standup sessions and nested attendance/open/close commands
- [`../ai-runtime.md`](../ai-runtime.md) — AI gateway/runtime behavior

Parent: [AGENTS.md](AGENTS.md).
