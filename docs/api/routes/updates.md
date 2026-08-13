# Updates router

**Sources:** `apps/api/src/routes/updates-router.ts`, `apps/api/src/routes/update-actions.ts`, `apps/api/src/routes/update-extraction.ts`  
**Mount:** `v1.route("/updates", …)` → paths under **`/v1/updates`**.

`/v1/updates` is CRUD-first. Transcription, review confirmation, escalation, and the extraction subresource stay nested here. The one-shot extraction trigger moved to **`POST /v1/ai/voice-note-extraction`**.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/updates` | No | List updates with filters (`projectId`, …) and pagination. |
| `POST` | `/v1/updates` | Bearer | Create update. |
| `GET` | `/v1/updates/:updateId` | No | Single update + embedded AI output summary. |
| `PATCH` | `/v1/updates/:updateId` | Bearer | Patch transcript, read state, location. |
| `POST` | `/v1/updates/:updateId/transcribe` | Bearer | Transcribe audio; body includes `{ projectId }`. |
| `POST` | `/v1/updates/:updateId/confirm-review` | Bearer | Confirm extraction review; body includes `{ projectId, … }`. |
| `POST` | `/v1/updates/:updateId/escalate` | Bearer | Escalate update; body includes `{ projectId, reason? }`. |
| `GET` | `/v1/updates/:updateId/extraction` | No | Persisted extraction row (`update_ai_outputs`). |
| `PATCH` | `/v1/updates/:updateId/extraction` | Bearer | Patch extraction review fields. |

**AI extraction trigger:** `POST /v1/ai/voice-note-extraction` with `{ updateId, projectId }` — see [ai.md](ai.md) and [`../ai-runtime.md`](../ai-runtime.md).

Project scoping: `apps/api/src/lib/project-scope.ts`.

Parent: [AGENTS.md](AGENTS.md).
