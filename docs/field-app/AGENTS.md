# Field web app — page specifications

This folder defines the **field app web** surface (desktop / large responsive) for the MVP: what should render, how it should render, and which dataset fields power each section. Route files live under `apps/field-app/src/routes/supervisor/` (legacy segment name). Phone and tablet deltas belong in [`docs/mobile/`](../mobile/AGENTS.md) and [`docs/ipad/`](../ipad/AGENTS.md).

**Surface-specific planning / tracking:** [`plans/AGENTS.md`](plans/AGENTS.md).

## App map (screens)

```
                    ┌─────────────┐
                    │ Home (KPIs) │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Task Board │  │  Standup   │  │  Profile   │
    │ (columns +│  │  (daily)   │  │ + Settings│
    │ slide-over)│  └────────────┘  └────────────┘
    └──────┬─────┘
           │
    ┌──────┴──────────────────────────────────────┐
    │  (+) Record update                          │
    └──────┬──────────────────────────────────────┘
           ▼
    ┌──────────────┐      ┌─────────────────────┐
    │ Transcript   │ ──►  │ AI extraction review │
    │ review       │      │ (task or save)       │
    └──────────────┘      └─────────────────────┘
```

Tab bar (typical): `Home` · `Board` · `(+)` · `Standup` · `Me`. Transcript and AI screens are **stacked detail flows** (back navigation) from the recording / update pipeline.

## Contract Context

- Primary demo contract: `1328`
- Secondary demo contract: `1330`
- Data source root: `docs/demo/datasets/RES-1328/` for contract `1328`, `docs/demo/datasets/COM-1330/` for contract `1330`
- Data model note: multiple projects can belong to one site (`projects.csv` links to `sites.csv`).
- Updates and tasks: [update.md](../data-model/update.md) (**Updates ↔ tasks (canonical)**).

## Architecture and design references

| Document | Role |
| -------- | ---- |
| [web-app-structure.md](web-app-structure.md) | Shell, field-app modules, navigation |
| [web-ui-enact-ui.md](web-ui-enact-ui.md) | Enact UI consumption, Vite, TanStack Router, proxies |
| [ENACT-UI-DESIGN-SYSTEM.md](ENACT-UI-DESIGN-SYSTEM.md) | Tokens and composition for this product |
| [field-app-ui-invariants.md](field-app-ui-invariants.md) | Structural guardrails for field-app routes (`supervisor/` segment) |
| [field-app-ui-material-update.md](field-app-ui-material-update.md) | Material update notes |
| [standup-prep-from-tasks.md](standup-prep-from-tasks.md) | Standup prep read model from `tasks` |

## Page List

1. `home-dashboard.md`
2. `task-board.md`
3. `record-update.md`
4. `transcript-review.md`
5. `ai-extraction-review.md`
6. `standup.md`
7. `profile-settings.md`

## Rendering Rules

- Use contract schema enums only for status, severity, role, trade, and category chips.
- Always scope views by `projectId` inside a selected `siteId` context.
- Keep mobile first layout as default.
- Show empty states with clear next actions.
- Never show raw CSV column names in UI labels.
- Support evidence media consistently across flows: `Image`, `Audio`, `Video`, `Document`.
