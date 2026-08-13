# Issues Register

Date: 2026-03-27
Status: Active cross-team register

## Purpose

Track known or suspected breakage, behavior drift, migration risk, compatibility gaps, and cross-team blockers that are not fully handled in current scope.

This is a repo-wide register and must be updated by every team when unresolved risk exists.

## Update Rule

- If no unresolved risk exists for a phase/workstream, add a dated note: `No known unaccounted breakage for <scope>.`
- If unresolved risk exists, add one row per risk with owner and target timeline.
- When resolved, update status and add the PR/reference that closed it.

## Register

| Date | Scope | Area | Risk / potential breakage | Impact | Owner | Mitigation plan | Target resolution | Status | Resolution reference |
|------|-------|------|---------------------------|--------|-------|-----------------|-------------------|--------|----------------------|
| 2026-03-27 | Data model planning baseline | Planning setup | No known unaccounted breakage at planning split time. | Low | TBD | Keep this register updated per phase/workstream PR. | Ongoing | Open | TBD |
| 2026-03-27 | Phase A - Contracts and Read Models | API / Contracts | No known unaccounted breakage for Phase A. Read-model endpoints derive from existing task data; no new persistence or migrations. | Low | Platform | Contracts added (`commitment.ts`, `dependency.ts`, `improvement.ts`, `cycle.ts`, `member.ts`, `role.ts`). Route docs updated. | Complete | Closed | Phase A implementation |
| 2026-03-27 | Phase C - Improvement Actions | Seed Scripts | No known unaccounted breakage for Phase C seed generation. Improvement actions seeded with full lifecycle states and linked entities. | Low | Platform | Seed scripts generate 3-5 improvement actions per project with category/status distribution. | Complete | Closed | Seed script update |
| 2026-03-27 | Phase D - Standup Sessions & Notifications | Seed Scripts | No known unaccounted breakage for Phase D seed generation. Standup sessions and notifications seeded for demo users. | Low | Platform | Seed scripts generate 2-3 standup sessions per project and 2-4 notifications per user. | Complete | Closed | Seed script update |
| 2026-03-27 | Phase H - Audit read and route integrity | API / routes | No known unaccounted breakage for Phase H. Audit list/detail are read-only; technical review queue canonical handler is `projects.ts`; duplicate GET removed from `phase-c.ts`. | Low | Platform | Vitest for audit filters + dependency summaries; seed stub removed; docs aligned. | Complete | Closed | Phase H implementation |
| 2026-03-27 | DB schema spec alignment (`0020_spec_alignment_update_task_columns`) | Database | Adds `updates.sourceType`, `updates.needsReview`, `tasks.kind`, `tasks.reporterTeamMemberId` for future §12 list filters. `drizzle-kit push` may fail on existing demo DBs (`index ... already exists`); `db:seed` uses `migrate` and applies migrations cleanly. Smart seed validation can drift by calendar day; use `--anchor-date` if `db:seed` fails validation. | Low | Platform | Prefer `migrate` / `db:seed` over raw `push` for local DB | Ongoing | Open | TBD |
| 2026-03-27 | Migration `0021_projects_type_status_outbox` | Database / API | Adds `projects.type`, `projects.status`, and `outbox_events`; audit writes enqueue outbox rows; optional worker (`OUTBOX_WORKER_ENABLED=1`) delivers in-app notifications only when `payload.notifyUserId` resolves to `users.id`. Email/push/out-of-band channels remain unimplemented. | Low | Platform | Run `pnpm --filter @v2e/database db:push` (or migrate) after pull; set `notifyUserId` in audit payloads when product wants user-targeted notifications. | Ongoing | Open | TBD |
| 2026-03-27 | Canonical route alignment, notification fanout, and audit event coverage | API / Database / Contracts | No known unaccounted breakage for this slice. Team-member `userId`, AI-output row IDs + `reviewStatus`, task/audit filter canonicalization, user-scoped notifications, queued email/push fanout, and new audit event types landed together with schema, seed, route, and doc updates. | Low | Platform | Validate with `pnpm typecheck`, targeted Vitest, and local DB migrate/seed after pull. | Complete | Closed | This implementation |
| 2026-03-27 | Route structure invariant enforcement | API / routes / docs | New `check:route-structure-invariant` hook blocks provable ADR 0011 source violations, but current inventory audit still reports drift between `ROUTE-INVENTORY.md` and implementations. Known examples include update AI action routes (`/v1/updates/:id/*`), standup AI summaries, attendance routes, and several PATCH rows that still document `projectId` body semantics inconsistently. | Medium | Platform | Keep source enforcement blocking in pre-commit; align inventory and per-route docs, then decide whether to turn on `--strict-inventory` in CI/pre-commit. | 2026-03-29 | Open | TBD |

## Phase Status Summary

### Phase A - Contracts and Read Models (2026-03-27)

**Status:** Complete

**Deliverables:**

