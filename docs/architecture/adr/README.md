---
last_changes: "ADR index: queue-based field-app updates (align with 0007 title)."
last_updated: "2026-03-27T03:58:00Z"
---

# Architecture Decision Records (ADR)

This folder records **significant, stable decisions** about the V2E codebase and platform (not every small implementation detail).

## When to add an ADR

Add a new numbered ADR when a decision:

- affects multiple teams or packages,
- is costly to reverse,
- or needs a durable rationale beyond a PR description.

Skip an ADR for routine refactors, one-off bug fixes, or purely local changes.

## Naming

Use sequential numbers and kebab-case titles:

`NNNN-short-title.md`

Example: `0002-playwright-webkit-only-e2e.md`

## Template

Each ADR should include:

1. **Status** — Proposed | Accepted | Superseded | Deprecated
2. **Context** — What problem or constraint triggered the decision?
3. **Decision** — What we chose (one or two paragraphs).
4. **Consequences** — Trade-offs, follow-up work, and what is out of scope.

## Index

| ADR | Title |
| --- | ----- |
| [0001](0001-use-adrs-for-cross-cutting-decisions.md) | Use ADRs for cross-cutting architecture decisions |
| [0002](0002-end-to-end-tests-webkit-only.md) | End-to-end tests use WebKit only |
| [0003](0003-independent-enact-ui-surfaces-no-cross-app-react.md) | Independent Enact UI surfaces — no cross-app React components |
| [0004](0004-monorepo-package-structure.md) | Monorepo package structure |
| [0005](0005-bearer-token-authentication-pattern.md) | Bearer token authentication pattern (pilot API) |
| [0006](0006-ai-extraction-and-review-workflow.md) | AI extraction and review workflow |
| [0007](0007-queue-based-update-filtering.md) | Queue-based field-app updates (target IA) |

## Relationship to other docs

- **Repo-wide rules and automation** live in [`../REPO-INVARIANTS.md`](../REPO-INVARIANTS.md) and `AGENTS.md`.
- **Product / IA** decisions remain in `docs/strategy/` as appropriate.
