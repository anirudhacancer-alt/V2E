---
last_changes: "Frontmatter refresh (pre-commit last_updated window)."
last_updated: "2026-03-27T03:56:00Z"
---

# ADR 0007: Queue-based field-app updates (target IA)

Date: 2026-03-27  
Status: Accepted (principle); partial implementation

## Context

Execution leads should act on **queues** (“what needs attention?”), not raw persistence enums. The Updates screen historically exposed filters tied to backend statuses (`Pending`, `ConvertedToTask`, …), which obscures the intended **Review / Linked / Escalated / Blocked** mental model.

## Decision

1. **Page roles**
   - **Home:** Triage entry — counts and deep links; not the full list.
   - **Updates:** Signal intake — **queue buckets** for execution-lead judgment.
   - **Tasks:** Execution tracking — lifecycle filters (`Active`, `Blocked`, `Overdue`, …).

2. **Queue buckets (product targets)**  
   Buckets are **not** raw `updates.status` enum labels alone; they combine status, AI output flags, and linkage:
   - **Review:** Needs execution-lead confirmation (extraction, low confidence, proposed task, etc.).
   - **Linked:** Human follow-up on an **existing** task (`updates.linkedTaskId` set, with `deriveNoteState` / API `noteState` semantics — see `docs/data-model/update.md`).
   - **Escalated:** Explicit escalation (`Escalated` or equivalent product path).
   - **Blocked:** Blocker category and/or linked blocked execution work.

3. **Server-side bucketing**  
   Prefer **explicit** query parameters or dedicated endpoints (e.g. `?queue=review|escalated|blocked` or a small summary endpoint) so Home and Updates **cannot drift** from different client-side reconstruction.

4. **Homepage metrics**  
   Dashboard counts should align with the same queue definitions as the Updates list.

## Consequences

- Until the API exposes unified `queue` params, the UI may still filter by `status` — document any gap in `docs/api/routes/projects.md` (updates list) when implemented.
- **Linked** vs **Review** remains governed by the canonical note-state rules in **`docs/data-model/update.md`** (**Updates ↔ tasks (canonical)**).

## Related

- `docs/data-model/invariants/updates-tasks-workflow-invariants.md`
- `docs/api/routes/projects.md`
