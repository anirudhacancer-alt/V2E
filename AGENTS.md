# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

V2E (Voice to Execution) is a construction and operations management application that converts voice updates into structured tasks via AI. Mobile-first web app for site and field **execution leads** (construction, factory, field reps, logistics, etc.).

**Doc terminology:** Prefer **field app**, **execution lead**, and **technical review** in prose; **literal code** keeps route prefixes (`/supervisor/`), role codes (`SiteSupervisor`), and helper names (`deriveSupervisorTaskState`) unchanged. The technical review queue read model is **`GET /v1/reviews`** (`reviews.ts`).

## AGENTS.md (this file and nested docs)

- **Purpose:** This file is the **primary entry** for AI coding assistants (Cursor, Claude Code, Copilot, etc.). Workspace rules and repo conventions point here so agents load the same commands and invariants.
- **Why `AGENTS.md` vs `README.md` under `docs/`:** Many tools **load `AGENTS.md` by convention** (or via project rules) but **do not** treat every nested `README.md` as mandatory context. Under `docs/` we use **`AGENTS.md` in each folder** so agents reliably pick up **scoped** guidance. The **repository root** may still have `README.md` for humans browsing GitHub.
- **What belongs in each nested `AGENTS.md` (and what to avoid):** Canonical **[content contract](docs/AGENTS.md#what-belongs-in-agentsmd)** in **`docs/AGENTS.md`** — folder scope, invariants for agents, navigation, local conventions, links to child docs; avoid long onboarding, marketing, or broad architecture that is not needed for behavior in that folder. Pre-commit runs **`pnpm check:agents-md-contract`** so those contract headings cannot be removed from `docs/AGENTS.md` by mistake.
- **Enforcement:** Under `docs/`, **`README.md`** (except **`docs/architecture/adr/README.md`**) and **`INDEX.md`** anywhere are **blocked in pre-commit**. Fix failures by **renaming** the file to **`AGENTS.md`** in the same folder (merge content if needed). Run **`pnpm check:docs-agent-entry`** locally.

## Commands

### Development
```bash
pnpm install           # Install all dependencies
pnpm dev               # API :3000, field-app :3001, planning-web :3002, marketing-site :3003
pnpm build             # Build all packages and apps
pnpm typecheck         # Type-check all packages (dependency builds run first via Turbo)
pnpm test              # Unit tests (Vitest)
pnpm test:e2e          # Playwright E2E (WebKit only; see playwright.config.ts)
pnpm test:e2e:install  # Install Playwright WebKit browser binary (run once per machine/CI image)
pnpm check:contracts-boundary  # Ensure apps/shared do not export types reserved for @v2e/contracts
pnpm clean             # Remove dist, node_modules, .turbo caches
pnpm docs:tree:update  # Regenerate docs/common/IMPORTANT-CODE-TREE.md
pnpm docs:tree:check   # Verify docs/common/IMPORTANT-CODE-TREE.md is current
pnpm check:docs-agent-entry  # No README.md under docs/ (except adr) or INDEX.md — use AGENTS.md (see REPO-INVARIANTS.md)
pnpm check:agents-md-contract  # docs/AGENTS.md must keep What belongs / What does not belong contract headings
pnpm check:markdown-frontmatter  # Staged docs under docs/architecture/ and docs/strategy/: frontmatter + fresh last_updated (see REPO-INVARIANTS.md)
```

Repo-wide rules and automation: [`docs/architecture/REPO-INVARIANTS.md`](docs/architecture/REPO-INVARIANTS.md). Architecture decisions: [`docs/architecture/adr/`](docs/architecture/adr/).

### Git hooks (Husky)

Git only uses **one** `core.hooksPath` (Husky sets `.husky/_`; hook **entrypoints** live only under **`.husky/`**). The former `.githooks/` tree is **removed**; its behavior is merged here.

**Implementation** for each hook is in **`scripts/git/`** (orchestrators + helpers). See **[`scripts/git/README.md`](scripts/git/README.md)** for the mapping (`.husky/pre-commit` → `scripts/git/pre-commit.sh`, etc.). Do not put multi-step logic in `.husky/` files beyond calling those scripts.

After `pnpm install`, hooks are wired via the `prepare` script. After install, run **`pnpm test:e2e:install`** once so Playwright can launch WebKit (required for `pre-push` E2E unless you skip it).

| Hook | Steps (via `scripts/git/*.sh`) |
|------|--------|
| **pre-commit** | 1) `pre-commit-staged-lfs.sh` — CSVs must be Git LFS pointers; staged files capped at 10 MB. 2) `check-docs-agent-entry-files.sh` 3) `pnpm check:agents-md-contract` 4) `pnpm docs:tree:check` 5) `pnpm check:markdown-frontmatter` (scoped Markdown) 6) `pnpm check:contracts-boundary` 7) `pnpm exec turbo run typecheck` |
| **pre-push** | 1) `git lfs pre-push` (requires `git-lfs` on PATH). 2) `pnpm exec vitest run` 3) `pnpm exec playwright test` (WebKit only) |
| **post-checkout** / **post-commit** / **post-merge** | `git lfs` passthrough hooks (same as standard Git LFS install) |

