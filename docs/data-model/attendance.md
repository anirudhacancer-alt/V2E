# Entity: Attendance (session + row)

**Tables:** `attendance_sessions`, `attendances`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts)

## Purpose

**Roll-call**: an **attendance session** is a point in time (`sessionDate`, `siteId`, `projectId`, `conductedBy`). **Attendance** rows record each **team member**'s status (and optional notes) for that session.

## `attendance_sessions` Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the session |
| `siteId` | text | notNull | FK to `sites.id` |
| `projectId` | text | notNull | FK to `projects.id` |
| `sessionDate` | text | notNull | UTC calendar day `YYYY-MM-DD` |
| `conductedBy` | text | notNull | User ID who conducted the roll call |
| `createdAt` | text | notNull | Timestamp |
| `updatedAt` | text | notNull | Timestamp |

## `attendances` Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the attendance record |
| `sessionId` | text | notNull | FK to `attendance_sessions.id` |
| `teamMemberId` | text | notNull | FK to `team_members.id` |
| `status` | text | notNull | Roll-call status (see **Enums**; wire uses `AttendanceStatusEnum`) |
| `notes` | text | optional | Optional attendance notes |
| `recordedAt` | text | notNull | When attendance was recorded |

## Relationships

- `attendances.sessionId` → `attendance_sessions.id`
- `attendances.teamMemberId` → `team_members.id`

Standup **prep lists** (planned/blocked items) are **not** stored here — they are derived from `tasks`. See [`../field-app/standup-prep-from-tasks.md`](../field-app/standup-prep-from-tasks.md).

## Contracts

- [`packages/contracts/src/attendance.ts`](../../packages/contracts/src/attendance.ts)

## Enums

**`AttendanceStatusEnum`** (`packages/contracts/src/enums.ts`): `Present` | `Absent`. Used on `AttendanceSchema` / `AttendanceRecordSchema.status`.

## See also

- [index.md](./index.md)
- [member.md](./member.md)
