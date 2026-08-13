# `/v1/locations`

**Source:** `apps/api/src/routes/locations.ts`.

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/v1/locations` | No | List locations (filters as implemented). |
| `GET` | `/v1/locations/:locationId` | No | Get location. |
| `POST` | `/v1/locations` | Bearer | Create location. |
| `PATCH` | `/v1/locations/:locationId` | Bearer | Update location. |

**Data model:** [location.md](../../data-model/location.md).

Parent: [AGENTS.md](AGENTS.md).