- Contracts: `Commitment`, `Dependency`, `Improvement`, `Cycle` schemas in `packages/contracts/src/`
- Read endpoints: `GET /v1/projects/:projectId/commitments`, `GET /v1/projects/:projectId/tasks/:taskId/dependencies`, `GET /v1/reviews?projectId=...` (technical review queue)
- Route documentation: Updated `docs/api/routes/projects.md` and `docs/api/routes/tasks.md`
- Route alignment: Verified against `NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md`

**Risk assessment:** No known unaccounted breakage for Phase A.

- Read-model endpoints return derived data from existing tasks table
- No new database tables or migrations in this phase
- Read-model contract names align with `dependency.ts`, `improvement.ts`, `cycle.ts`
- UI consumers can compile against new read schemas

---

### Phase B - Persisted Commitments and Dependencies (2026-03-27)

**Status:** In Progress

**Deliverables:**

- Database: `work_cycles`, `commitments`, `task_dependencies` tables in `packages/database/src/schema.ts`
- Migrations: Added via Drizzle
- Write endpoints:
  - `POST /v1/cycles`, `GET/PATCH /v1/cycles/:id`
  - `POST /v1/projects/:projectId/commitments`, `GET/PATCH /v1/commitments/:id`
  - `POST/DELETE /v1/projects/:projectId/tasks/:taskId/dependencies`
  - `GET/PATCH /v1/dependencies/:id`, `POST /v1/dependencies`
- Seed scripts: Updated to generate work cycles, commitments, and task dependencies
- Documentation: Updated `docs/api/routes/`, `docs/data-model/`, route-diff checklist

**Risk assessment:** No known unaccounted breakage for Phase B.

- Persisted entities follow project-scope integrity invariants
- Cycle detection prevents invalid dependency graphs
- Seed validation ensures no broken references or cycles
- Additive changes (no breaking changes to existing schemas)

**Remaining work:**

- [ ] Add Vitest tests for Phase B write endpoints
- [ ] Verify end-to-end seed with `pnpm --filter @v2e/database typecheck`

---

### Phase C - Technical Review and Improvement Actions (2026-03-27)

**Status:** In Progress

**Deliverables:**

- Database: `improvement_actions` table in `packages/database/src/schema.ts`
- Migration: `0018_phase_c_improvement_actions.sql`
- Seed scripts: `phase-c-entities.ts` generates improvement actions with:
  - 3-5 improvement actions per project
  - Category distribution: quality (35%), schedule (30%), safety (20%), maintenance (10%), other (5%)
  - Status distribution: open (25%), in_progress (35%), validated (25%), closed (15%)
  - ~20% overdue actions (open/in_progress with past targetDate)
  - ~60% linked to blocked tasks
  - ~40% linked to at-risk commitments
- Validation: Project-scope integrity, linked entity existence, status consistency

**Risk assessment:** No known unaccounted breakage for Phase C.

- Improvement actions are additive (no breaking changes to existing schemas)
- Seed validation ensures linked tasks/commitments exist
- Status/targetDate consistency validated

**Remaining work:**

- [ ] Add Vitest tests for improvement action routes
- [ ] Add technical review queue endpoints
- [ ] Update route documentation

---

### Phase D - Standup Session Persistence and Notifications (2026-03-27)

**Status:** In Progress

**Deliverables:**

- Database: `standup_sessions`, `notifications`, `notification_preferences`, `delivery_attempts` tables
- Migration: `0019_phase_d_standup_sessions_notifications.sql`
- Seed scripts: `phase-d-entities.ts` generates:
  - 2-3 standup sessions per project spanning last 7 days
  - Status distribution: draft (15%), active (35%), closed (50%)
  - 2-4 notifications per demo user
  - Notification types: task_assigned, blocker_escalated, commitment_at_risk, standup_reminder, improvement_action, task_overdue
  - ~40% unread notifications
- Validation: Owner/user existence, read status consistency

**Risk assessment:** No known unaccounted breakage for Phase D.

- Standup sessions and notifications are additive
- Seed validation ensures referenced users/team members exist
- Read status consistency validated (read notifications have readAt, unread do not)

**Remaining work:**

- [ ] Add Vitest tests for standup session endpoints
- [ ] Add Vitest tests for notification endpoints
- [ ] Implement notification delivery worker (optional)
- [ ] Update route documentation

---

### Phase H - Audit read and route integrity (2026-03-27)

**Status:** Complete

**Deliverables:**

- `GET /v1/audit` and `GET /v1/audit/:auditEventId` in `apps/api/src/routes/audit.ts`
- Technical review queue read model only in `apps/api/src/routes/projects.ts` with `computeDependencySummaries` from `apps/api/src/lib/dependencies.ts`
- Duplicate nested project queue GET removed from `phase-c.ts` (workflow commands remain there)
- `pilot-metrics` and `execution-reliability` registered only in `phase-c.ts`
- Removed unused `getStubDependencySummary` from `packages/database/src/demo-seed/phase-a-read-models.ts`

**Risk assessment:** No known unaccounted breakage for Phase H.

---

## Pre-merge Gate

- [ ] Register reviewed for current scope
- [ ] New unresolved risks added with owner + timeline
- [ ] Resolved risks marked with date + reference
- [ ] If no unresolved risk, explicit note added for current scope
