---
last_changes: "Cross-links: docs/web → docs/field-app."
last_updated: "2026-03-27T15:32:00Z"
---

# Repository invariants (V2E)

This document lists **non-negotiable rules** for keeping the monorepo coherent. Automated checks and git hooks enforce parts of this list; see `AGENTS.md` for commands.

## 1. Domain and API types: `@v2e/contracts`

- **Canonical types** for API JSON, Zod schemas, and shared enums live in `packages/contracts`.
- Application and API code **must not** re-export reserved domain or API DTO names outside `packages/contracts`. The script `pnpm check:contracts-boundary` enforces this for `apps/**` and `packages/shared` (see script config for the exact reserved name list).
- **Intentional exclusions** (not scanned by the boundary script):
  - **`packages/database`** — persistence and seed-specific shapes (Drizzle, CSV pipeline) are separate from wire contracts.
  - **`packages/ai`** — currently contains overlapping names; **should be aligned with `@v2e/contracts` over time** (see ADRs when refactored).

Internal, non-exported helpers and UI-only props types are fine; avoid **exporting** names that duplicate the contracts vocabulary.

## 2. Validation and demo data

- Do **not** remove, relax, or bypass existing validation (seed, CSV, contracts, API) without explicit approval and documentation. See `AGENTS.md` and `docs/demo/demo-seed-script-validations.md`.

## 3. Documentation hygiene

- `docs/common/IMPORTANT-CODE-TREE.md` is **generated**. After changing important roots or layout, run `pnpm docs:tree:update` and commit the result.
- Pre-commit runs `pnpm docs:tree:check`.
- **No `README.md` under `docs/`** except the allowlisted **`docs/architecture/adr/README.md`** (ADR index). **No `INDEX.md` anywhere under `docs/`.** Elsewhere, use **`AGENTS.md`** per folder. Pre-commit runs `scripts/git/check-docs-agent-entry-files.sh` (`pnpm check:docs-agent-entry`). On failure, **rename** the offending file to `AGENTS.md` in the same folder (merge content if needed).
- **`AGENTS.md` content (under `docs/`):** Each folder’s **`AGENTS.md`** should hold **folder purpose/scope**, **rules/invariants for agents**, **how to navigate deeper**, **important local conventions**, and **links to child docs**. It should **not** be used for long human onboarding prose, general marketing/introduction, or broad architecture that is not needed for agent behavior in that folder. The canonical checklist lives in **`docs/AGENTS.md`** (headings **What belongs in AGENTS.md** and **What usually does not belong in AGENTS.md**). Pre-commit runs **`pnpm check:agents-md-contract`** so those headings cannot be removed from `docs/AGENTS.md` without failing the hook.
- Markdown under `docs/architecture/` and `docs/strategy/` must start with YAML frontmatter including **`last_changes`** (short description of the edit) and **`last_updated`** (ISO-8601 UTC). Staged files in those paths are checked so `last_updated` is within the last **2 hours** (see `scripts/check/markdown-frontmatter.json`). Set `SKIP_MD_FRONTMATTER=1` only in emergencies.

## 4. Testing strategy

| Layer | Tool | Scope |
| ----- | ---- | ----- |
| Unit / route IA | Vitest (Vite-powered) | `**/*.test.ts` / `**/*.test.tsx` under `apps/*/src` and `packages/*/src`; field-app `.tsx` tests use `jsdom`. Prefer **navigation / manifest** tests over importing `routeTree.gen` in unit tests (that graph pulls the full React shell). |
| End-to-end | Playwright | **WebKit only** (single project: Desktop Safari). Install browsers with `pnpm test:e2e:install`. |

- **Pre-commit:** staged LFS guard, `check-docs-agent-entry-files.sh`, `check:agents-md-contract`, `docs:tree:check`, `check:markdown-frontmatter` (scoped Markdown), `check:contracts-boundary`, `typecheck`.
- **Pre-push:** Git LFS, `vitest run`, Playwright E2E (WebKit). The dev server must be running (`pnpm dev`) or CI must set `CI=true` for the `webServer` config.

Fast local iteration: start the field app with `pnpm dev` before pushing; E2E uses `E2E_BASE_URL` (default `http://127.0.0.1:3001`). In CI, `webServer` starts `turbo run dev --filter=@v2e/field-app` when `CI` is set (see `playwright.config.ts`).

## 5. Git hooks

Hook **entrypoints** live under **`.husky/`** (thin wrappers only). **Implementation** is under **`scripts/git/`** — see [`scripts/git/README.md`](../../scripts/git/README.md). Do not bypass hooks with `--no-verify` except where team policy explicitly allows (e.g. config-only commits in other repos).

## 6. ADRs

Material cross-cutting decisions are recorded under [`adr/`](./adr/README.md). Examples: [0003](adr/0003-independent-enact-ui-surfaces-no-cross-app-react.md) (UI surfaces); see [ADR index](adr/README.md) for 0004–0007 (monorepo, Bearer auth, extraction workflow, queue IA).

## 7. UI surfaces: Enact UI without cross-app React sharing

- **`apps/field-app`** and **`apps/mobile`** (Capacitor → field-app `dist`) are **one** execution UI: shared routes, shell, field-app UI (`components/supervisor/*`), and Enact UI usage (semantic surfaces/tokens).
- **`apps/planning-web`** and **`apps/marketing-site`** each consume **`@enact-ui/*`** with their **own** CSS entry and flavour. They **must not** import React components, hooks, or app-local modules from `apps/field-app`, from `apps/mobile`, or from the other marketing/planning app. Do **not** add a monorepo package whose purpose is shared product UI across those boundaries unless an ADR explicitly allows it.
- **Allowed shared layers:** `@v2e/contracts`, API clients typed from contracts, and other non-UI packages. The design system npm packages (`@enact-ui/react`, etc.) are the only intentional shared UI primitive layer.

Rationale and detail: [`docs/field-app/web-ui-enact-ui.md`](../field-app/web-ui-enact-ui.md#independent-surface-uis-locked).
Formal decision: [`docs/architecture/adr/0003-independent-enact-ui-surfaces-no-cross-app-react.md`](adr/0003-independent-enact-ui-surfaces-no-cross-app-react.md).
