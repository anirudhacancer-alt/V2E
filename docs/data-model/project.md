# Entity: Project

**Table:** `projects`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`projects`)

## Purpose

**Contract or delivery unit** under a site. Owns **locations**, **updates**, **tasks**, **attendance sessions**, and the optional **standup AI summary** row (`project_standup_ai_summaries`).

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the project |
| `siteId` | text | notNull | FK to `sites.id` |
| `code` | text | notNull | Project code/identifier |
| `name` | text | notNull | Project name |
| `description` | text | optional | Optional project description |
| `type` | text | notNull | Vertical / execution type (`construction`, `factory`, `retail`, `warehouse`, `venue`, `ngo`, `other`; default `other`) |
| `status` | text | notNull | Lifecycle status (`planning`, `active`, `on_hold`, `completed`, `cancelled`; default `active`) |
| `isActive` | text | notNull | Active status (text boolean) |
| `metadata` | text | notNull | JSON metadata blob |
| `createdAt` | text | notNull | Timestamp |
| `updatedAt` | text | notNull | Timestamp |

## Contracts

- [`packages/contracts/src/project.ts`](../../packages/contracts/src/project.ts).

## Enums

- `ProjectTypeSchema`, `ProjectLifecycleStatusSchema` in [`packages/contracts/src/project.ts`](../../packages/contracts/src/project.ts) (optional on the contract shape for demo CSV rows that omit columns).

## See also

- [index.md](./index.md)
- [location.md](./location.md)
- [standup-ai-summary.md](./standup-ai-summary.md)
