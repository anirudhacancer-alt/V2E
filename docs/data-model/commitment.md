# Entity: Commitment

**Table:** `commitments`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`commitments`)

## Purpose

What teams commit to deliver in planning/standup cycles; tracks reliability and carry-over.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `tenantId` | text | notNull | |
| `projectId` | text | notNull, FK → `projects.id` | |
| `siteId` | text | notNull, FK → `sites.id` | |
| `workCycleId` | text | optional, FK → `work_cycles.id` | |
| `standupSessionId` | text | optional | FK when linked to standup |
| `sourceTaskId` | text | optional, FK → `tasks.id` | |
| `title` | text | notNull | |
| `description` | text | optional | |
| `ownerId` | text | notNull, FK → `team_members.id` | |
| `assigneeRoleCode` | text | notNull, FK → `role_types.code` | |
| `status` | text | notNull, default `planned` | `planned` \| `in_progress` \| `completed` \| `at_risk` \| `missed` \| `carried_over` |
| `commitDate` | text | notNull | YYYY-MM-DD |
| `targetDate` | text | notNull | YYYY-MM-DD |
| `completedAt` | text | optional | ISO timestamp |
| `carriedOverFromCommitmentId` | text | optional | FK → `commitments.id` |
| `riskReason` | text | optional | |
| `createdAt` | text | notNull | |
| `updatedAt` | text | notNull | |

## Contracts

- [`packages/contracts/src/commitment.ts`](../../packages/contracts/src/commitment.ts)

## API

- [commitments.md](../api/routes/commitments.md) — includes **`GET /v1/commitments/horizon?projectId=...`** (task-derived cards by horizon)
- [projects.md](../api/routes/projects.md) — project CRUD only; commitment horizon read model is not nested under `/v1/projects`

## See also

- [index.md](./index.md)
