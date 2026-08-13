# Root app routes

**Source:** `apps/api/src/index.ts` (Hono app before `/v1` mount).

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/` | Short JSON metadata (`V2E API`, demo hint, `/v1` pointer). |
| `GET` | `/health` | Health probe (`status`, `timestamp`). **Unversioned** for load balancers. |
| `GET` | `/uploads/*` | Serves files from `apps/api/uploads` (audio and images for `update_attachments`). **Unversioned**; demo/pilot only — production should use object storage + signed URLs. Path traversal blocked (`..` rejected). |

CORS and static media setup live in `index.ts`. Versioned JSON is under **`/v1`** — see [v1.md](v1.md).

**Web dev:** `apps/field-app` proxies `/v1` and `/uploads` when `VITE_API_URL` is empty — [Web UI and Enact UI](../../field-app/web-ui-enact-ui.md).

Parent: [AGENTS.md](AGENTS.md).
