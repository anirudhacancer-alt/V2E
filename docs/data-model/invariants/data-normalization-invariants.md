# Data normalization invariants (demo and future import)

This document captures **rules** for transforming raw PM-style or external data into app-native shapes. Today, **demo bundles** implement these rules in the generator pipeline (`docs/demo/tools/generate_demo_datasets.py` and related scripts), not a separate runtime import package.

## Task status mapping

- Raw PM statuses are normalized to **`Active`**, **`Blocked`**, and **`Done`** for the app-facing task model.
- Unknown or invalid values should map to a safe default (**`Active`**) unless a dedicated validation error is required.

## Location normalization

- Hierarchical path strings (e.g. `Level 3 > Zone A`) are resolved to **canonical `locations` rows** per project.
- Missing or ambiguous locations must be handled explicitly (seed validation or import errors).

## Owner and role assignment

- Package/trade codes map to **`role_types`** / **`assigneeRoleCode`** where applicable.
- Defaults (e.g. project manager) must be **validated** against `role_types` and site roster.

## Implementation references

| Area | Location |
| ---- | -------- |
| Drizzle schema | `packages/database/src/schema.ts` |
| Demo generation | `docs/demo/tools/` |
| Contracts enums | `packages/contracts/src/enums.ts` |

## Related

- [ADR 0004 — Monorepo package structure](../../architecture/adr/0004-monorepo-package-structure.md)
- [Canonical org, location, and integrity](../canonical-org-location-and-integrity.md)
