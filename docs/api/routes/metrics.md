# `/v1/metrics`

**Source:** `apps/api/src/routes/metrics.ts`  
**Mount:** `v1.route("/metrics", metricsRouter)`.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/metrics/reliability?projectId=...` | No | Execution reliability dashboard. |
| `GET` | `/v1/metrics/pilot?projectId=...` | No | Pilot KPIs. |

Parent: [AGENTS.md](AGENTS.md).
