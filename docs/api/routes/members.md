# `/v1/members`

**Source:** `apps/api/src/routes/members.ts`.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/members` | No | List team members with optional filters: `siteId`, `projectId`, `userId`, `departmentCode`, `orgRoleCode`, `isActive`. |
| `GET` | `/v1/members/:teamMemberId` | No | Get team member. |
| `POST` | `/v1/members` | Bearer | Create team member, optionally linking it to `users.id` via `userId`. |
| `PATCH` | `/v1/members/:teamMemberId` | Bearer | Update team member fields, including optional `userId`. |

**Data model:** [member.md](../../data-model/member.md).

Parent: [AGENTS.md](AGENTS.md).
