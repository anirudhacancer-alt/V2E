# Voice-to-Execution: Remaining Work Spec

This document is the trimmed down canonical reference for **missing, partial, or deferred** implementation work, preserving essential architectural context.

> [!NOTE]
> Detailed entity schemas and established invariants are documented in `docs/data-model/` and `docs/architecture/`.

---

# 9. Recommended error codes

Mutations and complex commands should return these codes for predictable client error handling:

* ✅ `PROJECT_SCOPE_MISMATCH`
* ✅ `DEPENDENCY_CYCLE_DETECTED`
* ✅ `DEPENDENCY_INVALID_EDGE`
* ✅ `COMMITMENT_INVALID_STATE_TRANSITION`
* ✅ `DEPENDENCY_OVERRIDE_REQUIRES_REASON`

---

# 10. Auth, headers, and request context

Pilot status: **🟡** Bearer required for mutations; **⏸️** full auth-service integration and `/v1/me` surface deferred.

## 10.1 Required / Recommended Headers

* 🟡 `Authorization: Bearer <token>`
* 🟡 `traceparent: <value>`
* 🟡 `Idempotency-Key: <uuid>`

## 10.2 Server-resolved request context
Do not trust `X-User-Id` or `X-Project-Id` from public clients. Every request must resolve:
* ⏸️ `actorUserId`, `tenantId`, `roleBindings`, `allowedSiteIds`, `allowedProjectIds`

---

# 11. API shape

* 🟡 flat entity endpoints for direct entity access
* 🟡 project-scoped collection endpoints where scope matters semantically
* 🟡 explicit command endpoints for imperative actions (ADR-0011)

---

# 12. Canonical Route & Feature Gaps

Implementation status for the pilot `apps/api` (demo SQLite).

| Symbol | Meaning |
|--------|---------|
| 🟡 | Partial (missing filters, different segment, or limited logic) |
| ❌ | Not implemented |
| ⏸️ | Deferred (out of scope until auth lands) |

## 12.7 Team members
Filters:
* ✅ `userId`

## 12.10 Update extraction (nested under updates)
```http
✅ GET    /v1/updates/:updateId/extraction
✅ PATCH  /v1/updates/:updateId/extraction
```
Filters:
* ✅ `reviewStatus` (on nested extraction resource where applicable)

## 12.12 Tasks
Filters:
* ✅ `severity`
* ✅ `ownerId`
* **`status` semantics:** UI state strings (**`In-progress`**, **`Blocked`**, etc.) are resolved via `deriveSupervisorTaskState`, not direct DB status match.

## 12.23 Audit events
Filters:
* ✅ `siteId`
* ✅ `actor`

---

# 14-16. UI and Feature Gaps

## 14. Persistence Gaps
* 🟡 Richer technical review persistence (currently primarily read-model + commands)

## 15. Read-models
* 🟡 Commitment list grouping (`Today` / `This Week` / `Look-ahead`)

## 16. UI Upgrade Path
* 🟡 **Field App:** `Today`, `This Week`, `Look-ahead` views; commitment cards; quick “commit to today”.
* 🟡 **Planning Console:** Dependency badges/indicators; dependency editor; commitment board/list; reliability dashboard.
* 🟡 **Track:** Commitment reliability, WIP aging, dependency-blocked trend.
* 🟡 **Technical Review:** Review queue persistence; ❌ Drawing/spec-linked review; approve/rework with reason; dependency-aware due date control.

---

# 17. Notifications subsystem

**Status:** 🟡 Database and basic API implemented; outbox-to-in-app worker ready (`OUTBOX_WORKER_ENABLED=1`); ❌ email/push/SMS adapters not wired.

## 17.4 Event types to emit now
* 🟡 `update.*`, `task.created/blocked`, `commitment.created`, `dependency.override`, `standup.*`, `improvement_action.created`
* ❌ `task.assigned`, `task.overdue`, `commitment.missed`

---

# 19-22. Strategy and Architecture

## 19. Success metrics

## Primary
* ✅ `commitment reliability` (Implemented in `/execution-reliability`)
* 🟡 `blocker mean time to resolve` (Partial: `averageCycleTimeDays` exists; direct MTTR for blockers TBD)
* ✅ `dependency-blocked task aging` (Implemented via `blockedTaskAging` + `dependencyHealth`)
* 🟡 `standup-to-closure conversion` (Partial: stats by status exist; conversion rate logic TBD)

## Secondary
* ❌ `reopened task rate` (Not implemented in metrics API)
* ❌ `repeated issue rate` (Not implemented in metrics API)
* 🟡 `improvement action effectiveness` (Partial: summary stats exist; effectiveness analysis TBD)

---

# 20. Immediate implementation order

## Phase B
* 🟡 planning UI badges and grouped commitments

## Phase D
* 🟡 notifications subsystem (tables + API routes implemented; optional outbox worker for in-app delivery)
* 🟡 outbox/event delivery (table + enqueue + worker; email/push not wired)

---

## 21. Principles
* 🟡 make reliability visible in every surface

## 22. Final architecture stance
* 🟡 Layer 1 — Reality capture (Update, AI extraction)
* 🟡 Layer 2 — Execution control (Task, Commitment, StandupSession, Dependencies)
* 🟡 Layer 3 — Improvement loop (ImprovementAction, Reliability Metrics)
* 🟡 Layer 4 — System services (Audit, Notifications, Outbox, Analytics)

---

**Next Steps: Finalize OpenAPI endpoint map with request/response schemas for pending endpoints.**
