# Mobile (phone) — surface plans

**Phone-specific** planning: navigation experiments, touch targets, offline notes, and milestones that are not yet in shared [`docs/common/`](../../common/AGENTS.md) phase docs.

## Critical UI implementation rule

- Use Enact UI as the base system, but implement common/reusable app UI components under `apps/field-app/src/components`.
- This is mandatory to keep a project-owned UI layer that can apply a V2E theme overlay on top of Enact UI.

| Plan / note | Purpose |
|-------------|---------|
| _(add markdown files here)_ | |

## Reminder

- For mobile execution UI work, do not build one-off screen-local primitives when they are reusable; place them in `apps/field-app/src/components` first, then consume them in routes/screens.

Parent: [`../AGENTS.md`](../AGENTS.md).
