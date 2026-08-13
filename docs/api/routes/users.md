# `/v1/users`

**Source:** `apps/api/src/routes/users.ts` — `v1.route("/users", usersRouter)`.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/users` | No | List users (filters as implemented). |
| `GET` | `/v1/users/:userId` | No | Get user by ID. |
| `POST` | `/v1/users` | Bearer | Create user. |
| `PATCH` | `/v1/users/:userId` | Bearer | Update user. |

**Data model:** [user.md](../../data-model/user.md).

Parent: [AGENTS.md](AGENTS.md).
