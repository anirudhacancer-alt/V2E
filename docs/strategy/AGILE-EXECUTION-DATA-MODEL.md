---
last_changes: "§7.2: document flat pilot routes; remove superseded project-prefixed HTTP examples."
last_updated: "2026-03-27T15:32:00Z"
---

# Agile Execution Data Model and Delivery Path

Date: 2026-03-26  
Status: Implementation spec (contracts + API + UI/backend upgrade path)

## 1) Scope

This document defines the next implementation layer for the platform:

- Core execution objects for Agile execution + continuous improvement
- Task dependency management (including project-safe constraints)
- Project-linked workflow integrity
- Concrete upgrade path for current contracts, backend routes, and UI surfaces

This is a delivery-oriented companion to:

- `USP-GTM-AND-PROGRESS-TRACKER.md`
- `PLATFORM-SURFACES-IA-AND-FOLDER-TREE.md`

---

## 1A) Applicability guardrails

This model is not "Scrum everywhere." It is designed for frontline execution environments where:

- work is dynamic and condition-driven
- handoffs happen across roles/teams
- evidence capture is necessary for closure/compliance
- daily/shift coordination and escalation are required
- recurring issues need structured improvement loops

It is less suitable as a primary model for highly predictable, fixed-sequence work with little variance.

---

## 2) Current baseline (already in repo)

Existing strong foundation:

- `Task` and `Update` are first-class (`packages/contracts/src/task.ts`, `update.ts`)
- Two canonical update-task edges exist:
  - `tasks.sourceUpdateId` (voice/AI spawned task)
  - `updates.linkedTaskId` (human follow-up note)
- `projectId` is present on operational entities (`tasks`, `updates`)
- Standup prep is read-model based (`StandupPrepResponseSchema`) and derived from tasks
- Attendance persistence exists (`attendance_sessions`, `attendances`)
- Strict org/location integrity rules and `DATA_INTEGRITY` behavior are defined

Current gap areas:

- No explicit `Commitment` object
- No explicit task dependency model
- No explicit `ImprovementAction` object for DMAIC loop closure
- Technical review workflow is implicit, not first-class in contracts/routes
- Weekly planning horizon (`Today` / `This Week` / `Look-ahead`) is not represented as a contract layer

---

## 3) Target core objects (platform contract)

The platform contract should center around five objects:

1. `Update` - frontline reality capture
2. `Task` - execution unit
3. `Blocker` - execution constraint (can remain task-state-backed in phase 1)
4. `Commitment` - standup/planning commitment
5. `ImprovementAction` - recurring issue countermeasure

Supporting workflow objects:

- `StandupSession` (first-class workflow object; can start as read-model + attendance-backed)
- `WorkCycle` (weekly/bi-weekly planning horizon)
- `TaskDependency` (blocking/sequence relations between tasks)

---

## 3A) Workflow-pack contract (cross-vertical reuse)

Every vertical pack should be a configuration layer on the same core objects.

Minimum pack definition:

- `packId`, `packVersion`
- `domainLabels` (external wording for roles/states)
- `requiredEvidence` (voice/photo/checklist/attachments)
- `routingRules` (owner/execution-lead/escalation)
- `defaultSLA` and due-date policy
- `reviewGates` (e.g., technical approval required)
- `metricsProfile` (which KPIs are primary)

### 3A.1) Pillar coverage and role-level invariants

The same platform contract must serve three primary pillars:

1. Construction site execution
2. Factory/shift operations
3. Field reps / visit execution

Role modeling invariant (cross-pillar):

- every role code in `role_types.code` maps to one `role_types.level`
- allowed levels are exactly: `manager`, `execution_lead`, `crew`
- domain-specific labels (`Site Supervisor`, `Shift Supervisor`, `Area Manager`, etc.; overlays on `manager` / `execution_lead` / `crew`)
  are naming overlays on these three levels, not separate architecture
- this model must support office-to-ground execution chains (e.g. transport planning in office, inbound/outbound/local execution on ground, manager-level logistics governance)

