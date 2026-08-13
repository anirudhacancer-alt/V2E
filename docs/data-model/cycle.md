# Entity: Work cycle

**Table:** `work_cycles`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`workCycles`)

## Purpose

Planning horizons (weekly/bi-weekly, etc.). Commitments may be grouped under a work cycle.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID |
| `tenantId` | text | notNull | Tenant scope |
| `projectId` | text | notNull, FK → `projects.id` | |
| `name` | text | notNull | |
| `startDate` | text | notNull | |
| `endDate` | text | notNull | |
| `status` | text | notNull, default `planned` | `planned` \| `active` \| `closed` |
| `goal` | text | optional | |
| `createdAt` | text | notNull | |
| `updatedAt` | text | notNull | |

## Contracts

- [`packages/contracts/src/cycle.ts`](../../packages/contracts/src/cycle.ts)

## API

- [cycles.md](../api/routes/cycles.md)

## See also

- [index.md](./index.md)
