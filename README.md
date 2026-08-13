<p align="center">
  <strong>V2E — Voice to Execution</strong>
</p>

<p align="center">
  <em>A frontline execution OS that converts field reality — voice, photos, and quick checks — into accountable tasks, blockers, and review workflows.</em>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#platform-surfaces">Surfaces</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#development">Development</a> •
  <a href="#documentation">Docs</a> •
  <a href="#license">License</a>
</p>

---

## What is V2E?

**Voice-to-Execution** is a configurable frontline execution platform for operationally critical work. It bridges the gap between frontline capture and manager-grade execution control to increase **execution reliability** across daily operations.

### Core capabilities

| Capability | Description |
|---|---|
| **Capture-first AI** | Voice notes, photos, and lightweight contextual input from the frontline |
| **Execution-grade outputs** | Tasks, blockers, ownership, due dates, escalations, and standup-ready queues |
| **Cross-surface operating model** | Field App + Planning Console + Marketing/onboarding funnel |
| **Multi-vertical workflow packs** | Construction, factory operations, retail execution — one platform, configurable packs |

### Positioning

> **Others digitize site communication. We make work operationally executable.**

V2E is **not** a note-taking tool, a voice assistant, a checklist app, or a mobile form builder. It is a **frontline execution OS** that drives measurable execution reliability.

---

## Architecture

### Monorepo structure

```
voice-to-execution/
├── apps/
│   ├── api/              # Hono on Node.js (port 3000, SQLite via better-sqlite3)
│   ├── field-app/        # React 19 + Vite + TanStack Router/Query (port 3001)
│   ├── mobile/           # Capacitor shell (iOS/Android, wraps field-app build)
│   ├── planning-web/     # Planning Console — desktop-first (port 3002)
│   └── marketing-site/   # Public marketing website (port 3003)
├── packages/
│   ├── contracts/        # Zod schemas — single source of truth for all types
│   ├── database/         # Drizzle ORM + SQLite + demo seed
│   ├── ai/               # AI processing logic
│   └── shared/           # Shared utilities
└── docs/
    ├── architecture/     # ADRs, repo invariants, deployment
    ├── strategy/         # USP, GTM, data model, platform IA
    ├── data-model/       # Entity docs, invariants
    ├── demo/             # Demo datasets, validation tools, walkthroughs
    └── web/              # UI specs and page contracts
```

### Core execution objects

The platform data model is built around five core objects:

| Object | Purpose |
|---|---|
| **Update** | Frontline reality capture (voice / text / photo / checklist) |
| **Task** | Actionable execution unit with owner, due date, and status |
| **Blocker** | Execution constraint needing resolution or escalation |
| **Commitment** | Standup/planning promise with target window and reliability tracking |
| **Improvement** | Corrective/preventive action linked to recurring issues (DMAIC) |

Supporting workflow objects: `StandupSession`, `Cycle`, `Dependency`.

---

## Platform Surfaces

V2E ships three frontend surfaces on a shared backend and domain model:

### 1. Field App (mobile + tablet)

Capture and execute in < 30 seconds. Bottom-tab navigation: **Today → Capture → Queue → Blockers → Standup**.

- Voice/photo/text capture with AI extraction and review
- Personal task and commitment views
- Standup prep with team/owner role modes
- Tablet split-view for side-by-side transcript + extracted tasks

### 2. Planning Console (desktop)

Compare, coordinate, and plan across many items. Persistent left-rail + right-side detail panel.

- AI review queue with bulk approve/reject
- Task workspace: table, kanban board (drag-drop), and timeline views
- Sprint/cycle commitment tracking
- Technical review queue (`GET /v1/reviews`)
- Operational reports and dashboards

### 3. Marketing Site (public web)

Explain value fast. Drive demo requests and qualified pipeline.