Example mappings:

- Construction: standup + rework + technical review
- Factory: shift handover + maintenance exceptions + kaizen actions
- Warehouse: dock/aisle exception + shift recovery board
- Retail/RGM: LASER visit + Perfect Store scoring
- Venue: pre-event readiness + live incident closure
- NGO: visit report + service gap escalation

---

## 4) Data model additions (exact proposal)

## 4.1 Commitment

Purpose:

- Track what was committed in standup/planning and whether it was delivered.

Suggested fields:

- `id` (uuid)
- `projectId` (uuid, required)
- `siteId` (uuid, required)
- `workCycleId` (uuid, optional in phase 1; required in phase 2)
- `standupSessionId` (uuid, optional)
- `sourceTaskId` (uuid, nullable; commitment may exist before task materialization)
- `title` (string)
- `description` (string, optional)
- `ownerId` (uuid)
- `assigneeRoleCode` (RoleTypeCode)
- `status` (`Planned` | `InProgress` | `Completed` | `AtRisk` | `Missed` | `CarriedOver`)
- `commitDate` (date)
- `targetDate` (date)
- `completedAt` (date, nullable)
- `carriedOverFromCommitmentId` (uuid, nullable)
- `riskReason` (string, nullable)
- `createdAt`, `updatedAt`

Validation invariants:

- `projectId` must match linked `sourceTaskId.projectId` when `sourceTaskId` is set.
- `targetDate >= commitDate`.
- `CarriedOver` requires either `carriedOverFromCommitmentId` or `sourceTaskId`.

## 4.2 StandupSession

Purpose:

- Make standup a workflow object, not only a page.

Suggested fields:

- `id` (uuid)
- `projectId` (uuid)
- `scopeLevel` (`Team` | `Department` | `Site` | `Plant` | `Region`)
- `scopeRef` (string; e.g., department code, line, crew, zone)
- `sessionDate` (UTC date)
- `ownerId` (uuid)
- `status` (`Draft` | `Active` | `Closed`)
- `summaryText` (nullable; optional AI summary snapshot link)
- `createdAt`, `updatedAt`

Phase guidance:

- Keep read-model generation from tasks in phase 1.
- Reuse existing attendance tables for participation.
- Add persisted standup session table only when cross-session analytics are needed.

## 4.3 WorkCycle

Purpose:

- Weekly/bi-weekly execution planning boundary.

Suggested fields:

- `id` (uuid)
- `projectId` (uuid)
- `name` (string, e.g., `2026-W13`)
- `startDate` (date)
- `endDate` (date)
- `status` (`Planned` | `Active` | `Closed`)
- `goal` (string, optional)
- `createdAt`, `updatedAt`

Validation invariants:

- No overlapping active cycles per project.
- `endDate >= startDate`.

## 4.4 TaskDependency (critical)

Purpose:

- Represent execution sequencing and blockers explicitly.

Suggested fields:

- `id` (uuid)
- `projectId` (uuid, required)
- `predecessorTaskId` (uuid, required)
- `successorTaskId` (uuid, required)
- `dependencyType` (`Blocks` | `FinishToStart` | `StartToStart` | `FinishToFinish`)
- `lagDays` (integer, default 0)
- `isHardConstraint` (boolean, default true)
- `reason` (string, optional)
- `createdBy` (uuid, optional)
- `createdAt`, `updatedAt`

Validation invariants:

- `predecessorTaskId != successorTaskId`.
- Both tasks must exist and share same `projectId`.
- Prevent duplicate active edges for same pair + type.
- Cycle prevention for hard constraints:
  - reject creation if edge introduces cycle in dependency graph.

Execution behavior:

- If predecessor is not done and dependency is blocking, successor cannot move to `InProgress` without explicit override.
- Overrides must be audited.

## 4.5 ImprovementAction

Purpose:

- Close the DMAIC loop on recurring issues.

Suggested fields:

