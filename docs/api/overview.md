# HTTP API overview

**Role:** `apps/api` is the **HTTP boundary** for the V2E field execution experience: versioned JSON under `/v1`, SQLite via shared packages, and AI orchestration in `packages/ai` (not direct provider SDKs in route handlers).

Per-route docs (source of truth for paths and code locations): [`routes/AGENTS.md`](routes/AGENTS.md). **AI runtime and gateway** boundaries: [`ai-runtime.md`](ai-runtime.md).

```text
apps/field-app  ──HTTP──►  apps/api (Hono)
                            │
                            ├──►  packages/database (SQLite + Drizzle)
                            ├──►  packages/contracts (Zod DTOs / enums)
                            └──►  packages/ai (TypeScript AI orchestration)
                                         │
                                         └──►  ai-gateway
```

## Stack

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| **Runtime** | Bun | `apps/api` uses `bun run`; align deployment docs with the repo. |
| **Server** | Hono | JSON API for web and mobile shells. |
| **Persistence** | SQLite via `@v2e/database` | Demo DB path from env (see `apps/api/README.md`). |
| **Types** | `packages/contracts` | Zod schemas and enums for API-facing shapes. |
| **AI** | `packages/ai` + `ai-gateway` | Provider routing stays in the gateway, not in route files. |

## Versioning and probes

- **Versioned API** under **`/v1`** so future `/v2` can ship without colliding with probes.
- **`GET /health`** and **`GET /`** on the app root are **unversioned** (load balancers, quick checks). See [`routes/root.md`](routes/root.md).
- **`GET /v1`** metadata, **`GET /v1/ping`**, **`GET /v1/debug/db-summary`** — [`routes/v1.md`](routes/v1.md).

## Demo / pilot auth

Lightweight **Bearer token** on mutating routes (`POST`/`PATCH`); many `GET` routes stay open for field-app convenience. **Project scoping** for persisted entities uses **`projectId` in the query string for GET** and **the JSON body for POST/PATCH** on flat routes (`/v1/commitments`, `/v1/cycles`, `/v1/metrics/...`). [ADR 0005 — Bearer token authentication](../architecture/adr/0005-bearer-token-authentication-pattern.md).

## Route shape

**Normative index:** [`routes/AGENTS.md`](routes/AGENTS.md). **Generated path list (CI-checked):** [`../../ROUTE-INVENTORY.md`](../../ROUTE-INVENTORY.md). Entity CRUD uses **one segment after `/v1`**; **resource actions use nested paths** such as `/v1/updates/:updateId/transcribe` and `/v1/tasks/:taskId/review/submit`; **one-shot AI commands** live under **`/v1/ai/<job-name>`**.

## Global implementation rules

- Public JSON under **`/v1`**; static demo media via **`GET /uploads/*`** (unversioned) — [`routes/root.md`](routes/root.md). Multipart create-update and attachment routes — [`routes/projects.md`](routes/projects.md#legacy-note-on-uploads) (canonical paths under `/v1/updates` and `/v1/attachments`).
- Use **`@v2e/database`** in routes (no ad hoc SQLite); validate with **Zod** / **`@v2e/contracts`**.
- **AI calls** go through **`@v2e/ai`** and **`ai-gateway`**, not provider SDKs in route handlers — [`ai-runtime.md`](ai-runtime.md).
- **Mutations:** `apps/api/src/middleware/auth.ts` (`requireAuth`); web client: `apps/field-app/src/lib/api.ts` + `VITE_API_TOKEN` (e.g. `dev-token`).
- Enforce **project scoping** so `updateId` / tasks belong to the claimed `projectId`.

## Related

| Topic | Doc |
| ----- | --- |
| Route index | [`routes/AGENTS.md`](routes/AGENTS.md) |
| Generated route inventory | [`../../ROUTE-INVENTORY.md`](../../ROUTE-INVENTORY.md) |
| Org/location JSON names, integrity | [`../data-model/canonical-org-location-and-integrity.md`](../data-model/canonical-org-location-and-integrity.md) |
| Updates ↔ tasks edges | [`../data-model/update.md`](../data-model/update.md) |
| Web dev proxy `/v1`, `/uploads` | [`../field-app/web-ui-enact-ui.md`](../field-app/web-ui-enact-ui.md) |
| Env and run locally | `apps/api/README.md` |
