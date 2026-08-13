# Data model (`docs/data-model/`)

**Scope:** Per-entity Markdown for **SQLite persistence** (Drizzle schema in `packages/database`) and how each entity maps to **`@v2e/contracts`**. **Zod enums** are documented on each relevant entity page (not a single `enums.md`); the shared catalog is [`packages/contracts/src/enums.ts`](../../packages/contracts/src/enums.ts). These pages are for agents implementing or changing API/seed behavior—not a substitute for the PRD.

## Canonical spec alignment

**Normative entity and field model:** [`plans/NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md`](plans/NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md) **§5–§9** (object model), **§8** (per-entity SQLite-oriented sections), **§13–§14** (contracts package and migration expectations).

**When adding or changing tables:**

1. Update `packages/database/src/schema.ts` and contracts under `packages/contracts/src/` as in §13–§14.
2. Add or refresh **one `*.md` per persisted table** (or tightly coupled group, e.g. attendance), and add a row to [index.md](index.md) **Tabular overview**.
3. Keep HTTP paths in entity docs consistent with [`../api/routes/AGENTS.md`](../api/routes/AGENTS.md) (§12 / §17 in the canonical plan). If the plan marks a row 🟡 or ⏸️, mirror that nuance on the entity page.

**Match check (index vs schema):** All core execution tables in §8 / §14 are represented in [index.md](index.md), including `notification_preferences` and `delivery_attempts`. **Read-only / derived** surfaces (e.g. standup prep from tasks) are called out in index and [../field-app/standup-prep-from-tasks.md](../field-app/standup-prep-from-tasks.md), not as extra SQLite tables.

**Invariants:** Org/location JSON names and FK rules live in [canonical-org-location-and-integrity.md](canonical-org-location-and-integrity.md). Demo/import normalization (task status, locations, roles): [invariants/data-normalization-invariants.md](invariants/data-normalization-invariants.md) ([folder index](invariants/AGENTS.md)). Updates ↔ tasks edges and review semantics: [update.md](./update.md). Workflow queue vs task execution: [invariants/updates-tasks-workflow-invariants.md](invariants/updates-tasks-workflow-invariants.md). Standup prep as a read model: [standup-prep-from-tasks.md](../field-app/standup-prep-from-tasks.md).

## Navigate

| Start here | Role |
|------------|------|
| [index.md](index.md) | Tabular overview, hierarchy diagram, links to every entity doc |
| [entity-relationship-diagram.md](entity-relationship-diagram.md) | Mermaid `erDiagram` for SQLite tables |
| [canonical-org-location-and-integrity.md](canonical-org-location-and-integrity.md) | `departmentCode`, `assigneeRoleCode`, `locationList`, integrity rules |

Entity pages (examples): [user.md](user.md), [task.md](task.md), [update.md](update.md), [attendance.md](attendance.md) — see the full list in [index.md](index.md).

Parent: [docs/AGENTS.md](../AGENTS.md).
