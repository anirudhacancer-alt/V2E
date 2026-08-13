# Entity-relationship diagram (SQLite persistence)

**Source of truth for tables and columns:** `packages/database/src/schema.ts` (Drizzle). **Wire shapes:** `packages/contracts`. **Zod enum literals** per table: see each entity’s **Enums** section in this folder (shared catalog: [`enums.ts`](../../packages/contracts/src/enums.ts)).

This page holds the **Mermaid `erDiagram`** for the persisted model. For a **flowchart-style** overview (masters vs capture vs roll call), see [index.md](./index.md). For **updates ↔ tasks** semantics (`sourceUpdateId`, `linkedTaskId`), see [update.md](./update.md). For **API JSON field names** and integrity rules, see [canonical-org-location-and-integrity.md](./canonical-org-location-and-integrity.md).

## ER diagram

```mermaid
erDiagram
  departments ||--o{ users : "departmentCode"
  role_types ||--o{ users : "orgRoleCode"
  role_types ||--o{ team_members : "orgRoleCode"
  departments ||--o{ team_members : "departmentCode"
  sites ||--o{ projects : "siteId"
  projects ||--o{ locations : "projectId"
  sites ||--o{ team_members : "siteId"
  projects ||--o{ updates : "projectId"
  projects ||--o{ tasks : "projectId"
  projects ||--o{ attendance_sessions : "projectId"
  projects ||--|| project_standup_ai_summaries : "projectId"
  updates ||--|| update_ai_outputs : "updateId"
  updates ||--o{ update_attachments : "updateId"
  updates ||--o{ update_risk_downstream_effects : "updateId"
  updates ||--o{ update_risk_recommended_actions : "updateId"
  updates }o--o| tasks : "linkedTaskId"
  tasks }o--o| updates : "sourceUpdateId"
  tasks ||--o{ task_attachments : "taskId"
  attendance_sessions ||--o{ attendances : "sessionId"
  team_members ||--o{ attendances : "teamMemberId"

  %% Phase B: Agile Execution Layer
  projects ||--o{ work_cycles : "projectId"
  projects ||--o{ commitments : "projectId"
  projects ||--o{ task_dependencies : "projectId"
  work_cycles ||--o{ commitments : "workCycleId"
  tasks ||--o{ commitments : "sourceTaskId"
  tasks ||--o{ task_dependencies : "predecessorTaskId"
  tasks ||--o{ task_dependencies : "successorTaskId"
  team_members ||--o{ commitments : "ownerId"
  team_members ||--o{ task_dependencies : "createdBy"
  role_types ||--o{ commitments : "assigneeRoleCode"

  %% Phase C: Improvement Actions
  projects ||--o{ improvement_actions : "projectId"
  team_members ||--o{ improvement_actions : "ownerId"

  %% Phase D: Standup Sessions & Notifications
  projects ||--o{ standup_sessions : "projectId"
  team_members ||--o{ standup_sessions : "ownerId"
```

## Notes

- **`updates` ↔ `tasks`:** The link is two optional FK-style columns, not a join table: `tasks.sourceUpdateId` (voice/AI spawned a task from a note) and `updates.linkedTaskId` (human follow-up on an existing task). See [update.md](./update.md).

- **Standup prep lists** (planned / completed / blocked) are **not** separate tables: the API derives read-model items from `tasks` (see [standup-prep-from-tasks.md](../field-app/standup-prep-from-tasks.md)). `project_standup_ai_summaries` stores optional AI summary snapshots per project/date.

- **Demo bundles** align with these tables; CSV column join keys and the validator are documented under [data-contract-validator-crosscheck.md](../demo/data-contract-validator-crosscheck.md).

---

## Phase A Entities (Read Models)

Phase A introduced contracts for the following entities with read-model APIs.

| Entity | Contract | Read API | Persistence |
| ------ | -------- | -------- | ----------- |
| **Commitment** | `CommitmentSchema`, `CommitmentCardSchema` | `GET /v1/commitments/horizon?projectId=...` (and flat `/v1/commitments` CRUD) | `commitments` table (Phase B) |
| **Dependency** | `DependencySchema`, `DependencyCardSchema`, `DependencySummarySchema` | `/v1/dependencies` (create/get/patch/delete/override) | `task_dependencies` table (Phase B) |
| **Improvement** | `ImprovementSchema`, `ImprovementCardSchema` | `/v1/improvements` | `improvement_actions` table (Phase C) |
| **Cycle** | `CycleSchema`, `CycleCardSchema` | `GET /v1/cycles?projectId=...` | `work_cycles` table (Phase B) |

