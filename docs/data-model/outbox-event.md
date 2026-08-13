# Entity: Outbox event

**Table:** `outbox_events`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts)

## Purpose

**Transactional outbox** for domain events emitted after **`audit_events`** writes. Decouples HTTP handlers from notification delivery: **`enqueueOutboxEvent`** runs immediately after **`insertAuditEvent`**; a background **`processOutboxBatch`** (optional) consumes **`pending`** rows and may create **`notifications`** + **`delivery_attempts`** without blocking the request.

There is **no** dedicated Zod contract file; payloads are JSON objects mirrored from audit payloads plus `projectId`, `entityType`, `entityId`, `actor`.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `tenantId` | text | notNull | Pilot uses `"demo"` |
| `eventType` | text | notNull | Same string family as `audit_events.eventType` |
| `payload` | text | notNull | JSON string: merged audit context + payload |
| `status` | text | notNull, default `pending` | `pending` → `delivered` or `failed` |
| `attempts` | integer | notNull, default 0 | Incremented on delivery failure |
| `nextAttemptAt` | text | optional | ISO time for retry backoff |
| `processedAt` | text | optional | When row reached terminal success |
| `lastError` | text | optional | Last error message |
| `createdAt` | text | notNull | ISO timestamp |

## Enums / status

- **`status`:** `pending` (work queue), `delivered` (success), `failed` (max attempts).

## Delivery rules (worker)

- If **`payload.notifyUserId`** is a **`users.id`**, the worker may insert an in-app **`notifications`** row and a **`delivery_attempts`** row with channel `in_app`.
- Rows are still marked **`delivered`** if there is no recipient (pipeline bookkeeping).

## API

- **No** HTTP CRUD for `outbox_events` in the pilot API.
- **Producer:** `apps/api/src/lib/audit.ts` → `enqueueOutboxEvent` in `apps/api/src/lib/outbox.ts`.
- **Consumer:** `processOutboxBatch` in `outbox.ts`; optional timer when **`OUTBOX_WORKER_ENABLED=1`** (`apps/api/src/index.ts`).

## See also

- [audit.md](./audit.md)
- [notification.md](./notification.md)
- [`NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md`](./plans/NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md) §17

Parent: [index.md](./index.md).