- `id` (uuid)
- `projectId` (uuid)
- `siteId` (uuid)
- `title` (string)
- `problemStatement` (string)
- `category` (`Quality` | `Schedule` | `Safety` | `Maintenance` | `RetailExecution` | `Other`)
- `rootCause` (string, optional)
- `ownerId` (uuid)
- `status` (`Open` | `InProgress` | `Validated` | `Closed`)
- `targetDate` (date, optional)
- `linkedTaskIds` (array of uuid, optional)
- `linkedBlockerIds` (array of uuid, optional)
- `linkedCommitmentIds` (array of uuid, optional)
- `effectivenessNote` (string, optional)
- `createdAt`, `updatedAt`

---

## 5) Project linkage and integrity rules

All operational objects must be project-scoped and consistent:

- `Task`, `Update`, `Commitment`, `TaskDependency`, `ImprovementAction`, `WorkCycle`, `StandupSession` carry `projectId`.
- Any relation between two objects requires equal `projectId`.
- Reject cross-project references with validation errors (do not auto-correct).
- Preserve strict integrity philosophy:
  - fail loudly on broken references
  - do not introduce fallback behaviors that hide invalid data

Recommended error codes:

- `PROJECT_SCOPE_MISMATCH`
- `DEPENDENCY_CYCLE_DETECTED`
- `DEPENDENCY_INVALID_EDGE`
- `COMMITMENT_INVALID_STATE_TRANSITION`

---

## 6) Contracts package changes (`packages/contracts`)

Add files:

- `commitment.ts`
- `cycle.ts`
- `dependency.ts`
- `improvement.ts`
- `standup-session.ts`

Update exports:

- `packages/contracts/src/index.ts` should export the above.

Update existing contracts:

- `task.ts`
  - add optional dependency summary fields to `TaskCardSchema`:
    - `dependencyCount`
    - `blockedByCount`
    - `blocksCount`
    - `isDependencyBlocked`
- `api-responses.ts`
  - add list/board response contracts for commitments, dependencies, improvement actions
  - add standup session summary response

API DTO additions (suggested):

- `CreateDependencySchema`
- `DependencyListResponseSchema`
- `CommitmentCreateSchema`, `CommitmentUpdateSchema`
- `ImprovementActionCreateSchema`, `ImprovementActionUpdateSchema`

---

## 7) Backend schema and route path (`apps/api` + `packages/database`)

## 7.1 Database migration path

Add tables:

- `work_cycles`
- `commitments`
- `task_dependencies`
- `improvement_actions`
- optional in phase 2+: `standup_sessions`

Keep current standup read-model behavior during transition.

## 7.2 Route surface (pilot API)

The pilot API uses **flat** first segments after `/v1` with **`projectId` in query (GET) or JSON body (POST/PATCH)**. Older specs listed nested **`/v1/projects/:projectId/...`** paths for cycles, commitments, and dependencies; those shapes are **not** mounted — use the routes below.

**Machine catalog:** [`ROUTE-INVENTORY.md`](../../ROUTE-INVENTORY.md) (generated; `pnpm check:route-structure-invariant`). **Per-router docs:** [`docs/api/routes/AGENTS.md`](../api/routes/AGENTS.md).

Entity-aligned examples:

- **Work cycles:** `GET` / `POST` `/v1/cycles`; `GET` / `PATCH` `/v1/cycles/:workCycleId` (`projectId` as implemented in handlers)
- **Commitments (table CRUD):** `/v1/commitments` — **horizon read model (task-derived cards):** `GET /v1/commitments/horizon?projectId=...`
- **Dependencies:** `/v1/dependencies` (including `POST /v1/dependencies/override` with JSON body — not a path suffix on `:dependencyId`)
- **Tasks:** `/v1/tasks` (list/get/patch/create); **technical review actions:** `POST /v1/tasks/:taskId/review/...`
- **Improvements:** `/v1/improvements` (see inventory for verbs)
- **Technical review queue:** `GET /v1/reviews?projectId=...`

