---
last_changes: "Frontmatter refresh (pre-commit last_updated window)."
last_updated: "2026-03-27T03:56:00Z"
---

# ADR 0001: Use ADRs for cross-cutting architecture decisions

Date: 2026-03-27  
Status: Accepted

## Context

The monorepo now has multiple surfaces (field app, planning web, marketing site) and shared packages. Informal decisions in chat or single PRs are easy to lose, which increases rework and inconsistent implementations.

## Decision

We adopt **Architecture Decision Records** in `docs/architecture/adr/` for decisions that span teams or packages, are expensive to undo, or need a written rationale. Routine changes do not require an ADR.

## Consequences

- Contributors have a **single place** to look for “why we did X.”
- Slightly more process: authors of cross-cutting changes should consider whether an ADR is warranted before merge.
- ADRs are **not** a substitute for `AGENTS.md`, `REPO-INVARIANTS.md`, or validation docs; they complement them.
