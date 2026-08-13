---
last_changes: "Frontmatter refresh (pre-commit last_updated window)."
last_updated: "2026-03-27T15:32:00Z"
---

# Architecture documentation

Parent index: [../AGENTS.md](../AGENTS.md). Deployment notes: [DEPLOYMENT.md](../architecture/deployment/DEPLOYMENT.md) (includes **Azure rollout**); folder index [deployment/AGENTS.md](../architecture/deployment/AGENTS.md). Archived plan snapshots: [docs/archive/](../archive/README.md).

| Document | Description |
| -------- | ----------- |
| [**Repo invariants**](../architecture/REPO-INVARIANTS.md) | Non-negotiable rules: contracts boundary checks, hooks, testing layers (Vitest + WebKit Playwright), ADR pointer. |
| [**Deployment runbook**](../architecture/deployment/DEPLOYMENT.md) | Web/API/gateway hosting, Azure Container Apps shape, Enact UI packaging prerequisites, env vars ([folder index](../architecture/deployment/AGENTS.md)). |
| [Git hook scripts](../../scripts/git/README.md) | `.husky/` entrypoints only; hook **implementation** under `scripts/git/` (pre-commit, pre-push, LFS helpers). |
| [Architecture Decision Records (ADRs)](../architecture/adr/README.md) | Cross-cutting decisions (`docs/architecture/adr/`); includes [ADR 0003](../architecture/adr/0003-independent-enact-ui-surfaces-no-cross-app-react.md) (independent Enact UI surfaces). |
| [Data normalization invariants](../data-model/invariants/data-normalization-invariants.md) | Demo/import rules for task status, locations, owner mapping (see also demo tools; [folder index](../data-model/invariants/AGENTS.md)). |
| [**Canonical org, location, and integrity**](../data-model/canonical-org-location-and-integrity.md) | **Single source of truth** for `role_types` / `departments` / `locations`, FK columns, public JSON field names (`departmentCode`, `assigneeRoleCode`, `orgRoleCode`, `locationList`), `DATA_INTEGRITY` (500) vs extraction 422, and links to contracts + seed rules. |
| [**Data model (entity index)**](../data-model/index.md) | All SQLite entities: tabular overview, ASCII + Mermaid hierarchy, links to `packages/contracts` per entity. |
| [Update entity / updates ↔ tasks](../data-model/update.md) | Canonical edges: `tasks.sourceUpdateId` (voice/AI → task), `updates.linkedTaskId` (human note → existing task); what is **not** redundant (`update_ai_outputs`, risk child rows, attachments vs task rows). |
| [Updates and tasks workflow invariants](../data-model/invariants/updates-tasks-workflow-invariants.md) | Canonical product rules for how update queue state (`Review`, `Linked`, `Escalated`) relates to task execution state (`Active`, `Blocked`, `Done`, `Overdue`) and when human review is required. |
| [HTTP API overview](../api/overview.md) | Stack, versioning, auth; links to [per-route docs](../api/routes/AGENTS.md). |
| [AI runtime and gateway](../api/ai-runtime.md) | `packages/ai`, `ai-gateway`, config, idempotency, extraction auto-task. |
| [Web UI and Enact UI](../field-app/web-ui-enact-ui.md) | How `apps/field-app` consumes `@enact-ui` (Vite, Tailwind v4, `file:` links, CSS entry), TanStack Router file routes and nested layouts, dev proxies for `/v1` + `/uploads`, and **independent** planning/marketing surfaces (no cross-app React components). |
| [Web app structure](../field-app/web-app-structure.md) | Shell (`components/shell`), modular field app UI (`components/supervisor/*`), navigation config (`lib/navigation.ts`), and how they relate to `__root.tsx` and routes. |
| [Field app UI invariants](../field-app/field-app-ui-invariants.md) | Structural guardrails for field-app routes: one shared shell system, one shared page-state system, and extraction rules for reusable route-level UI. |
| [Mobile strategy](../mobile/mobile-strategy.md) | Single codebase, Capacitor, and how the same web stack targets iOS/Android. |
| [Local dev on mobile](../mobile/local-dev-on-mobile.md) | How to reach the running dev servers from a physical phone using Tailscale (or ngrok): one-time setup, session commands, troubleshooting. |
| [Demo seed script validations](../demo/demo-seed-script-validations.md) | Validation rules for seeded demo data. |
| [Field app UI material update](../field-app/field-app-ui-material-update.md) | Field app material surface and token notes (`supervisor-material-*` classes). |
