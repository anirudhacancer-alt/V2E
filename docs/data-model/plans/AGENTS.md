# Data model plans (`docs/data-model/plans/`)

**Scope:** This folder contains execution-phase planning docs for data-model evolution work. These are implementation trackers (ordering, dependencies, parallel lanes), not long-form product strategy docs.

## Rules for this folder

- Keep plan docs execution-focused and concise.
- Keep strategy intent in:
  - `docs/strategy/AGILE-EXECUTION-DATA-MODEL.md`
  - `docs/strategy/PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md`
  - `docs/strategy/WORKSTREAM-DOCS-FRAMEWORK.md`
- Treat `NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md` as the canonical route-correction reference for this folder.
- Call out sequential dependencies and parallelizable tracks explicitly in each phase file.
- Do not weaken existing validation/integrity rules without explicit approval in the current chat.
- Every phase must include a full data-model documentation sweep across invariants, entity docs, ERD, and index.
- If any risk or behavior delta is not fully accounted for, update root `ISSUES.md` in the same phase PR.

## Navigate

| File | Role |
|------|------|
| `DATA-MODEL-REFACTOR-GOAL.md` | Execution index and phase dependency map |
| `NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md` | Canonical route inventory and target model reference |
| `ISSUES.md` (repo root) | Mandatory cross-team breakage/risk register for unresolved or deferred behavior changes |
| `route-diff-checklist.md` | Reusable route inventory reconciliation checklist per phase/PR |
| `phase-A-contracts-and-read-models.md` | Contract freeze + read-model rollout |
| `phase-B-persisted-commitments-and-dependencies.md` | Persisted write model for commitments/dependencies |
| `phase-C-technical-review-and-improvements.md` | Technical review workflow + improvement loop |
| `phase-D-standup-session-persistence-and-notifications.md` | Optional persistence and event-driven notifications |
| `phase-E-platform-entity-routes.md` | Flat platform entity routes §12.2–12.7 (excludes auth / `/me`) |
| `phase-F-flat-updates-and-tasks.md` | Flat updates, tasks, update commands §12.8, 12.11, 12.12 |
| `phase-G-attachments-and-files.md` | Attachments, AI output resources, `/v1/files` §12.9–12.10, 12.13, 12.24 |
| `phase-H-audit-read-and-route-integrity.md` | Audit reads, technical review queue integrity, metrics dedupe §12.23, 12.25 |

## Local conventions

- Use additive rollout language (`read-first`, `persist-next`, `optional-later`).
- Prefer stable canonical entity names (`Commitment`, `TaskDependency`, `ImprovementAction`, `WorkCycle`, `StandupSession`).
- Keep each phase doc independently actionable with:
  - goal
  - in scope
  - sequential tasks
  - parallel tasks
  - exit criteria
- Ensure each phase explicitly states route correction and docs sync requirements for its scope.
- Ensure each phase includes concrete checklists for route diff, Vitest API unit tests, and seed-script refactor work.
- Ensure each phase includes explicit documentation-update checklist items for the mandatory docs set.

Parent: [`docs/data-model/AGENTS.md`](../AGENTS.md)  
Root docs guidance: [`docs/AGENTS.md`](../../AGENTS.md)
