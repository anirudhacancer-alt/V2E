# Field app UI Material Update

**Former filename:** `SUPERVISOR_UI_MATERIAL_UPDATE.md` (renamed to match field-app terminology).

Date: 2026-03-26
Scope: Field app web experience (`apps/field-app`) visual system refresh for iPhone-like material depth with restrained industrial styling.

## Goals

- Replace flat, equally-opaque surfaces with layered material hierarchy.
- Introduce frosted/translucent navigation and sticky header treatment.
- Improve soft elevation, hairlines, and corner consistency across shared primitives.
- Add subtle spring-like interaction feedback.
- Tune dark mode specifically (not only token inversion).

## Material System Added

The following reusable CSS material classes were added to `apps/field-app/src/index.css`:

- `supervisor-material-page`
- `supervisor-material-card`
- `supervisor-material-card-quiet`
- `supervisor-material-frost`
- `supervisor-material-tabbar`
- `supervisor-material-pill`
- `supervisor-material-pill-active`
- `supervisor-material-fab`
- `supervisor-material-interactive`

### Material Behavior

- **Page Atmosphere**: subtle radial + vertical gradients for tonal depth.
- **Cards**: translucent raised surfaces with inner highlight + broad soft shadow.
- **Frosted Surfaces**: blur + saturate + hairline for sticky header and tab bar.
- **Pills/Controls**: softer border/hairline hierarchy, tactile active state.
- **FAB/Mic**: elevated halo and controlled teal glow.
- **Motion**: micro spring press (`scale(0.98)`) with reduced-motion fallback.

## Dark Mode Additions

Dark mode was explicitly tuned in `apps/field-app/src/index.css`:

- Charcoal atmospheric base for `supervisor-material-page` (less navy-heavy).
- Deeper separation between base/grouped/card surfaces.
- Stronger but soft shadow stack in dark card/frost/tabbar materials.
- Dark-specific `supervisor-material-card-quiet` treatment.
- Dark-specific teal glow adjustments for active pills and FAB.
- Dark-friendly hero gradient refinements for the home attention card.

## Shared Primitive Updates

These shared components were updated to consume the new material classes:

- `apps/field-app/src/lib/supervisor-layout.ts`
  - page canvas now uses `supervisor-material-page`
  - sticky headers now include `supervisor-material-frost`
- `apps/field-app/src/components/shell/mobile-bottom-nav.tsx`
  - frosted tab bar material
  - active icon lift
  - FAB halo/elevation material
- `apps/field-app/src/components/supervisor/section-card.tsx`
- `apps/field-app/src/components/supervisor/entity-card.tsx`
- `apps/field-app/src/components/supervisor/quick-action-pill-card.tsx`
- `apps/field-app/src/components/supervisor/supervisor-secondary-button.tsx`
- `apps/field-app/src/components/supervisor/supervisor-cta-button.tsx`
- `apps/field-app/src/components/supervisor/collapsible-section.tsx`
- `apps/field-app/src/components/supervisor/compact-list-header.tsx`
- `apps/field-app/src/components/supervisor/list-page-header.tsx`
- `apps/field-app/src/components/supervisor/page-states.tsx`

## Route-Level Updates

- `apps/field-app/src/routes/supervisor/home.tsx`
  - materialized card shells for key sections
  - materialized project selector control
  - improved activity row interaction treatment
  - dark mode gradient and quiet-strip adjustments for attention card

## Resulting Visual Direction

The updated style targets an **industrial iPhone** direction:

- neutral, construction-app-appropriate base
- restrained teal accent behavior
- premium but subtle depth and translucency
- high legibility with less decorative gloss
- lightweight micro-motion over playful animation

## Notes and Follow-Up

- Existing lint diagnostics in `index.css` include browser-compatibility and tooling warnings related to `color-mix`, scrollbar properties, and Tailwind-aware lint parsing; these were preexisting patterns in the styling approach and not treated as blockers for this visual pass.
- Recommended next consistency pass:
  - `apps/field-app/src/routes/supervisor/updates.tsx`
  - `apps/field-app/src/routes/supervisor/record.tsx`
  - `apps/field-app/src/routes/supervisor/$updateId.review.tsx`
  - `apps/field-app/src/routes/supervisor/$updateId.extraction.tsx`

## What Was Done (Implementation Notes)

This pass focused on shared primitives and the theme-level material layer first, then lightly wired those materials into route-level screens.

### 1) Theme / Material Layer Rewrite (`apps/field-app/src/index.css`)

Added reusable material classes:

- `supervisor-material-page` (atmospheric page gradients)
- `supervisor-material-card`, `supervisor-material-card-quiet` (layered card surfaces)
- `supervisor-material-frost`, `supervisor-material-tabbar` (frosted sticky/header/nav surfaces)
- `supervisor-material-pill`, `supervisor-material-pill-active` (control hierarchy + active state)
- `supervisor-material-fab` (mic/FAB depth + glow)
- `supervisor-material-interactive` (micro spring press behavior with reduced-motion support)

### 2) Shared Component Wiring

Applied these classes to shared shells/components so changes propagate consistently:

- layout/header (`supervisor-layout.ts`)
- mobile bottom nav (`mobile-bottom-nav.tsx`)
- shared field-app cards/buttons/headers/collapsible sections (`components/supervisor/`)

### 3) Route-Level Integration

Primarily updated `home.tsx` to consume the material primitives:

- hero/attention card treatment
- project selector material style
- recent-feed card and row interaction updates
- dark-specific hero gradient tuning

### 4) Dark Mode Tuning (Not Only Token Inversion)

Added dedicated `.dark-mode` variants for material classes:

- charcoal atmospheric background (less navy-heavy)
- clearer depth separation between base/grouped/card levels
- stronger but soft shadow stacks for dark cards/frost/tabbar
- dark-specific pill and FAB glow balancing

## Visual Glossary

- **Inner highlight / inset hairline**: the subtle line visible along the top inside edge of cards/controls; implemented via `inset 0 1px 0 ...`.
- **Hairline border**: a very soft, low-contrast 1px border used for edge definition without heavy outlines.
- **Frosted surface**: translucent layer with blur + saturation that lets background tone influence the foreground panel.
- **Ambient shadow**: broad, low-opacity shadow used to imply soft elevation rather than hard separation.
- **Halo**: soft outer glow around active accent elements (for example, the record FAB) to improve focus and hierarchy.

