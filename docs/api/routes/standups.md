# `/v1/standups`

**Source:** `apps/api/src/routes/standups.ts`  
**Mount:** `v1.route("/standups", standupsRouter)`.

List/create use **`projectId` in query** (GET) or **JSON body** (POST). Session commands are nested under the standup id. AI summary generation is no longer part of this router.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/standups?projectId=…` | No | List standup sessions (`projectId` **required**). Optional filters (`status`, date range, …). |
| `POST` | `/v1/standups` | Bearer | Create standup session — body includes `projectId`, … |
| `GET` | `/v1/standups/:standupId` | No | Get standup session. |
| `PATCH` | `/v1/standups/:standupId` | Bearer | Update standup session. |
| `POST` | `/v1/standups/:standupId/open` | Bearer | Open session; body includes `{ projectId }`. |
| `POST` | `/v1/standups/:standupId/close` | Bearer | Close session; body includes `{ projectId }`. |
| `GET` | `/v1/standups/:standupId/attendance` | No | Read roll-call attendance for one standup session. |
| `POST` | `/v1/standups/:standupId/attendance` | Bearer | Create/update roll-call attendance rows for one standup session. |

**Data model:** [standup-session.md](../../data-model/standup-session.md).

**AI summary:** see [ai.md](ai.md) for `POST /v1/ai/standup-summary`.

Parent: [AGENTS.md](AGENTS.md).
