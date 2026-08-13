# Entity: Department

**Table:** `departments`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`departments`)

## Purpose

Master list of **work packages / disciplines** (civil, MEP, quality, etc.). Referenced by `users.departmentCode`, `team_members.departmentCode`, `tasks.departmentCode`, and `update_ai_outputs.departmentCode` where applicable.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the department |
| `code` | text | notNull, unique | Canonical code (e.g., "CIVIL", "MEP") |
| `name` | text | notNull | Display name |
| `category` | text | notNull | Category (e.g., "execution", "support") |
| `isSiteFunction` | integer | notNull, default: 0 | Boolean: is this a site function |
| `isExecutionDiscipline` | integer | notNull, default: 0 | Boolean: is this an execution discipline |
| `isActive` | integer | notNull, default: 1 | Boolean: is department active |
| `sortOrder` | integer | notNull | Display sort order |

## Contracts

- `DepartmentEnum` and related helpers in [`packages/contracts/src/enums.ts`](../../packages/contracts/src/enums.ts).

## Enums

**`DepartmentEnum`** (`packages/contracts/src/enums.ts`) — work package / discipline labels used in API payloads and (when applicable) FK `departments.code` mapping:

`Civil`, `Structure`, `MEP`, `Electrical`, `Plumbing`, `Finishing`, `Masonry`, `Carpentry`, `Steel`, `Painting`, `Facade`, `Production`, `Packaging`, `Maintenance`, `Utilities`, `Quality`, `Warehouse`, `Procurement`, `Planning`, `QAQC`, `Safety`.

## See also

- [index.md](./index.md)
- [`./canonical-org-location-and-integrity.md`](./canonical-org-location-and-integrity.md)
