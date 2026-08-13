# iPad / tablet — surface plans

**Tablet-specific** planning: split view, density, and layout milestones that extend [`docs/field-app/`](../../field-app/AGENTS.md) defaults.

## Critical UI implementation rule

- Use Enact UI as the foundation, but build reusable execution-surface components in `apps/field-app/src/components`.
- This is required so tablet and phone/web execution surfaces can share a V2E-owned theme overlay and avoid divergence.

| Plan / note | Purpose |
|-------------|---------|
| _(add markdown files here)_ | |

## Reminder

- For tablet plans, any reusable UI pattern should be proposed/implemented in `apps/field-app/src/components` first, then composed into screen layouts.

Parent: [`../AGENTS.md`](../AGENTS.md).
