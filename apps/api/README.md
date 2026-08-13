# V2E API (`@v2e/api`)

**Bun** + Hono. The API reads and writes demo data through `@v2e/database` and will route AI-capable flows through `@v2e/ai` plus the external `ai-gateway` service.

**Pilot demo:** `GET` routes are open; **mutations** (`POST`/`PATCH`) require `Authorization: Bearer <token>` (see `V2E_API_TOKEN`, default `dev-token`).

**Schema and JSON field names** (roles, departments, locations, `DATA_INTEGRITY`): see `docs/data-model/canonical-org-location-and-integrity.md`.

## Run

From repo root (after building workspace packages and seeding the demo DB):

```bash
pnpm --filter @v2e/contracts build
pnpm --filter @v2e/database build
pnpm --filter @v2e/database db:seed
pnpm --filter @v2e/api dev
```

Production-style:

```bash
pnpm --filter @v2e/api build
pnpm --filter @v2e/api start
```

## Environment

| Variable | Description |
|----------|-------------|
| `PORT` | Listen port (default `3000`) |
| `SQLITE_PATH` or `DATABASE_PATH` | Path to the demo `.sqlite` file |
| `DATABASE_URL` | Alternative: `file:/absolute/path/to/demo.sqlite` |
| `AI_GATEWAY_URL` | Base URL for the reused `ai-gateway` service (transcription, extraction, standup summary) |
| `V2E_API_TOKEN` | Bearer token expected for mutating routes (default `dev-token`) |
| `V2E_LOW_CONFIDENCE_THRESHOLD` | Extraction confidence below this (0–1) requires explicit review before task creation (default `0.65`) |
| `CORS_ORIGINS` | Comma-separated browser origins allowed for CORS |

Default SQLite path: `packages/database/data/demo.sqlite` relative to the monorepo root.

## Routes (Phase 1)

| Method | Path | Notes |
|--------|------|--------|
| `GET` | `/` | Service info |
| `GET` | `/health` | Liveness |
| `GET` | `/v1` | API v1 ping |
| `GET` | `/v1/ping` | Timestamp ping |
| `GET` | `/v1/debug/db-summary` | Demo-only row counts (requires seeded DB) |