Guardrails:

- reuse existing auth middleware on mutating routes
- enforce project scope checks on every cross-entity mutation
- emit audit events for dependency overrides and commitment state transitions

---

## 8) UI upgrade path (Field + Planning + technical review)

## 8.1 Field App (capture/action)

Add:

- `Today`, `This Week`, `Look-ahead` tabs
- commitment cards in standup owner mode
- quick "commit to today" action from updates/tasks

Keep:

- fast capture and AI review as primary wedge

## 8.2 Planning Console (control/reliability)

Add:

- board with dependency badges and blocked indicators
- dependency editor (task detail side panel)
- commitment board/list by work cycle
- execution reliability dashboard:
  - commitment reliability
  - WIP aging
  - blocked-by dependency trend

## 8.3 Technical review mode (new first-class surface)

Add:

- technical review queue
- drawing/spec-linked issue review
- approve/rework with reason capture
- dependency-aware due date changes

---

## 9) Phase plan (implementation order)

## Phase A (contracts + read models)

- Introduce contracts for `Commitment`, `TaskDependency`, `ImprovementAction`, `WorkCycle`.
- Add read-model endpoints returning computed standup commitment view from existing tasks (no new writes yet).

## Phase B (persisted commitments + dependencies)

- Add DB tables and write routes for commitments and dependencies.
- Add cycle detection + project scope validation.
- Add UI dependency visualization and commitment list.

## Phase C (technical review workflow + improvement actions)

- Add technical review queue endpoint and UI under the canonical `/v1/reviews` route.
- Add improvement persistence and dashboards.

## Phase D (standup session persistence, optional)

- Persist standup session metadata if needed for deep cross-session analytics.
- Keep compatibility with current `standup-prep` read model.

---

## 10) Demo dataset expansion plan

Extend current dataset strategy with reliability-oriented fixtures:

- Add dependency chains:
  - serial work (FS)
  - parallel work (SS)
  - blocker-caused delay
- Add commitment history:
  - met vs missed commitments
  - carry-over patterns
- Add improvement actions linked to repeated blockers
- Add technical review examples with approve/rework outcomes

Suggested new packs:

- `RGM-3101` (LASER baseline)
- `RGM-3102` (Perfect Store + improvement loop)
- `WH-3201` (warehouse shift handover + exception loop)
- `FAC-3202` (facilities rounds + contractor follow-up)
- `VEN-3203` (venue readiness + live incident loop)
- `HC-3204` (healthcare non-clinical operations handover)
- `NGO-3205` (field visit + service gap escalation)

Expansion sequencing:

- prioritize Tier 1 packs before Tier 2/Tier 3
- ship one new pack at a time with measurable KPI outcome

---

## 11) Success metrics for this layer

Primary:

- Commitment reliability (% completed on committed window)
- Blocker mean time to resolve
- Dependency-blocked task aging
- Standup-to-closure conversion

Secondary:

- Reopened task rate
- Repeated issue rate (by category)
- Improvement action effectiveness (validated improvements / opened)

---

## 12) Immediate next actions (this sprint)

1. Finalize contract names and enums for:
  - `CommitmentStatus`
  - `DependencyType`
  - `WorkCycleStatus`
  - `ImprovementActionStatus`
2. Draft migration SQL for:
  - `task_dependencies`
  - `commitments`
  - `improvement_actions`
3. Add API read endpoints first:
  - commitment list
  - task dependency list
  - technical review queue
4. Ship planning UI v1:
  - dependency badges on task board
  - commitment list grouped by `Today`/`This Week`/`Look-ahead`
5. Add demo seeds for one dependency chain and one missed-commitment recovery flow.

---

## 13) Design principles to preserve

- Keep capture friction extremely low.
- Keep project scope and data integrity strict.
- Prefer additive contracts; avoid breaking existing task/update flows.
- Keep standup prep backward-compatible while introducing commitments.
- Make reliability visible in every role surface.
