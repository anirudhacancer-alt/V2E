# Entity: Notification preferences

**Table:** `notification_preferences`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts)

## Purpose

Per-**user** toggles for **`eventType`** × **`channel`** (`in_app`, `email`, `push`). Used when product logic respects preferences before enqueueing or sending (pilot may not enforce on every path).

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `userId` | text | notNull, FK → `users.id` | Owner |
| `channel` | text | notNull | `in_app`, `email`, `push` |
| `eventType` | text | notNull | Event key (aligned with audit/outbox naming where applicable) |
| `isEnabled` | integer | notNull, default 1 | `1` = enabled, `0` = disabled |

## API

Exposed only if routes exist in `phase-d.ts` for CRUD; verify handler list in source before relying on writes.

## See also

- [notification.md](./notification.md)

Parent: [index.md](./index.md).
