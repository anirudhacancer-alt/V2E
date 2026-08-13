# Entity: Audit event

**Table:** `audit_events`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`auditEvents`)

## Purpose

**Pilot audit trail** for mutations and workflow events: `eventType`, `entityType`, `entityId`, optional `projectId`, `siteId`, and `actor`, plus JSON **`payload`** for queryable detail.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the audit event |
| `occurredAt` | text | notNull | When the event occurred |
| `eventType` | text | notNull | Type of event (e.g., TASK_CREATED, UPDATE_PROCESSED) |
| `projectId` | text | optional | FK to `projects.id` (context) |
| `siteId` | text | optional | FK to `sites.id` (context) |
| `entityType` | text | notNull | Type of entity affected (task, update, etc.) |
| `entityId` | text | notNull | ID of the entity affected |
| `actor` | text | optional | User ID who triggered the event |
| `payload` | text | notNull | JSON payload with event details |

## Contracts

- Typically **ad hoc** per event type; not always a single Zod entity in `packages/contracts`. Prefer contracts for outward API responses when stabilized.

## Enums

**`eventType`** / **`entityType`** are **not** a single exported Zod enum—values are agreed by convention in `apps/api` and audit helpers. Document new event types when adding them.

## API Endpoints (Phase H)

Implemented in Phase H per `NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md` §12.23:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/audit` | List audit events with filters (entityType, entityId, projectId, siteId, actor, eventType, from, to) and pagination |
| `GET` | `/v1/audit/:auditEventId` | Get a single audit event by ID |

### Filter Parameters (List Endpoint)

- `entityType` — Filter by entity type (e.g., `task`, `update`, `commitment`)
- `entityId` — Filter by specific entity ID
- `projectId` — Filter by project ID
- `siteId` — Filter by first-class `audit_events.siteId`
- `actor` — Filter by actor user ID
- `eventType` — Filter by event type (e.g., `task.created`, `update.transcribed`)
- `from` — ISO8601 timestamp, events at or after this time
- `to` — ISO8601 timestamp, events at or before this time
- `page` — Page number (default: 1)
- `pageSize` — Items per page (default: 20, max: 100)

### Implementation

- **Source:** `apps/api/src/routes/audit.ts`
- **Tests:** `apps/api/src/routes/audit.test.ts`
- **Helper:** `apps/api/src/lib/audit.ts` (insertAuditEvent)

## Common Event Types

| Event Type | Description |
|------------|-------------|
| `task.created` | New task created |
| `task.assigned` | Task created or updated with an owner assignment |
| `task.status_changed` | Task status updated |
| `task.overdue` | Task crossed its due date while still open |
| `task.approved` | Task approved in technical review |
| `task.rework_requested` | Task sent back for rework |
| `update.transcribed` | Voice update transcribed |
| `update.extracted` | AI extraction completed |
| `commitment.created` | New commitment created |
| `commitment.status_changed` | Commitment status changed |
| `commitment.missed` | Commitment transitioned to `missed` |
| `dependency.created` | Task dependency created |
| `dependency.override` | Hard constraint overridden |

See `apps/api/src/lib/audit.ts` for the full `AuditEventType` union.

## See also

- [index.md](./index.md)
- [../api/routes/audit.md](../api/routes/audit.md) — API route documentation
- [./plans/phase-H-audit-read-and-route-integrity.md](./plans/phase-H-audit-read-and-route-integrity.md) — Phase H implementation plan
