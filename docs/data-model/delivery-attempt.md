# Entity: Delivery attempt

**Table:** `delivery_attempts`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts)

## Purpose

**Audit trail** for a single delivery try for a [**notification**](./notification.md) on a channel (`in_app`, `email`, `push`). The outbox worker records **`success`** attempts for in-app delivery when it creates a notification from an [`outbox_events`](./outbox-event.md) row.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `notificationId` | text | notNull, FK → `notifications.id` | Parent notification |
| `channel` | text | notNull | `in_app`, `email`, `push` |
| `status` | text | notNull | `pending`, `success`, `failed` |
| `attemptedAt` | text | notNull | ISO timestamp |
| `providerResponse` | text | optional | Opaque provider/debug JSON or text |

## API

No direct REST CRUD in the pilot; rows are written by server logic (`phase-d` / outbox worker).

## See also

- [notification.md](./notification.md)

Parent: [index.md](./index.md).
