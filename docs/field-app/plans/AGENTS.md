# Field app — surface plans

Work-in-progress and **field-app-specific** planning (milestones, UX experiments, backlog) that complements shared phase docs in [`docs/common/`](../../common/AGENTS.md).

Page-level specs stay at the parent level (e.g. `../home-dashboard.md`). Put **planning** and **tracking** notes here so teams can see what is active without mixing with shared `docs/common/` phase plans.

## Critical UI implementation rule

- Use Enact UI primitives, but implement shared app-level UI components in `apps/field-app/src/components`.
- This reusable layer is required so V2E can apply and evolve a project-specific theme overlay on top of Enact UI without route-by-route rewrites.

| Plan / note | Purpose |
|-------------|---------|
| _(add markdown files here)_ | |

## Reminder

- For field app web implementation, prioritize reusable components in `apps/field-app/src/components` over page-local duplication.

Parent: [`../AGENTS.md`](../AGENTS.md).