- Platform positioning and value proposition
- Industry launch-pack pages (factory, construction, field sales/retail)
- Book-demo / design-partner conversion flows

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Bun (API), Node/Vite (frontend apps) |
| **Frontend** | React 19, TanStack Router (file-based), TanStack Query, Tailwind CSS v4 |
| **Backend** | Hono framework |
| **Database** | SQLite via Drizzle ORM |
| **Validation** | Zod (contracts package) |
| **Mobile** | Capacitor (iOS / Android) |
| **Design System** | Enact UI (`@enact-ui/*`) — each surface applies its own theme |
| **Build** | Turbo, pnpm workspaces |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 20
- [pnpm](https://pnpm.io/) ≥ 9
- [Bun](https://bun.sh/) (API runtime)

### Install & run

```bash
# 1. Install dependencies
pnpm install

# 2. Start all dev servers (API :3000, Field App :3001, Planning :3002, Marketing :3003)
pnpm dev

# 3. Build for production
pnpm build
```

### Individual surfaces

```bash
pnpm --filter @v2e/field-app dev       # Field App only
pnpm --filter @v2e/api dev             # API only
pnpm --filter @v2e/planning-web dev    # Planning Console only
pnpm --filter @v2e/marketing-site dev  # Marketing Site only
```

### Database

```bash
pnpm --filter @v2e/database db:generate   # Generate Drizzle migrations
pnpm --filter @v2e/database db:push       # Push schema to SQLite
pnpm --filter @v2e/database db:seed       # Seed demo data
```

---

## Development

### Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | Type-check all packages (via Turbo) |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | Playwright E2E (WebKit) |
| `pnpm clean` | Remove dist, node_modules, .turbo caches |

### Git hooks (Husky)

After `pnpm install`, hooks are automatically wired:

| Hook | What it does |
|---|---|
| **pre-commit** | LFS checks, docs-tree freshness, contracts boundary, typecheck |
| **pre-push** | Git LFS, Vitest, Playwright E2E (WebKit) |

### Contracts-first workflow

Define Zod schemas in `packages/contracts` **before** implementing features:

```bash
pnpm --filter @v2e/contracts build
pnpm --filter @v2e/database db:generate
pnpm --filter @v2e/database db:push
```

---

## Vertical Strategy

V2E targets **frontline execution archetypes**, not generic industries:

| Archetype | Examples |
|---|---|
| **Shift-based operations** | Factory, warehouse, healthcare ops, logistics |
| **Field execution** | Construction, utilities, maintenance, facilities |
| **Visit-based execution** | Retail/RGM, inspections, audits, NGO field programs |
| **Incident/exception-driven** | Quality, EHS, venue/hospitality operations |

### Tiered expansion

- **Tier 1** — Construction, factory/plant ops, warehouse/logistics, facilities
- **Tier 2** — Retail/RGM, venue ops, hospitality, utilities/field service
- **Tier 3** — Healthcare operations, NGO/humanitarian, public field programs

---

## Documentation

| Area | Location |
|---|---|
| Architecture & ADRs | [`docs/architecture/`](docs/architecture/) |
| Strategy & GTM | [`docs/strategy/`](docs/strategy/) |
| Data model & invariants | [`docs/data-model/`](docs/data-model/) |
| API routes | [`docs/api/`](docs/api/) |
| UI specs | [`docs/field-app/`](docs/field-app/) |
| Demo datasets & tools | [`docs/demo/`](docs/demo/) |
| Phase plans | [`docs/common/plans/`](docs/common/plans/) |
| Important code tree | [`docs/common/IMPORTANT-CODE-TREE.md`](docs/common/IMPORTANT-CODE-TREE.md) |

### Demo data validation

```bash
pnpm --filter @v2e/contracts build
node docs/demo/tools/validate_demo_datasets.mjs --repo-root . --contracts 1328,1330
```

---

## Contributing

This is a proprietary project. Please see [LICENSE](LICENSE.md) for details.

---

## License

**All Rights Reserved** — © 2026 Amsterdam Data Labs

See [LICENSE.md](LICENSE.md) for the full license text.
