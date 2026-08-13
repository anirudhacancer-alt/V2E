# Changelog

All notable changes to this repository should be documented in this file.

The format is inspired by Keep a Changelog, adapted for this monorepo.

## [Unreleased]

### Added
- **Repository hygiene:** `docs/architecture/REPO-INVARIANTS.md`, ADR process (`docs/architecture/adr/`), automated `pnpm check:contracts-boundary` (reserved type names must live in `@v2e/contracts`), Vitest + Testing Library + jsdom for field-app tests, Playwright E2E **WebKit only** (`e2e/`, `playwright.config.ts`). Pre-commit runs the contracts boundary check; pre-push runs Vitest and Playwright E2E (mandatory). One-time: `pnpm test:e2e:install` for the WebKit browser binary.
- `apps/planning-web` and `apps/marketing-site` minimal Vite + React placeholder apps (dev ports **3002** and **3003**); greenfield UIs to be implemented later.
- Workstream documentation framework for parallel delivery tracks (`docs/strategy/WORKSTREAM-DOCS-FRAMEWORK.md`).
- Auto-generated important code index:
  - `docs/common/IMPORTANT-CODE-TREE.md`
  - `docs/common/important-code-roots.json`
  - `scripts/docs/generate-important-code-tree.mjs`
- Marketing website homepage draft sections (`docs/marketing/MARKETING-WEBSITE-HOMEPAGE-SECTIONS.md`).
- Agile execution data model implementation spec (`docs/strategy/AGILE-EXECUTION-DATA-MODEL.md`).

### Changed
- **Doc filenames (terminology):** `docs/field-app/supervisor-ui-invariants.md` → `field-app-ui-invariants.md`; `SUPERVISOR_UI_MATERIAL_UPDATE.md` → `field-app-ui-material-update.md`; phase-C planning doc under `docs/data-model/plans/` renamed to `phase-C-technical-review-and-improvements.md` (drops legacy queue wording from the filename). Update bookmarks and relative links accordingly.
- Renamed **`apps/web`** → **`apps/field-app`** (package **`@v2e/field-app`**). The Field App remains the field-execution / mobile-first UI; **`apps/mobile`** Capacitor builds now read **`../field-app/dist`**. Root `pnpm dev` clears ports **3000–3003** (API, field-app, planning-web, marketing-site).
- Root-level documentation moved under `docs/`: PRD → `docs/common/PRD.md`; deployment and Azure plans → `docs/common/deployment/`; design and seed architecture notes → `docs/common/`; generated code index → `docs/common/IMPORTANT-CODE-TREE.md`. Repo root keeps `README.md`, `AGENTS.md`, `CLAUDE.md`, and `CHANGELOG.md` only.
- Product and GTM strategy markdowns under `docs/strategy/` (platform IA, USP/GTM tracker, agile data model); marketing homepage sections under `docs/marketing/`. `important-code-roots.json` and generated `docs/common/IMPORTANT-CODE-TREE.md` updated accordingly.
- Expanded platform architecture and IA docs for:
  - marketing site as a distinct surface
  - role-based execution modes (execution lead / technical review / manager / frontline)
  - commitments, work cycles, and improvement loop framing
- Expanded USP/GTM strategy docs for:
  - archetype-led vertical expansion
  - tiered market priorities
  - execution reliability narrative
- Updated pre-commit hygiene to enforce docs tree freshness (`pnpm docs:tree:check`).
- Updated `AGENTS.md` with:
  - common build pattern
  - explicit collaboration and git safety rules.

### Notes
- Full Planning Console and marketing **product UIs** remain future work; see `docs/strategy/PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md` §5–§7.
- Keep entries concise and grouped by `Added`, `Changed`, `Fixed`, `Removed`.
- Update this file before commit when behavior, architecture, or process changes.
