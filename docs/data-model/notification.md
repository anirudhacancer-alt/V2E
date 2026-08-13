# Entity: Notification

**Table:** `notifications`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts)

## Purpose

User-facing **notification** rows for the authenticated recipient. Rows are created by the **outbox worker** when processing [`outbox_events`](./outbox-event.md); that same worker can also stage email and push deliveries in `email_queue` and `push_queue` when user preferences and delivery targets allow it.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `tenantId` | text | notNull | Tenant scope |
| `userId` | text | notNull, FK → `users.id` | Recipient |
| `type` | text | notNull | Event/type label (e.g. audit `eventType` or product string) |
| `title` | text | notNull | Short title |
| `body` | text | notNull | Body text |
| `entityType` | text | optional | Deep link hint (e.g. `task`) |
| `entityId` | text | optional | Deep link id |
| `status` | text | notNull, default `unread` | `unread`, `read`, `archived` |
| `createdAt` | text | notNull | ISO timestamp |
| `readAt` | text | optional | When marked read |

## Contracts

No standalone **`notification.ts`** in `@v2e/contracts` in the pilot; shapes are implied by API responses in **`apps/api/src/routes/phase-d.ts`**.

## API

- `GET /v1/notifications` returns only rows owned by the authenticated `userId`
- `GET|PATCH /v1/notifications/:notificationId` return `404` for rows not owned by the authenticated `userId`
- See [notifications.md](../api/routes/notifications.md)

## See also

- [delivery-attempt.md](./delivery-attempt.md)
- [outbox-event.md](./outbox-event.md)

Parent: [index.md](./index.md).
