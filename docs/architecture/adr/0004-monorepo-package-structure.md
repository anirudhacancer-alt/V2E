---
last_changes: "Cross-links: docs/web → docs/field-app."
last_updated: "2026-03-27T15:32:00Z"
---

# ADR 0004: Monorepo package structure

Date: 2026-03-27  
Status: Accepted

## Context

V2E is delivered as a **pnpm + Turbo** monorepo. We need a stable layout for apps, shared packages, and the mobile wrapper so teams know where code belongs and how builds orchestrate.

## Decision

1. **Top-level layout:** `apps/*` for runnable applications and `packages/*` for shared libraries.
2. **Core packages:** `packages/contracts` (Zod/API types), `packages/database` (Drizzle + SQLite for demo), `packages/ai` (TypeScript AI runtime calling `ai-gateway`), `packages/shared` (small shared helpers).
3. **Apps:** `apps/api` (Hono API), `apps/field-app` (field app web UI; build output feeds Capacitor), `apps/planning-web` and `apps/marketing-site` (future surfaces), `apps/mobile` (Capacitor native shell).
4. **Mobile:** Capacitor wraps the **field-app** web bundle (`webDir` → `../field-app/dist`); no separate React app for iOS/Android in MVP.
5. **Build:** Root scripts use **Turbo** for parallel `typecheck`, `build`, and `dev` across the workspace.

## Consequences

- Clear ownership: product HTTP in `apps/api`, wire types in `packages/contracts`, persistence in `packages/database`.
- Adding a new deployable surface means a new `apps/*` package with its own `package.json` and Turbo pipeline.
- **Independent UI surfaces** (field vs planning vs marketing) do not share app-level React components across apps—see [ADR 0003](./0003-independent-enact-ui-surfaces-no-cross-app-react.md).

## Related

- `AGENTS.md` — commands and monorepo structure
- `docs/field-app/web-app-structure.md` — field-app shell and route layout (legacy `/supervisor/` segment)
