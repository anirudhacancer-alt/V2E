# AI runtime and gateway

**Scope:** How **`packages/ai`** orchestrates transcription and extraction, how **`ai-gateway`** is the provider boundary, and how **`apps/api`** persists lifecycle state. HTTP routes that call AI live under [`routes/updates.md`](routes/updates.md) (`apps/api/src/routes/update-actions.ts` and `apps/api/src/routes/ai-jobs.ts`).

## Decision summary

- Runtime AI stays in this monorepo as **`packages/ai`** (TypeScript).
- Reuse **[ai-gateway](../../../ai-gateway/README.md)** instead of embedding provider routing in V2E.
- **Azure-first** for production; OpenRouter and others are fallback / eval.
- **Python** (`uv`, polars, duckdb) is for **offline analytics**, not the MVP synchronous path.

## Architecture

```text
apps/field-app
   │
   ▼
apps/api (Hono)
   │
   ▼
packages/ai (orchestration, prompts, retries)
   │
   ▼
ai-gateway
   │
   ├── Azure AI Foundry
   ├── Azure Speech
   └── OpenRouter (fallback / test)

packages/database ◄── apps/api persists transcripts, AI outputs, review state
```

## Role boundaries

| Layer | Owns |
| ----- | ---- |
| **`apps/api`** | HTTP, auth, project scoping, workflow orchestration, persistence. Must not call Azure/OpenRouter directly once wired through `packages/ai`. |
| **`packages/ai`** | Prompts, gateway client, validation against contracts, retries/fallback, normalizing provider output to DTOs. |
| **`ai-gateway`** | Provider URLs, credentials, governance, cost, telemetry. |
| **Python tooling** | Datasets, offline eval, notebooks — not the default request path. |

## Config

- **Catalog:** [`providers.yaml`](../../providers.yaml) — canonical provider/model IDs.
- **Gateway runtime:** [`ai-gateway/config/config.yml`](../../../ai-gateway/config/config.yml) — keep aligned with `providers.yaml` (refresh procedure is open work).
- **Env:** `AI_GATEWAY_URL` (V2E → gateway); see also `apps/api/README.md` and gateway docs.

## Azure-first strategy (summary)

| Capability | Primary | Notes |
| ---------- | ------- | ----- |
| STT | Azure Speech conversation | Whisper as fallback/eval |
| Structured extraction | `gpt-4.1-mini` class models | Via gateway |
| Escalation / harder review | Stronger chat models | When low-confidence path |

## Transcription: retries and idempotency

- Gateway/client retries follow `packages/ai` policy.
- **`POST /v1/updates/:updateId/transcribe`** accepts **`Idempotency-Key`**; if transcription already completed, returns stored result without re-running STT.
- Persistence on `updates` and related rows in `packages/database`.

## Hybrid auto-task after extraction

`applyPostExtractionAutoTask` (`apps/api/src/lib/extraction-auto-task.ts`) may create tasks from extraction output using confidence bands. Env: `V2E_LOW_CONFIDENCE_THRESHOLD`, `V2E_HIGH_CONFIDENCE_THRESHOLD` in `apps/api/src/env.ts`. Formal rules: [ADR 0006 — AI extraction and review workflow](../architecture/adr/0006-ai-extraction-and-review-workflow.md).

## Open work (hardening)

- Align **`ai-gateway/config/config.yml`** with **`providers.yaml`**.
- Gateway auth (optional vs required for V2E → gateway).
- Observability: health from V2E to gateway; smoke tests for chosen models.
- Production: object storage for uploads instead of local `GET /uploads/*` (see [`overview.md`](overview.md), [`routes/projects.md`](routes/projects.md#create-updates-and-attachments-uploads-router)).

## Related

- [`overview.md`](overview.md) — API stack and global rules
- [`routes/updates.md`](routes/updates.md) — transcribe, confirm, escalate; extraction trigger — `POST /v1/ai/voice-note-extraction` (`ai-jobs.ts`)
- [ADR 0005 — Bearer token authentication](../architecture/adr/0005-bearer-token-authentication-pattern.md)
- [Updates and tasks workflow invariants](../data-model/invariants/updates-tasks-workflow-invariants.md)