```bash
# run the same checks manually (same as hooks, from repo root)
bash scripts/git/pre-commit.sh
bash scripts/git/pre-push.sh
pnpm check:docs-agent-entry
pnpm check:agents-md-contract
pnpm check:markdown-frontmatter
pnpm check:contracts-boundary
pnpm typecheck
pnpm test
pnpm test:e2e
```

### Common Build Pattern (Monorepo)

Use this sequence for consistent local validation:

```bash
# 1) Keep docs index current
pnpm docs:tree:update

# 2) Compile and type-check workspace
pnpm typecheck

# 3) Run test suite
pnpm test

# 4) Optional full safety pass
pnpm check:all
```

Standard development-cycle requirement:

- If your change introduces any unresolved risk, migration caveat, or unaccounted behavior delta, update `ISSUES.md` in the same PR.
- If there is no unresolved risk for your scope, add a dated "No known unaccounted breakage" note for that scope in `ISSUES.md`.

When changing contracts or schema:

```bash
pnpm --filter @v2e/contracts build
pnpm --filter @v2e/database db:generate
pnpm --filter @v2e/database db:push
```

### Individual Apps/Packages
```bash
pnpm --filter @v2e/field-app dev          # Field app only
pnpm --filter @v2e/api dev              # API only
pnpm --filter @v2e/contracts build  # Build contracts package
```

### Database (packages/database)
```bash
pnpm --filter @v2e/database db:generate   # Generate Drizzle migrations
pnpm --filter @v2e/database db:push       # Push schema to SQLite
pnpm --filter @v2e/database db:seed       # Seed demo data
```

### Demo Data Validation
```bash
node docs/demo/tools/validate_demo_datasets.mjs --repo-root . --contracts 1328,1330
```

### TanStack Router
```bash
pnpm --filter @v2e/field-app generate-routes    # Regenerate route tree
```

## Architecture

### Monorepo Structure
- **apps/api** — Hono on Node.js + `@hono/node-server` (port 3000; SQLite via `better-sqlite3`)
- **apps/field-app** — React 19 + Vite + TanStack Router/Query (port 3001); Field App (field execution UI); web bundle for **`apps/mobile`** (Capacitor iOS/Android)
- **apps/mobile** — Capacitor (`@v2e/mobile`); `webDir` → `../field-app/dist`
- **apps/planning-web** — Planning Console surface (port 3002)
- **apps/marketing-site** — Public marketing surface (port 3003)
- **packages/contracts** — Zod schemas shared across all apps
- **packages/database** — Drizzle ORM + SQLite + demo seed scripts
- **packages/ai** — AI processing logic
- **packages/shared** — Shared utilities

### Tech Stack
- **Runtime**: Bun (API), Node/Vite (field-app, planning-web, marketing-site)
- **Frontend**: React 19, TanStack Router (file-based), TanStack Query, Tailwind v4
- **Backend**: Hono framework
- **Database**: SQLite via Drizzle ORM
- **Validation**: Zod (contracts package)
- **Mobile**: Capacitor (**`apps/mobile`**) — native iOS/Android wrapping the field-app build; plugins (camera, microphone, status bar, etc.)
- **Build**: Turbo, pnpm workspaces

### Enact UI Integration
The field app consumes `@enact-ui/*` packages from a sibling checkout (`../enact-ui`). Dependencies are linked via `file:` paths in package.json and `pnpm.overrides` at the root. Tailwind v4's `@source` directive in `apps/field-app/src/index.css` must point to the local Enact UI checkout for utility classes to be generated.

