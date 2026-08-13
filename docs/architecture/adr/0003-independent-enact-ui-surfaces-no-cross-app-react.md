---
last_changes: "Cross-links: docs/web → docs/field-app."
last_updated: "2026-03-27T15:32:00Z"
---

# ADR 0003: Independent Enact UI surfaces — no cross-app React components

Date: 2026-03-27  
Status: Accepted

## Context

The platform has three frontend surfaces: **Field App** (including **mobile** via Capacitor), **Planning Console**, and **Marketing Site**. All are intended to use **Enact UI** (`@enact-ui/*`) for accessible primitives and design tokens.

We need **clear visual and structural independence** between execution (field/mobile), planning, and marketing so each team can evolve layout, density, and brand expression without coupling to another surface’s component tree. Sharing app-level React components across those boundaries would create churn, accidental coupling, and unclear ownership.

## Decision

1. **Field App + mobile:** `apps/field-app` and `apps/mobile` (Capacitor wrapping the field-app build) share **one** execution UI: shared routes, shell, field-app UI (`components/supervisor/*`), and Enact UI usage (semantic surfaces/tokens).
2. **Planning and marketing:** `apps/planning-web` and `apps/marketing-site` each consume `@enact-ui/*` with its **own** global CSS entry, Tailwind `@source` wiring, and theme/flavour. They **must not** import React components, hooks, or app-local modules from `apps/field-app`, from `apps/mobile`, or from the other marketing/planning app. Planning and marketing **do not** share app-level components with each other.
3. **Shared layers:** `@v2e/contracts`, API clients typed from contracts, and other non-UI packages remain shared. **Enact UI** packages are the only intentional shared **UI primitive** layer across surfaces.
4. Introducing a monorepo package whose purpose is **shared product UI** across field, planning, and marketing (e.g. a `packages/ui-system` that re-exports composed screens) requires a **future ADR** and explicit approval.

## Consequences

- **Positive:** Independent design velocity per surface; fewer merge conflicts; clearer boundaries for code review (“this belongs in field-app only”).
- **Trade-off:** Some duplication of patterns (e.g. similar list headers) may appear across apps; prefer **copy** over **premature abstraction** across boundaries. Duplication inside a single app (e.g. within `field-app`) is still subject to normal refactoring.
- **Operational:** The rule is also stated in [`docs/architecture/REPO-INVARIANTS.md`](../REPO-INVARIANTS.md) and [`docs/field-app/web-ui-enact-ui.md`](../../field-app/web-ui-enact-ui.md#independent-surface-uis-locked).
