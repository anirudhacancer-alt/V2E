# `/v1/roles`

**Source:** `apps/api/src/routes/roles.ts`.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/roles` | No | List role types. |
| `GET` | `/v1/roles/:roleTypeId` | No | Get role type. |
| `POST` | `/v1/roles` | Bearer | Create role type. |
| `PATCH` | `/v1/roles/:roleTypeId` | Bearer | Update role type. |

**Data model:** [role.md](../../data-model/role.md).

Parent: [AGENTS.md](AGENTS.md).