**Surface independence:** `apps/field-app` and `apps/mobile` share one UI (field execution). `apps/planning-web` and `apps/marketing-site` use Enact UI with **separate** theme/flavour and **must not** import shared React components from the field app, from each other, or from a cross-app UI package—see `docs/field-app/web-ui-enact-ui.md` and `docs/architecture/REPO-INVARIANTS.md`.

### Contracts Package
Central source of truth for all data types. Key schemas:
- **Enums**: Severity, TaskStatus, UpdateCategory, Trade, AttendanceStatus, `DepartmentEnum`, `RoleTypeCodeSchema` / canonical role codes
- **Entities (persisted)**: User, Site, Project, TeamMember, Update, Task; **AttendanceSession** + **Attendance** (roll-call sessions and rows)
- **Standup UI**: No `standups` table in SQLite — the field-app standup route (`/supervisor/standup`) uses **`StandupPrepResponseSchema`** and item schemas in `standup.ts` (`PlannedItemSchema`, etc.) as **read-model** types derived from tasks, not a stored standup entity

Import via `@v2e/contracts` (builds to `dist/index.js`).

**Canonical org/location model and API JSON names** (`departmentCode`, `assigneeRoleCode`, `locationList`, `DATA_INTEGRITY`): `docs/data-model/canonical-org-location-and-integrity.md`.

### Database Schema
Drizzle schema in `packages/database/src/schema.ts`. Demo data lives in `packages/database/data/demo.sqlite`. Configure path via `DEMO_SQLITE_PATH` env var. The same canonical FK layout is documented in `docs/data-model/canonical-org-location-and-integrity.md`. **Per-entity reference:** `docs/data-model/index.md` (tables, Mermaid/ASCII hierarchy, links to contracts).

### Routing (Web)
File-based routing under `apps/field-app/src/routes/`. Route tree auto-generated to `routeTree.gen.ts`.

## Demo Data

Demo contracts/packs live in `docs/demo/datasets/` (count and IDs evolve over time). Validation and generator scripts live in `docs/demo/tools/`.

Canonical demo-data behavior:
- Demo bundles include updates, AI outputs, tasks, **`attendance_sessions` + `attendances`**, and attachments.
- Standup **prep lists** are read-model outputs derived from `tasks` (not stored CSV standup tables); see `docs/field-app/standup-prep-from-tasks.md`.
- Every **update** is linked to task flow via canonical edges (`tasks.sourceUpdateId` or `updates.linkedTaskId`); see `docs/data-model/update.md`.

## Phase Plan

Phase planning docs live under **`docs/common/plans/`**.
Durable cross-cutting decisions belong in **`docs/architecture/adr/`**.
Use **`docs/common/plans/AGENTS.md`** as the entry point for current plan navigation.

## Key Patterns

- Contracts-first: Define Zod schemas before implementing features
- API endpoints: per-route docs under `docs/api/routes/` (see `docs/api/overview.md`)
- UI routes map to PRD pages under the field-app segment, e.g. `/supervisor/home`, `/supervisor/tasks`, `/supervisor/standup` (segment name is legacy; users are execution leads across verticals).

## Implementation hygiene (completeness over shims)

These are **project guidelines** for merged code (not every line is machine-enforced). Prefer shipping **one coherent behavior** over layered “temporary” paths.

- **Backward compatibility:** Do **not** add parallel APIs, duplicate DTOs, deprecated aliases, or long-lived dual code paths solely to keep obsolete clients working. If a migration window is required, document it in an ADR and/or `ISSUES.md` with owners and removal criteria—then delete the old path when the window ends.
- **Stubs and placeholders:** Avoid merging **not implemented** behavior on user-facing routes or API contracts (e.g. empty handlers, `throw new Error("TODO")`, fake data) as the “finished” implementation. Prefer completing the slice, gating behind an explicit feature flag, or keeping work in a branch until it is real.
- **TODO / FIXME / HACK comments:** Do not rely on inline markers as the **only** record of required work. Track scope in `ISSUES.md`, a GitHub issue, or an active plan; resolve or remove markers when merging or soon after.
- **Not the same as legacy identifiers:** Stable **literal** names in code (route prefixes like `/supervisor/`, canonical role codes) are **documented terminology / naming debt**, not backward-compatibility shims—keep them unless a deliberate rename is approved.

