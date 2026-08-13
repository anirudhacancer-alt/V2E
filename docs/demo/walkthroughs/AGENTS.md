# Demo scripts

Two deterministic walkthroughs for stakeholders, aligned with [docs/field-app/AGENTS.md](../../field-app/AGENTS.md) and demo bundles under [docs/demo/datasets/AGENTS.md](../datasets/AGENTS.md).

| Demo | Contract | Script | Theme |
|------|----------|--------|-------|
| Voice update → action | `1328` | [voice-update-to-action-contract-1328.md](./voice-update-to-action-contract-1328.md) | Transcript → AI review → task board traceability |
| Daily standup and risk | `1330` | [daily-standup-risk-contract-1330.md](./daily-standup-risk-contract-1330.md) | Standup attendance, blockers, tasks, risk context |

## Preconditions

- Data path: `docs/demo/datasets/RES-1328/` for contract `1328`, `docs/demo/datasets/COM-1330/` for contract `1330`
- Optional: run validation (see [data-contract-validator-crosscheck.md](../data-contract-validator-crosscheck.md))
- Optional: reseed relative to today with `pnpm --filter @v2e/database db:seed` (or pin a demo day with `--anchor-date YYYY-MM-DD`)
- App: when the UI exists, use **project/contract switcher** scoped to the bundle’s `projectId`

## Related docs

- [docs/demo/review/readiness-report.md](../review/readiness-report.md) — overall demo readiness
- [docs/common/plans/phase-plans-AGENTS.md](../../common/plans/phase-plans-AGENTS.md) — MVP narrative and current audit status
