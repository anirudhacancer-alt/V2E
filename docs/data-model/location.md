# Entity: Location

**Table:** `locations`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`locations`)

## Purpose

Hierarchical **place** within a project (tower, level, zone, …). Demo seed supplies `displayLabel` and `listLabel`. Referenced by **updates**, **tasks**, and **update_ai_outputs** via `locationId`.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the location |
| `projectId` | text | notNull | FK to `projects.id` |
| `siteType` | text | notNull | Type of site/location |
| `level1` | text | notNull | Top hierarchy level (e.g., tower name) |
| `level2` | text | optional | Second level (e.g., floor/level) |
| `level3` | text | optional | Third level (e.g., zone) |
| `level4` | text | optional | Fourth level (e.g., area) |
| `displayLabel` | text | notNull | Full display label for UI |
| `listLabel` | text | notNull | Compact label for list cards (e.g., "Twr · L02") |
| `isActive` | integer | notNull, default: 1 | Boolean: is location active |
| `sortOrder` | integer | notNull | Display sort order |

## Contracts

- [`packages/contracts/src/location.ts`](../../packages/contracts/src/location.ts).

## Enums

**`siteType`** (`LocationSchema`): `Residential` | `Commercial` | `Factory`.

## See also

- [index.md](./index.md)
- [`./canonical-org-location-and-integrity.md`](./canonical-org-location-and-integrity.md)