## Workstream Framework and Doc Hygiene

Parallel workstreams are first-class in this repo:

1. Marketing website
2. Planning web-app
3. Demo packs

Operating framework:
- `docs/strategy/WORKSTREAM-DOCS-FRAMEWORK.md`

### Documentation hygiene principles

Treat documentation as part of delivery: **stale plans and wrong docs cost the same as stale code.**

| Kind | Role | Typical location |
| ---- | ---- | ---------------- |
| **Plans / checklists** | Track *what* is being built and when (`docs/common/plans/`). | Ephemeral; remove or **archive** after the work lands. |
| **Code** | Source of truth for *current* behavior. | `apps/`, `packages/` |
| **ADRs** | Durable record of *why* for cross-cutting, costly-to-reverse decisions. | `docs/architecture/adr/` |
| **Invariants & data rules** | Non-negotiable product or validation rules. | `docs/data-model/invariants/` (data normalization, updates/tasks workflow), `docs/data-model/` (updates ↔ tasks edges, entity docs), `docs/architecture/REPO-INVARIANTS.md` |
| **Runbooks** | Deploy, hosting, cost, env—living operational truth. | `docs/architecture/deployment/DEPLOYMENT.md` (and related ops docs), not one-off plan files |
| **Superseded design snapshots** | Historical UX/IA notes kept for audit. | Store in the designated archive location documented in current docs indexes; avoid adding ad-hoc archive paths. |

**Rules of thumb:**

1. **Checklists explain progress, not architecture** — completed boxes do not replace ADRs or invariants.
2. **Decisions belong in ADRs** when they span teams or packages; link from `docs/common/` or `AGENTS.md` as needed.
3. **Operational procedures** (Azure layout, costs, shared services) belong next to **deployment** docs, not orphaned under `plans/`.
4. **When a phase or initiative finishes**, migrate anything still valuable into ADRs / `docs/common/` / `docs/architecture/deployment/`, then **delete or archive** the tracking doc so search and onboarding stay accurate.
5. **Track unresolved breakage centrally** in `ISSUES.md` at repo root — if a change has unaccounted behavior/risk, add it there with owner and timeline in the same PR.

When retiring plan files, migrate durable content into ADRs/runbooks and keep plan folders focused on active execution.

Product and GTM strategy specs (IA, data model, platform tree):
- `docs/strategy/` — e.g. `PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md`, `AGILE-EXECUTION-DATA-MODEL.md`, `USP-GTM-AND-PROGRESS-TRACKER.md`
- `docs/marketing/` — public site copy (e.g. `MARKETING-WEBSITE-HOMEPAGE-SECTIONS.md`)

Auto-generated shared code index:
- `docs/common/IMPORTANT-CODE-TREE.md` (generated, do not edit manually)
- Source manifest: `docs/common/important-code-roots.json`
- Generator: `scripts/docs/generate-important-code-tree.mjs`

Pre-commit hygiene:
- `scripts/git/pre-commit.sh` (invoked from `.husky/pre-commit`) runs `pnpm docs:tree:check`
- If stale, run `pnpm docs:tree:update`, stage `docs/common/IMPORTANT-CODE-TREE.md`, and retry commit

## Git Safety and Collaboration Rules

- **Never commit automatically.** Wait for explicit user review/approval before creating any commit.
- **Never stash changes automatically.** Do not run `git stash` unless the user explicitly asks for it.
- **Never delete files you did not touch for this task.** Other teammates may be actively working on them.
- **Never revert unrelated work.** If unrelated files are dirty, leave them untouched.
- **If unexpected changes appear mid-task, stop and ask before proceeding.**

## Validation Invariants (Critical)

Validation rules are treated as safety invariants for this repository.

- **Do not remove, relax, rename, or bypass any existing validation** (seed validations, CSV validators, contract validations, API validations) without **explicit user confirmation in the current chat**.
- **Do not change new validation rules that were just added** without explicit user confirmation.
- If a new feature conflicts with an existing validation rule, **stop and ask the user** whether to:
  - keep the rule and adjust implementation/data, or
  - intentionally change the rule.
- If a change is approved, document it in:
  - `docs/demo/demo-seed-script-validations.md` (for seed/data rules), and/or
  - the relevant plan/review doc covering the impacted validation scope.
