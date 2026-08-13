# Data integrity and validation invariants

This document captures the **runtime integrity rules** for master data references and the **validation boundary** between persisted data errors (500) and extraction mapping errors (422).

For canonical org/location JSON field names and FK columns, see [../canonical-org-location-and-integrity.md](../canonical-org-location-and-integrity.md). This invariant doc focuses on **error semantics** and **enforcement behavior**.

---

## Two validation layers

| Layer | When it fires | HTTP status | Error code | Purpose |
|-------|---------------|-------------|------------|---------|
| **AI extraction validation** | Before persisting AI output; mapping extraction to master rows fails | 422 | `EXTRACTION_DEPARTMENT_UNRESOLVED`, `EXTRACTION_DEPARTMENT_UNKNOWN`, `EXTRACTION_OWNER_ROLE_UNRESOLVED` | Tell the client the extraction could not be mapped to canonical codes |
| **Runtime data integrity** | After read; persisted FK references broken or master data expectations violated | 500 | `DATA_INTEGRITY` | Alert operators that the database has corrupt/orphan FKs |

---

## Runtime integrity (`DATA_INTEGRITY`)

When persisted data violates master-data expectations, route handlers throw **`DataIntegrityError`** and return **HTTP 500**:

```json
{
  "error": {
    "code": "DATA_INTEGRITY",
    "message": "…",
    "details": {}
  }
}
```

### What triggers DATA_INTEGRITY (non-exhaustive)

| Violation | Example |
|-----------|---------|
| Orphan FK | `tasks.assigneeRoleCode` references a `role_types.code` that no longer exists |
| Missing master row | `users.orgRoleCode` points to deleted `role_types` row |
| Empty required label | `locations.listLabel` is empty/null when list endpoint resolves `locationList` |
| Mismatched roster | `tasks.ownerId` + `assigneeRoleCode` do not match `team_members.orgRoleCode` for that owner |

### Design principle: no silent fallbacks

- No `?? orgRoleCode` coalescing
- No empty `locationList` strings
- No `"Unknown"` placeholder names

If the data is broken, the API fails loudly so operators can fix the root cause.

### Implementation locations

| Module | File | Responsibility |
|--------|------|----------------|
| Error class | `apps/api/src/lib/data-integrity.ts` | `DataIntegrityError` definition |
| Person resolution | `apps/api/src/lib/resolve-person.ts` | Strict joins; throws on missing `role_types`/`team_members` rows |
| Route enforcement | `apps/api/src/routes/*.ts` | Validate location/role resolution before assembling responses |

---

## AI extraction validation (422)

Before persisting extraction output, the API validates mapping to master rows. Failures return **422** with explicit codes so the client can show mapping UI or retry.

| Error code | Meaning |
|------------|---------|
| `EXTRACTION_DEPARTMENT_UNRESOLVED` | Extraction provided a department label that could not be mapped to `departments.code` |
| `EXTRACTION_DEPARTMENT_UNKNOWN` | Mapped code does not exist in `departments` |
| `EXTRACTION_OWNER_ROLE_UNRESOLVED` | Extraction provided an owner/role label that could not be mapped to `role_types.code` |

### Implementation

`apps/api/src/routes/ai-jobs.ts` and `apps/api/src/routes/update-actions.ts` perform master-row lookups and return 422 on mismatch.

---

## Seed and CSV implications

- **Seed materialization** reads legacy string columns (`role`, `ownerRole`, `department` labels) from CSV.
- **Persisted** SQLite rows must use **canonical codes**; mapping is deterministic in `packages/database/src/demo-seed/persist.ts` and `packages/database/src/org-canonical.ts`.
- Seed validation rules: [../../demo/demo-seed-script-validations.md](../../demo/demo-seed-script-validations.md).

If seed data produces a FK reference that violates integrity, the API will return 500 at runtime—seed validation must catch these before they reach the database.

---

## Related documents

| Document | Topic |
|----------|-------|
| [../canonical-org-location-and-integrity.md](../canonical-org-location-and-integrity.md) | Master tables, FK columns, public JSON field names |
| [data-normalization-invariants.md](./data-normalization-invariants.md) | PM-style → app data transformation rules |
| [updates-tasks-workflow-invariants.md](./updates-tasks-workflow-invariants.md) | Review queue vs task lifecycle semantics |
| [../../demo/demo-seed-script-validations.md](../../demo/demo-seed-script-validations.md) | Seed-time validation rules |
