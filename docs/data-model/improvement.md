# Entity: Improvement action

**Table:** `improvement_actions`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`improvementActions`)

## Purpose

Structured countermeasures for repeated issues (DMAIC-style improvement loop).

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `tenantId` | text | notNull | |
| `projectId` | text | notNull, FK → `projects.id` | |
| `siteId` | text | notNull, FK → `sites.id` | |
| `title` | text | notNull | |
| `problemStatement` | text | notNull | |
| `category` | text | notNull, default `other` | `quality` \| `schedule` \| `safety` \| `maintenance` \| `retail_execution` \| `other` |
| `rootCause` | text | optional | |
| `ownerId` | text | notNull, FK → `team_members.id` | |
| `status` | text | notNull, default `open` | `open` \| `in_progress` \| `validated` \| `closed` |
| `targetDate` | text | optional | |
| `linkedTaskIdsJson` | text | notNull, default `[]` | JSON array |
| `linkedBlockerIdsJson` | text | notNull, default `[]` | JSON array |
| `linkedCommitmentIdsJson` | text | notNull, default `[]` | JSON array |
| `effectivenessNote` | text | optional | |
| `createdAt` | text | notNull | |
| `updatedAt` | text | notNull | |

## Contracts

- [`packages/contracts/src/improvement.ts`](../../packages/contracts/src/improvement.ts)

## API

- [improvements.md](../api/routes/improvements.md)

## See also

- [index.md](./index.md)
