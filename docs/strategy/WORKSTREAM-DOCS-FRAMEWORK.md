---
last_changes: "Cross-links: docs/web → docs/field-app."
last_updated: "2026-03-27T15:32:00Z"
---

# Workstream Documentation Framework

Date: 2026-03-26  
Status: Active operating framework

## 1) Purpose

Create clear delivery hygiene for three parallel workstreams:

1. Marketing website
2. Planning web-app
3. Demo packs

The framework ensures:
- shared architecture stays coherent
- key docs remain current
- important code locations are discoverable

### UI composition boundary (locked)

All three frontend apps use **Enact UI** (`@enact-ui/*`), but **app-level React components are not shared** across workstreams:

| Surface | Apps | Component sharing |
| ------- | ---- | ----------------- |
| Field execution | `apps/field-app`, `apps/mobile` | **Shared:** one codebase; field-app components + Enact UI. |
| Planning Console | `apps/planning-web` | **Independent:** own routes and components; Enact UI only as primitives; **no** imports from field-app or marketing. |
| Marketing | `apps/marketing-site` | **Independent:** same rule; **no** imports from field-app or planning-web. |

Domain types stay in `@v2e/contracts`; API remains shared. Detail: [`docs/field-app/web-ui-enact-ui.md`](../field-app/web-ui-enact-ui.md#independent-surface-uis-locked). ADR: [`0003`](../architecture/adr/0003-independent-enact-ui-surfaces-no-cross-app-react.md).

---

## 2) Workstream ownership model

## Workstream A: Marketing Website

Scope:
- Positioning and launch-pack narrative
- Homepage and launch-pack pages
- CTA and design partner flows

Primary docs:
- `docs/marketing/MARKETING-WEBSITE-HOMEPAGE-SECTIONS.md`
- `docs/strategy/USP-GTM-AND-PROGRESS-TRACKER.md`
- `docs/strategy/PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md` (marketing IA sections)

## Workstream B: Planning Web-App

Scope:
- Planning board, review queues, dependencies
- Commitments, standup/rollup workflows
- Technical review surfaces

Primary docs:
- `docs/strategy/AGILE-EXECUTION-DATA-MODEL.md`
- `docs/strategy/PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md`
- `docs/api/overview.md`, `docs/api/routes/`

## Workstream C: Demo Packs

Scope:
- Pack definitions per vertical
- CSV/data scenarios, seed integrity, and demos
- KPI and outcome narratives for each pack

Primary docs:
- `docs/demo/datasets/AGENTS.md`
- `docs/demo/tools/` — CSV bundle generators and `validate_demo_datasets.mjs` (run from repo root; paths in datasets AGENTS)
- `docs/strategy/AGILE-EXECUTION-DATA-MODEL.md` (dataset expansion section)
- `docs/strategy/USP-GTM-AND-PROGRESS-TRACKER.md` (rollout tracker)

---

## 3) Shared source-of-truth docs

Treat these as repo-level control docs:

- `AGENTS.md`
- `docs/architecture/REPO-INVARIANTS.md`
- `docs/strategy/PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md`
- `docs/strategy/USP-GTM-AND-PROGRESS-TRACKER.md`
- `docs/strategy/AGILE-EXECUTION-DATA-MODEL.md`
- `docs/common/IMPORTANT-CODE-TREE.md` (auto-generated)

---

## 4) Auto-generated important code tree

The repository now maintains one shared, generated file:

- `docs/common/IMPORTANT-CODE-TREE.md`

Generated from:

- `docs/common/important-code-roots.json`
- `scripts/docs/generate-important-code-tree.mjs`

Commands:

```bash
pnpm docs:tree:update
pnpm docs:tree:check
```

Behavior:
- `docs:tree:update` regenerates `docs/common/IMPORTANT-CODE-TREE.md`
- `docs:tree:check` fails when the generated file is stale

---

## 5) Pre-commit hygiene rule

Pre-commit now enforces documentation tree freshness:

- `scripts/git/pre-commit.sh` (called from `.husky/pre-commit`) runs `pnpm docs:tree:check` before typecheck

If commit fails with stale tree:

1. run `pnpm docs:tree:update`
2. stage the updated `docs/common/IMPORTANT-CODE-TREE.md`
3. commit again

---

## 6) Definition of done per PR

For any PR that changes architecture, routes, contracts, or workstream scope:

- [ ] relevant workstream doc section updated
- [ ] control docs updated if assumptions changed
- [ ] `docs/common/IMPORTANT-CODE-TREE.md` up to date
- [ ] `pnpm docs:tree:check` passes
- [ ] `pnpm typecheck` and tests pass per normal workflow

---

## 7) Operating cadence

Weekly (or per planning cycle):

- Review vertical/workstream priorities
- Update rollout tracker and next actions
- Regenerate code tree if key folders/files changed
- Confirm AGENTS hygiene rules still match actual repo workflow
