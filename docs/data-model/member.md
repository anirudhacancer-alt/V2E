# Entity: Team member

**Table:** `team_members`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`team_members`)

## Purpose

**Roster** row for a person at a site (may differ from `users` login rows in demos). Used for **attendance** rows. References `role_types` and optionally `departments`.

`userId` is optional because some roster rows still represent field personnel without a deterministic login-row match. When present, it is the canonical bridge from task/commitment ownership to user-scoped notification delivery.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of team member |
| `siteId` | text | notNull | FK to `sites.id` |
| `userId` | text | optional | FK to `users.id` when the roster row is linked to a login identity |
| `name` | text | notNull | Person's name |
| `orgRoleCode` | text | notNull | FK to `role_types.code` |
| `departmentCode` | text | optional | FK to `departments.code` |
| `specialty` | text | notNull, default: "" | Specialty/trade |
| `reportsToUserId` | text | optional | User ID of manager |
| `email` | text | optional | Email address |
| `phone` | text | optional | Phone number |
| `isActive` | text | notNull | Active status (text boolean) |
| `joinedAt` | text | notNull | When member joined |
| `createdAt` | text | notNull | Timestamp |
| `updatedAt` | text | notNull | Timestamp |

## Contracts

- [`packages/contracts/src/member.ts`](../../packages/contracts/src/member.ts).

## Enums

Same as [user.md](./user.md): **`orgRoleCode`** → `RoleTypeCodeSchema`; optional **`departmentCode`** → `DepartmentEnum`. See [role.md](./role.md) and [department.md](./department.md).

## See also

- [index.md](./index.md)
- [attendance.md](./attendance.md)