---

## Phase B Entities (Persisted)

Phase B added persistence with SQLite tables and full write APIs.

### work_cycles

Weekly/bi-weekly planning horizons.

```mermaid
erDiagram
  work_cycles {
    text id PK
    text tenantId
    text projectId FK
    text name
    text startDate
    text endDate
    text status
    text goal
    text createdAt
    text updatedAt
  }
```

**Status values:** `planned`, `active`, `closed`

**Constraints:**

- `endDate >= startDate`
- No overlapping active cycles per project

### commitments

Task delivery commitments with reliability tracking.

```mermaid
erDiagram
  commitments {
    text id PK
    text tenantId
    text projectId FK
    text siteId FK
    text workCycleId FK
    text standupSessionId
    text sourceTaskId FK
    text title
    text description
    text ownerId FK
    text assigneeRoleCode
    text status
    text commitDate
    text targetDate
    text completedAt
    text carriedOverFromCommitmentId FK
    text riskReason
    text createdAt
    text updatedAt
  }
```

**Status values:** `planned`, `in_progress`, `completed`, `at_risk`, `missed`, `carried_over`

**Invariants:**

- `targetDate >= commitDate`
- If `sourceTaskId` is set, `projectId` must match
- `carried_over` requires prior commitment or task linkage

### task_dependencies

Explicit sequencing and constraint management.

```mermaid
erDiagram
  task_dependencies {
    text id PK
    text tenantId
    text projectId FK
    text predecessorTaskId FK
    text successorTaskId FK
    text dependencyType
    integer lagDays
    integer isHardConstraint
    text reason
    text createdBy FK
    text createdAt
    text updatedAt
  }
```

**Dependency types:** `finish_to_start`, `blocks`, `start_to_start`, `finish_to_finish`

**Invariants:**

- `predecessorTaskId !== successorTaskId` (no self-edges)
- Both tasks must exist and share `projectId`
- No duplicate active edge of same pair/type
- Reject hard-constraint cycles

**Execution behavior:**

- Blocked successor cannot move to `in_progress` unless explicit override
- All overrides emit audit events

---

## Phase C Entities (Improvement Actions)

### improvement_actions

Structured countermeasures for repeated or systemic issues.

```mermaid
erDiagram
  improvement_actions {
    text id PK
    text tenantId
    text projectId FK
    text siteId FK
    text title
    text problemStatement
    text category
    text rootCause
    text ownerId FK
    text status
    text targetDate
    text linkedTaskIds
    text linkedCommitmentIds
    text effectivenessNote
    text createdAt
    text updatedAt
  }
```

**Category values:** `quality`, `schedule`, `safety`, `maintenance`, `process`, `other`
**Status values:** `open`, `in_progress`, `validated`, `closed`

---

## Phase D Entities (Standup Sessions & Notifications)

### standup_sessions

Persistent standup workflow objects.

```mermaid
erDiagram
  standup_sessions {
    text id PK
    text tenantId
    text projectId FK
    text scopeLevel
    text scopeRef
    text sessionDate
    text ownerId FK
    text status
    text summaryText
    text createdAt
    text updatedAt
  }
```

**Scope levels:** `team`, `department`, `site`, `plant`, `region`
**Status values:** `draft`, `active`, `closed`

### notifications

User notification records.

```mermaid
erDiagram
  notifications {
    text id PK
    text tenantId
    text userId FK
    text type
    text title
    text body
    text entityType
    text entityId
    text status
    text createdAt
    text readAt
  }
```

**Status values:** `unread`, `read`, `archived`

---

See [index.md](./index.md) for contract file locations, [Phase A plan](./plans/phase-A-contracts-and-read-models.md), and [Phase B plan](./plans/phase-B-persisted-commitments-and-dependencies.md) for full scope.

Parent: [AGENTS.md](./AGENTS.md).
