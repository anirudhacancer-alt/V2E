# HTTP API (`docs/api/`)

**Scope:** How `apps/api` exposes routes (`/v1`), **per-route documentation** aligned with `apps/api/src/routes/`, and how **`packages/ai`** + **`ai-gateway`** fit the runtime. For **SQLite entities and contracts**, see [`../data-model/`](../data-model/AGENTS.md). For **field app** UI specs, see [`../field-app/`](../field-app/AGENTS.md).

## Entry points

| Document | Role |
| -------- | ---- |
| [overview.md](overview.md) | Stack, versioning, auth shape, global rules |
| [ai-runtime.md](ai-runtime.md) | `packages/ai`, gateway reuse, config, idempotency, auto-task |
| [routes/AGENTS.md](routes/AGENTS.md) | Index of route docs (one file per `/v1/<route-parent>`) |

Parent: [../AGENTS.md](../AGENTS.md).
