# Web UI and Enact UI

## Purpose

The product UI for `apps/field-app` is built in **React** and composed from **Enact UI**: the shared design system and component packages maintained in the [`enact-ui`](https://github.com/enact-ui/enact-ui) repository (local checkout). This repository does **not** define a separate in-app component library; screens and flows are implemented as **TanStack Router** routes that import primitives, layouts, and patterns from `@enact-ui/*`.

The same wiring pattern is used by **enact-desktop** (Tauri + Vite). That app is a useful reference for dependencies and global CSS, with the difference that V2E runs as a **browser** app only (no Tauri bootstrap or desktop-only CSS).

## Independent surface UIs (locked)

**Field execution surface (one family):** `apps/field-app` and **`apps/mobile`** (Capacitor wrapping the field-app build) share the **same** React UI: Enact UI primitives, semantic surfaces/tokens, and app-specific code under `apps/field-app/src/components/**` (shell, supervisor patterns, routes). Treat iPhone, iPad, and desktop breakpoints as one product skin.

**Planning and marketing (separate flavours):** `apps/planning-web` and `apps/marketing-site` also build on **`@enact-ui/*`**, each with its **own** global CSS entry, Tailwind `@source` wiring, and theme/flavour. They must **not** import or reuse **React components** (or local component modules) from `apps/field-app` or from each other. Planning and marketing do **not** share app-level components with one another either—only the upstream design system packages.

**Why:** Keep execution, planning, and marketing **visually and structurally independent** while still grounding everything in Enact UI. Shared **domain** types remain in `@v2e/contracts`; shared **API** in `apps/api`. Do **not** introduce a `packages/ui-system` (or similar) that couples these surfaces without an explicit architecture decision.

See also: [`docs/architecture/adr/0003-independent-enact-ui-surfaces-no-cross-app-react.md`](../architecture/adr/0003-independent-enact-ui-surfaces-no-cross-app-react.md) (ADR), `docs/architecture/REPO-INVARIANTS.md` (UI surfaces), `docs/strategy/WORKSTREAM-DOCS-FRAMEWORK.md` (workstream boundaries).

## Expected directory layout

The npm `file:` paths assume this layout on disk:

- `voice-to-execution` lives under `NAShira/Repos/voice-to-execution` (this monorepo).
- `enact-ui` lives as a **sibling** of `Repos` under `NAShira`, i.e. `NAShira/enact-ui`.

If you clone `enact-ui` elsewhere, update:

- [`apps/field-app/package.json`](../../apps/field-app/package.json) — each `file:../../../enact-ui/...` dependency.
- [`package.json`](../../package.json) (repo root) — each `pnpm.overrides` `file:../../enact-ui/...` entry.
- [`apps/field-app/src/index.css`](../../apps/field-app/src/index.css) — the `@source` globs that point at the checkout’s `packages/*/src` (see below).

## Packages consumed

From `apps/field-app` (via `file:` links):

| Package | Role |
| ------- | ---- |
| `@enact-ui/react` | Core components, tokens-driven styling. |
| `@enact-ui/application` | Application-level patterns (navigation, tables, etc.). |
| `@enact-ui/animate` | Animation helpers used by components. |
| `@enact-ui/charts` | Chart wrappers (optional; peer version warnings may appear until aligned). |
| `@enact-ui/presets` | Preset configuration consumed by `@enact-ui/react`. |

The monorepo root uses **`pnpm.overrides`** so nested dependencies that expect `workspace:*` or matching file URLs resolve to the same local packages.

## Toolchain

- **React 19**, **Vite 6**, **TanStack Router** (file-based routes), **TanStack Query** for server state.
- **Tailwind CSS v4** is integrated with **`@tailwindcss/vite`** (not Tailwind v3 + PostCSS). This matches Enact UI’s CSS entry, which uses Tailwind v4 directives such as `@import "tailwindcss"`, `@source`, and `@plugin`.

## TanStack Router (file-based)

- Routes live under [`apps/field-app/src/routes/`](../../apps/field-app/src/routes/); the plugin emits [`apps/field-app/src/routeTree.gen.ts`](../../apps/field-app/src/routeTree.gen.ts) (do not edit by hand).
- **Regenerate** after adding, removing, or renaming route files. From `apps/field-app`:
  - `pnpm dlx @tanstack/router-cli generate`
  - or `pnpm generate-routes` when the `tsr` CLI is available on `PATH`.
- **Nested layouts:** a parent file (e.g. `supervisor/tasks.tsx`) that has child files (`tasks.index.tsx`, `tasks.$taskId.tsx`) must render **`<Outlet />`** so child routes display. The task board uses this split so `/supervisor/tasks` shows the list and `/supervisor/tasks/:taskId` shows detail without breaking navigation. See [Field app UI invariants](./field-app-ui-invariants.md#tanstack-router-nested-field-app-routes).

## API base URL and Vite dev proxy

When **`VITE_API_URL` is empty** (recommended for local dev and phone testing via Tailscale), the SPA issues same-origin requests:

| Path prefix | Proxied to |
| ----------- | ------------ |
| `/v1` | `http://127.0.0.1:3000` (Hono API) |
| `/uploads` | same — API serves files from `apps/api/uploads` |

Configured in [`apps/field-app/vite.config.ts`](../../apps/field-app/vite.config.ts). In production or when pointing at a remote API, set `VITE_API_URL` to the API origin; the client must still be able to load attachment URLs (either same host as API or a dedicated media base — see [HTTP API overview](../api/overview.md) and [root route](../api/routes/root.md) / [projects route](../api/routes/projects.md#create-updates-and-attachments-uploads-router) for static media and create-update uploads).

## Global CSS entry

[`apps/field-app/src/index.css`](../../apps/field-app/src/index.css) is the single global stylesheet, imported from [`apps/field-app/src/main.tsx`](../../apps/field-app/src/main.tsx). It:

- Imports Tailwind and Enact theme layers (`@enact-ui/react/styles/theme.css`, `typography.css`, `liquid-glass.css`).
- Registers Tailwind plugins (`@tailwindcss/typography`, `tailwindcss-react-aria-components`, `tailwindcss-animate`).
- Imports OverlayScrollbars base styles where needed.

**`@source` and pnpm:** `pnpm` installs `file:` packages in a way that typically exposes only published artifacts (for example `dist/`), not `src/`. Tailwind’s content scan therefore needs **`@source` paths that point at your local `enact-ui` checkout** (not `node_modules/.../src`), so utility classes used inside Enact UI sources are generated. Those paths are relative to `src/index.css` and mirror the same folder relationship as the `file:` dependencies.

Browser-specific tweaks (for example scroll behavior) differ from the enact-desktop shell; Tauri-only rules are not copied.

## Vite configuration

[`apps/field-app/vite.config.ts`](../../apps/field-app/vite.config.ts) registers:

- `TanStackRouterVite()`, `@vitejs/plugin-react`, and `tailwindcss()` from `@tailwindcss/vite`.
- **`server.proxy`** for `/v1` and `/uploads` to the local API (see above).
- **`server.host: true`** and **`allowedHosts: true`** so LAN/Tailscale/ngrok hosts work.
- A **`resolve.alias`** mapping `@enact-ui/react/styles` to `node_modules/@enact-ui/react/dist/styles`, so CSS `@import` resolution matches how the package exports styles (same idea as enact-desktop).

## Where UI code lives

| Location | Responsibility |
| -------- | ---------------- |
| [`apps/field-app/src/routes/`](../../apps/field-app/src/routes/) | Route components; compose pages from `@enact-ui/react`, shared shell, and supervisor primitives. Root route is thin (`__root.tsx` → shell layout). |
| [`apps/field-app/src/components/shell/`](../../apps/field-app/src/components/shell/) | App chrome: sidebar, mobile header, bottom navigation, project selectors. See [Web app structure](./web-app-structure.md). |
| [`apps/field-app/src/components/supervisor/`](../../apps/field-app/src/components/supervisor/) | Reusable supervisor patterns (headers, list chrome, entity cards, empty/error states); barrel at [`supervisor-ui.tsx`](../../apps/field-app/src/components/supervisor-ui.tsx). |
| [`apps/field-app/src/lib/navigation.ts`](../../apps/field-app/src/lib/navigation.ts) | Nav item definitions and active-route helpers for the shell. |
| [`apps/field-app/src/main.tsx`](../../apps/field-app/src/main.tsx) | Providers (`QueryClient`, router), `import "./index.css"`. |

See [Web app structure](./web-app-structure.md) for the full map.

## Local development

1. Ensure the **`enact-ui`** checkout is built where needed (`dist/` present for packages you import).
2. From the repo root: `pnpm install` (pick up `file:` links and overrides).
3. Run the web app: `pnpm --filter @v2e/field-app dev` (or `turbo run dev` per your workflow).

When you change **Enact UI** source, rebuild or use that package’s watch script if you consume `dist/` bundles; HMR behavior depends on how the linked package is built.

## Reference implementation

For parity with a shipping app that uses the same stack, compare:

- **Dependencies and overrides:** `enya/enact-desktop/package.json` (paths to `enact-ui` are relative to that repo, not V2E).
- **Vite + Tailwind:** `enya/enact-desktop/vite.config.ts`.
- **Global CSS:** `enya/enact-desktop/src/index.css` (adapt for browser vs Tauri).

## Related docs

- [Mobile strategy](../mobile/mobile-strategy.md) — Capacitor wraps this same web app; the UI stack described here applies to mobile targets as well.
