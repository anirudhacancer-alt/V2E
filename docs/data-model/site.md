# Entity: Site

**Table:** `sites`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`sites`)

## Purpose

Physical or logical **site / plant** where work happens. Parents **projects** and **team_members** scoped to the site.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the site |
| `name` | text | notNull | Site name |
| `code` | text | notNull | Site code/identifier |
| `address` | text | notNull | Physical address |
| `locationLatitude` | text | optional | GPS latitude |
| `locationLongitude` | text | optional | GPS longitude |
| `projectManagerId` | text | notNull | User ID of project manager |
| `isActive` | text | notNull | Active status (text boolean) |
| `metadata` | text | notNull | JSON metadata blob |
| `createdAt` | text | notNull | Timestamp |
| `updatedAt` | text | notNull | Timestamp |

## Contracts

- [`packages/contracts/src/site.ts`](../../packages/contracts/src/site.ts).

## Enums

No dedicated Zod enums in `site.ts` (primitives + `metadata` record).

## See also

- [index.md](./index.md)
