# Data invariants (`docs/data-model/invariants/`)

**Scope:** Short, durable **product/data rules** that are not full ADRs: demo/import normalization (PM-style → app shapes), queue vs task execution semantics, and related workflow invariants.

## Entry points

| Document | Role |
|----------|--------|
| [data-normalization-invariants.md](data-normalization-invariants.md) | Task status, locations, owner/role mapping for PM-style → app data |
| [updates-tasks-workflow-invariants.md](updates-tasks-workflow-invariants.md) | Update queue state vs task lifecycle; review triggers; UI/API alignment |
| [data-integrity-and-validation-invariants.md](data-integrity-and-validation-invariants.md) | Runtime `DATA_INTEGRITY` (500) vs AI extraction validation (422); error semantics |

Parent: [../AGENTS.md](../AGENTS.md).
