# Entity: User

**Table:** `users`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`users`)

## Purpose

Authenticated **people** in the system (execution leads, technical reviewers, crew, managers, etc.). Links to `role_types` via `orgRoleCode` and optionally to `departments` via `departmentCode`.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the user |
| `email` | text | notNull | Email address (login) |
| `name` | text | notNull | Full name |
| `orgRoleCode` | text | notNull | FK to `role_types.code` (canonical org role) |
| `departmentCode` | text | optional | FK to `departments.code` when tied to a discipline |
| `specialty` | text | notNull, default: "" | Specialty/trade |
| `phone` | text | notNull | Phone number |
| `employeeId` | text | notNull | Employee ID |
| `avatarUrl` | text | optional | URL to avatar image |
| `preferences_pushNotificationsEnabled` | text | notNull | Push notifications preference (text boolean) |
| `preferences_darkModeEnabled` | text | notNull | Dark mode preference (text boolean) |
| `createdAt` | text | notNull | Timestamp |
| `updatedAt` | text | notNull | Timestamp |

## Key fields (conceptual)

- **orgRoleCode** — FK to `role_types.code`.
- **departmentCode** — optional FK to `departments.code`.
- **Preferences** — stored as flattened columns in SQLite (`preferences_*`); API/contracts use nested objects.

## Contracts

- [`packages/contracts/src/user.ts`](../../packages/contracts/src/user.ts) — `UserSchema`, CRUD variants.

## Enums

- **`orgRoleCode`** — `RoleTypeCodeSchema` (FK to `role_types.code`). See [role.md](./role.md).
- **`departmentCode`** (optional) — `DepartmentEnum`; see [department.md](./department.md).
- **`SpecialtyEnum`** exists in [`enums.ts`](../../packages/contracts/src/enums.ts) for catalog-style specialty labels; `UserSchema.specialty` is a bounded **string** in wire shapes—align demo seed strings with product expectations.

## See also

- [index.md](./index.md)
