# Planning console (`docs/planning-web/`)

**Scope:** Documentation for the **planning console** surface — `apps/planning-web` (desktop-first coordination; port **3002** in the monorepo dev script). This folder holds **surface-level delivery plans** and navigation for agents; it is not the full product strategy (see [`docs/strategy/`](../strategy/AGENTS.md)).

## What belongs here

- **Delivery plans** for the planning console under [`plans/`](plans/AGENTS.md) — phased ship names (e.g. task workspace, sprint-board), goals, routes, and exit criteria.
- **Pointers** to the unified execution data model ([`AGILE-EXECUTION-DATA-MODEL.md`](../strategy/AGILE-EXECUTION-DATA-MODEL.md)) and platform IA ([`PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md`](../strategy/PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md)).
- **Invariants** that apply only to this surface: Enact UI primitives, **no** imports of React components from `apps/field-app`, `apps/mobile`, or `apps/marketing-site`; separate theme/flavour per app (see [`docs/architecture/REPO-INVARIANTS.md`](../architecture/REPO-INVARIANTS.md), [ADR 0003](../architecture/adr/0003-independent-enact-ui-surfaces-no-cross-app-react.md)).

## What usually does not belong here

- Field execution page specs — those live under [`docs/field-app/`](../field-app/AGENTS.md).
- Long-form GTM or marketing copy — [`docs/strategy/`](../strategy/AGENTS.md), [`docs/marketing/`](../marketing/AGENTS.md).
- HTTP API contract details — [`docs/api/`](../api/AGENTS.md) and `packages/contracts`.

## Entry points

| Document | Role |
|----------|------|
| [`plans/AGENTS.md`](plans/AGENTS.md) | Index of phase plans |
| [`plans/PLAN-OVERVIEW.md`](plans/PLAN-OVERVIEW.md) | Shell layout, screen map, phase summary |

Parent: [../AGENTS.md](../AGENTS.md).
