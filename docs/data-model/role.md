# Entity: Role type

**Table:** `role_types`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`roleTypes`)

## Purpose

Canonical **org role taxonomy** across construction, factory, and field-rep pillars.
Foreign key target for `users.orgRoleCode`, `team_members.orgRoleCode`, `update_ai_outputs.ownerRoleCode`, and `tasks.assigneeRoleCode`.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the role type |
| `code` | text | notNull, unique | Canonical `SCREAMING_SNAKE` code (e.g., `SITE_SUPERVISOR`, `ENGINEER`; table-driven) |
| `name` | text | notNull | Display name |
| `level` | text | notNull | Canonical role level (`manager` \| `execution_lead` \| `crew`) |
| `isManagerial` | integer | notNull, default: 0 | Boolean: is this a managerial role |
| `isFieldBased` | integer | notNull, default: 0 | Boolean: is this field-based |
| `isCrewRole` | integer | notNull, default: 0 | Boolean: is this a crew role |
| `isActive` | integer | notNull, default: 1 | Boolean: is role active |
| `sortOrder` | integer | notNull | Display sort order |

## Contracts

- `RoleTypeCodeSchema` and related enums in [`packages/contracts/src/enums.ts`](../../packages/contracts/src/enums.ts).

## Enums

- **`RoleTypeCodeSchema`** — not a fixed string union: canonical **`role_types.code`** values are `SCREAMING_SNAKE` (`^[A-Z][A-Z0-9_]*$`, 1–64 chars). Actual codes are **table-driven** in SQLite (`role_types`); see [`./canonical-org-location-and-integrity.md`](./canonical-org-location-and-integrity.md).
- **`OrgRoleEnum`** (`enums.ts`) — legacy free-form role label used only for adapter compatibility; wire DTOs use **`RoleTypeCodeSchema`** + FK to `role_types`.

## Level invariant (cross-vertical)

- Every role code must map to one of exactly three levels: `manager`, `execution_lead`, `crew`.
- Vertical terminology is a label layer only:
  - construction (`Site Supervisor`, `Foreman`)
  - factory (`Shift Supervisor`, `Line Supervisor`)
  - field reps (`Area Manager`, `Sales Rep`)
  - logistics execution (`Head of Logistics`, `Logistics Lead`, `Operator`)

## See also

- [index.md](./index.md)
- [`./canonical-org-location-and-integrity.md`](./canonical-org-location-and-integrity.md)
