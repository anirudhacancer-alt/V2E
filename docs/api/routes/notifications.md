# `/v1/notifications`

**Source:** `apps/api/src/routes/notifications.ts`.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/notifications` | Bearer | List notifications for the authenticated user with optional `status`, `type`, `limit`, and `offset` filters. |
| `GET` | `/v1/notifications/:notificationId` | Bearer | Get a notification owned by the authenticated user. |
| `PATCH` | `/v1/notifications/:notificationId` | Bearer | Update status (e.g. read/archived) for a notification owned by the authenticated user. |

Notification delivery is fanned out from `outbox_events` into:
- in-app `notifications` rows plus `delivery_attempts`
- staged `email_queue` rows when email preferences and destination email are present
- staged `push_queue` rows when push preferences and active device tokens are present

External provider delivery is still out of scope for this route surface.

**Data model:** [notification.md](../../data-model/notification.md). Preferences: [notification-preferences.md](../../data-model/notification-preferences.md).

Parent: [AGENTS.md](AGENTS.md).
