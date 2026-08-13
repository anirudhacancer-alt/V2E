# Entity: Standup session

**Table:** `standup_sessions`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts)

## Purpose

Persisted **standup meeting instance** (calendar session) scoped to a **project**, with optional org scope level. Distinct from **standup prep** read models derived from `tasks` (see [`../field-app/standup-prep-from-tasks.md`](../field-app/standup-prep-from-tasks.md)).

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `tenantId` | text | notNull | Tenant scope |
| `projectId` | text | notNull, FK → `projects.id` | Project |
| `scopeLevel` | text | notNull | `team`, `department`, `site`, `plant`, `region` |
| `scopeRef` | text | optional | Scoped entity ref (e.g. department code) |
| `sessionDate` | text | notNull | `YYYY-MM-DD` |
| `ownerId` | text | notNull, FK → `team_members.id` | Conductor |
| `status` | text | notNull, default `draft` | `draft`, `active`, `closed` |
| `summaryText` | text | optional | AI or manual summary |
| `createdAt` | text | notNull | ISO timestamp |
| `updatedAt` | text | notNull | ISO timestamp |

## Contracts

- [`packages/contracts/src/standup-session.ts`](../../packages/contracts/src/standup-session.ts) (where used for API shapes).

## API

- See [standups.md](../api/routes/standups.md) for `/v1/standups` and nested attendance/open/close actions.
- See [ai.md](../api/routes/ai.md) for `POST /v1/ai/standup-summary` (generated on demand, not persisted here).

## See also

- [standup-ai-summary.md](./standup-ai-summary.md) — legacy/demo snapshot table; not part of the current public HTTP surface
- [Phase D plan](./plans/phase-D-standup-session-persistence-and-notifications.md)

Parent: [index.md](./index.md).
