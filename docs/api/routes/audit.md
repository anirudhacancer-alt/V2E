# `/v1/audit`

**Source:** `apps/api/src/routes/audit.ts`  
**Mount:** `v1.route("/audit", auditRouter)` → paths under **`/v1/audit`**.

These routes provide read-only access to the audit trail. Audit events are system-generated (no public write endpoint) and record all meaningful mutations and workflow actions.

Aligns with `NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md` §12.23.

## Endpoints

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/audit` | No | List audit events with optional filters and pagination. |
| `GET` | `/v1/audit/:auditEventId` | No | Get a single audit event by ID. |

## Query Parameters (List)

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityType` | string | Filter by entity type (e.g., `task`, `update`, `commitment`). |
| `entityId` | string | Filter by specific entity ID. |
| `projectId` | string | Filter by project ID. |
| `siteId` | string | Filter by first-class `audit_events.siteId`. |
| `actor` | string | Filter by actor user ID. |
| `eventType` | string | Filter by event type (e.g., `task.created`, `update.transcribed`). |
| `from` | ISO8601 | Filter events occurred at or after this time. |
| `to` | ISO8601 | Filter events occurred at or before this time. |
| `page` | integer | Page number (default: 1). |
| `pageSize` | integer | Items per page (default: 20, max: 100). |

## Response Schema

### List Response

```json
{
  "data": [
    {
      "id": "uuid",
      "occurredAt": "2026-03-27T10:00:00Z",
      "eventType": "task.created",
      "projectId": "project-uuid",
      "siteId": "site-uuid",
      "entityType": "task",
      "entityId": "task-uuid",
      "actor": "user-uuid",
      "payload": { ... }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Detail Response

```json
{
  "id": "uuid",
  "occurredAt": "2026-03-27T10:00:00Z",
  "eventType": "task.created",
  "projectId": "project-uuid",
  "siteId": "site-uuid",
  "entityType": "task",
  "entityId": "task-uuid",
  "actor": "user-uuid",
  "payload": { ... }
}
```

## Event Types

Common event types include:

- `update.created`, `update.transcribed`, `update.extracted`
- `task.created`, `task.assigned`, `task.status_changed`, `task.overdue`, `task.approved`, `task.rework_requested`
- `commitment.created`, `commitment.status_changed`, `commitment.missed`
- `dependency.created`, `dependency.deleted`, `dependency.override`
- `improvement_action.created`, `improvement_action.status_changed`
- `standup_session.created`, `standup_session.status_changed`

See `apps/api/src/lib/audit.ts` for the full `AuditEventType` union.

## Database Schema

Audit events are stored in the `audit_events` table:

```sql
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  occurredAt TEXT NOT NULL,
  eventType TEXT NOT NULL,
  projectId TEXT,
  siteId TEXT,
  entityType TEXT NOT NULL,
  entityId TEXT NOT NULL,
  actor TEXT,
  payload TEXT NOT NULL -- JSON
);
```

## Related

- [`../../data-model/audit.md`](../../data-model/audit.md) — Entity documentation
- [`../../data-model/plans/phase-H-audit-read-and-route-integrity.md`](../../data-model/plans/phase-H-audit-read-and-route-integrity.md) — Phase H plan
- [`../../data-model/plans/NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md`](../../data-model/plans/NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md) §12.23 — Canonical spec

Parent: [AGENTS.md](AGENTS.md).
