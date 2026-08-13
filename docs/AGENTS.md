# Documentation index (V2E)

## Purpose of `AGENTS.md` in this tree

- **`AGENTS.md` in each folder** is the **agent-facing entry point** for that subtree: scoped guidance for coding assistants, not a generic human README.
- **Why not `README.md` or `INDEX.md` under `docs/`:** Many tools load **`AGENTS.md`** by convention; nested `README.md` / `INDEX.md` are not treated the same. Use **`AGENTS.md` consistently under `docs/`** so scoped guidance stays in one predictable name. The repo root may still use `README.md` for human visitors on GitHub.

## What belongs in AGENTS.md

- **Folder purpose and scope** — what this directory is for in one or two short paragraphs.
- **Rules / invariants** the agent must follow in this subtree (link out for long policy; keep the non‑negotiables here).
- **How to navigate deeper** — tables or bullets pointing at child **`AGENTS.md`** files and key Markdown files.
- **Important local conventions** — naming, frontmatter, seed/demo rules, or “when you change X, update Y” that apply here.
- **Links to child docs** — explicit markdown links so agents can traverse without guessing paths.

## What usually does not belong in AGENTS.md

- **Long human onboarding prose** — onboarding belongs in dedicated guides or the repo root `README.md`, not in every folder index.
- **General project marketing / introduction** — keep that out of per-folder agent entry points.
- **Broad architecture explanation** that is **not** needed for agent behavior in **this** folder — put deep dives under `docs/architecture/` or ADRs and link to them.

`docs/` groups work by **surface** (shared core plus web, mobile, iPad, marketing). Each surface folder may include a **`plans/`** subfolder for that team’s active planning and tracking notes; shared phase plans stay in [`common/`](common/AGENTS.md). **Strategy** (IA, GTM, agile data model, workstreams) lives in [`strategy/`](strategy/AGENTS.md).

## Top-level map

| Folder | Purpose |
|--------|---------|
| [common/](common/AGENTS.md) | PRD, phase plans, generated code index, cross-cutting entry points |
| [api/](api/AGENTS.md) | HTTP API (`apps/api`), [`overview`](api/overview.md), [`routes/`](api/routes/AGENTS.md), [`ai-runtime`](api/ai-runtime.md) |
| [architecture/](architecture/deployment/AGENTS.md) | ADRs (`adr/`), repo invariants, **deployment** runbooks (Azure, containers) |
| [data-model/](data-model/AGENTS.md) | SQLite entities, `@v2e/contracts` mapping, updates ↔ tasks & workflow invariants ([index](data-model/index.md)) |
| [strategy/](strategy/AGENTS.md) | Platform IA, GTM / progress tracker, agile execution data model, workstream framework |
| [demo/](demo/AGENTS.md) | Demo CSV bundles, walkthroughs, transcripts, prompts, seed validation |
| [field-app/](field-app/AGENTS.md) | Field app — page specs and UI notes (desktop / large responsive; `apps/field-app`) |
| [planning-web/](planning-web/AGENTS.md) | Planning console — surface docs and delivery plans (`apps/planning-web`) |
| [mobile/](mobile/AGENTS.md) | Phone-specific UX deltas and notes (add content as surfaces diverge) |
| [ipad/](ipad/AGENTS.md) | Tablet-specific UX deltas and notes |
| [marketing/](marketing/AGENTS.md) | Marketing site copy and structure (no shared product contracts) |

**Repo root:** `README.md` (humans), **`AGENTS.md`** (primary agent entry; commands and invariants), `CHANGELOG.md`.

## Automation

| Check / file | Role |
|--------------|------|
| `pnpm check:docs-agent-entry` | Fails if any `README.md` exists under `docs/` except `docs/architecture/adr/README.md`, or if any `INDEX.md` exists under `docs/` (pre-commit); rename offenders to `AGENTS.md` |
| `pnpm check:agents-md-contract` | Fails if this file is missing the **What belongs** / **What usually does not belong** contract headings (pre-commit) |
| [common/IMPORTANT-CODE-TREE.md](common/IMPORTANT-CODE-TREE.md) | Generated index — run `pnpm docs:tree:update` after manifest changes |
| [common/important-code-roots.json](common/important-code-roots.json) | Manifest for the tree generator |
