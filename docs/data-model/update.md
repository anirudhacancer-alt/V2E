# Entity: Update (and related rows)

**Primary table:** `updates`  
**Child tables:** `update_ai_outputs`, `update_attachments`, `update_risk_downstream_effects`, `update_risk_recommended_actions`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts)

## Purpose

**Voice/site update** — transcript intake, status, optional link to an **existing** task (`linkedTaskId` for human follow-up). One **AI extraction** row per update in `update_ai_outputs`. Media lives in `update_attachments`. Risk arrays are normalized into `update_risk_*` tables for CSV/demo parity.

The sections below on **updates ↔ tasks** are the **canonical** description of how these rows connect to **tasks** in SQLite and in contracts. For **roles, departments, locations, FK columns, API JSON names, and `DATA_INTEGRITY` behavior**, use [**Canonical org, location, and integrity**](./canonical-org-location-and-integrity.md) (one matrix; do not duplicate here).

The public API for `update_ai_outputs` is now exposed as a nested extraction subresource: `GET/PATCH /v1/updates/:updateId/extraction`. `updateId` remains the unique parent link, and `reviewStatus` is the canonical route-level review field.

## `updates` Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the update |
| `siteId` | text | notNull | FK to `sites.id` |
| `projectId` | text | notNull | FK to `projects.id` |
| `recordedBy` | text | notNull | User ID who recorded the update |
| `transcript` | text | notNull | Voice transcript text |
| `audioUrl` | text | optional | URL to audio recording |
| `audioDuration` | text | optional | Duration of audio |
| `status` | text | notNull | Processing status |
| `isRead` | integer | notNull, default: 0 | Boolean: whether an execution lead has read this |
| `readAt` | text | optional | When an execution lead read it |
| `transcribeIdempotencyKey` | text | optional | Last idempotency key for transcription |
| `extractIdempotencyKey` | text | optional | Last idempotency key for extraction |
| `linkedTaskId` | text | optional | FK to `tasks.id` (follow-up on existing task) |
| `locationId` | text | notNull | FK to `locations.id` |
| `createdAt` | text | notNull | Timestamp |
| `updatedAt` | text | notNull | Timestamp |

## `update_ai_outputs` Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of the AI-output row |
| `updateId` | text | unique, notNull | FK to `updates.id` (one row per update) |
| `category` | text | notNull | Update category (Blocker, Progress, etc.) |
| `departmentCode` | text | optional | FK to `departments.code` |
| `location` | text | optional | Location text |
| `locationId` | text | notNull | FK to `locations.id` |
| `blockerSubtype` | text | optional | When category is Blocker (material delay, access, etc.) |
| `locationBlock` | text | optional | Block within location |
| `locationZone` | text | optional | Zone within location |
| `locationLevel` | text | optional | Level within location |
| `locationArea` | text | optional | Area within location |
| `vendor` | text | optional | Vendor name if applicable |
| `severity` | text | notNull | Severity level |
| `ownerRoleCode` | text | notNull | FK to `role_types.code` |
| `ownerId` | text | optional | Specific owner user ID |
| `dueDate` | text | notNull | Suggested due date |
| `generatedTaskDescription` | text | notNull | AI-generated task description |
| `riskImpact` | text | notNull | Risk impact assessment |
| `scheduleRisk` | text | notNull | Schedule risk assessment |
| `confidence` | real | notNull | AI confidence score (0-1) |
| `reviewStatus` | text | notNull, default: `accepted` | Canonical review state (`accepted`, `pending`, `needs_human_review`, etc.) |
| `reviewRequired` | integer | notNull, default: 0 | Boolean: requires execution lead review |
| `reviewPrompt` | text | optional | Supervisor-facing review prompt |
| `reviewReasonsJson` | text | notNull, default: '[]' | JSON array of review reasons |
| `reviewFieldsJson` | text | notNull, default: '[]' | JSON array of fields needing review |
| `humanReviewRequired` | integer | notNull, default: 0 | Boolean: requires human review (low confidence) |
| `reviewedAt` | text | optional | When review was completed |
| `reviewedBy` | text | optional | User ID who reviewed |
| `suggestedSnapshotJson` | text | optional | JSON snapshot of suggested fields for audit |

## `update_attachments` Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | primaryKey | UUID of attachment |
| `updateId` | text | notNull | FK to `updates.id` |
| `taskId` | text | optional | FK to `tasks.id` (denormalized) |
| `url` | text | notNull | Attachment URL |
| `type` | text | notNull | Attachment type |
| `uploadedAt` | text | notNull | Timestamp |

## `update_risk_downstream_effects` Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `updateId` | text | notNull, part of PK | FK to `updates.id` |
| `order` | integer | notNull, part of PK | Order in the list |
| `effect` | text | notNull | Downstream effect description |

## `update_risk_recommended_actions` Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `updateId` | text | notNull, part of PK | FK to `updates.id` |
| `order` | integer | notNull, part of PK | Order in the list |
| `action` | text | notNull | Recommended action description |

## Updates ↔ tasks (canonical)

### Why two edges?

| Edge | Column | Direction | Meaning |
|------|--------|-------------|---------|
| **Voice / AI → task** | `tasks.sourceUpdateId` | Update → Task | Task was **created** from a transcript note (voice pipeline, extraction, task creation). |
| **Human follow-up** | `updates.linkedTaskId` | Update → Task | A **new** note references an **existing** task (status comment, photo, clarification). |

An update may participate in **at most one** of these as “primary link” for product semantics:

- If a task row has `sourceUpdateId = <update id>`, that update **spawned** the task.
- If an update row has `linkedTaskId = <task id>`, the update is a **follow-up** on work that already existed.

Demo seed (`packages/database/src/demo-seed/materialize.ts`) enforces that **every update** is connected to at least one task: roughly half of updates spawn tasks, half are human follow-ups on those same tasks (see `applyUpdateTaskLinkage`). Orphan edge cases are resolved with `linkOrphanUpdatesToTasks`.

### Product note states vs edges

- **Linked** (execution lead queue) means: human follow-up — **`updates.linkedTaskId` is set** and the linked task’s `createdAt` is **before** the note (`apps/api/src/routes/projects.ts`, `deriveNoteState`).
- **Review** is an **update queue state**, not a task execution state. A voice / AI note may still be in `Review` even when the linked task is already `Active`, `Blocked`, or `Overdue`.
- It does **not** mean “no task exists yet” for voice-spawned tasks. The API list filter for `noteState=Linked` uses only the `linkedTaskId` predicate; `sourceUpdateId` alone does not move a note out of `Review`.

See [workflow invariants](./invariants/updates-tasks-workflow-invariants.md) for the canonical product rules.

### Human review triggers

Supervisor review is required in these two product scenarios:

- **Low-confidence extraction**: AI confidence is too low for silent acceptance.
- **New task proposed**: AI proposes a new task from the note and the execution lead must confirm it.

These triggers belong to the **update review flow**. They do not automatically change the linked task’s execution state.

### Child tables: not redundant

These are **normalized** pieces of an **update** record, not duplicate copies of task data:

| Artifact | Role |
|----------|------|
| `update_ai_outputs` | One row per update: extraction, assignment suggestion, confidence, risk text. |
| `update_risk_downstream_effects` / `update_risk_recommended_actions` | Arrays split for CSV storage; map to `AIProcessedOutput.riskAssessment`. |
| `update_attachments` | Media on the note (audio, images, video). Distinct from `task_attachments`. |

Tasks hold execution fields (owner, due date, status). Updates hold intake + AI output. **Both** can point at each other via the two edges above without duplicating the other entity’s primary payload.

### Standup: read model vs persisted rows

- **Removed from SQLite:** `standups` and legacy standup-attendance tables (see migration `0006_drop_standup_tables.sql`). Standup **planned / completed / blocked** line-item tables were already dropped earlier (`0004`).
- **Not redundant — UI/API contracts:** `packages/contracts/src/standup.ts` still defines **`PlannedItemSchema`**, **`CompletedItemSchema`**, **`BlockedItemSchema`** because those shapes are **list row types** composed into **`StandupPrepResponseSchema`** (`packages/contracts/src/api-responses.ts`). The execution lead standup screen consumes that response; it is **assembled from `tasks`** at request time (`GET /v1/standup-prep?projectId=...`), not loaded from a `standups` row.
- **Optional snapshot:** `lastStandup` on the prep response is typed for when we persist a “last generated summary” per project; until then the API returns `null`.

Attendance for roll-call is **persisted** separately: **`attendance_sessions`** + **`attendances`** (see schema + [`docs/field-app/standup-prep-from-tasks.md`](../field-app/standup-prep-from-tasks.md) for prep lists vs attendance).

### PM reference exports

`pm_*_contract_<id>.csv` under `docs/demo/datasets/` are **filtered PM exports** for realism; they are **not** FK-linked into app UUID tables. Do not treat them as a second source of truth for tasks or updates.

### Code map

| Area | Location |
|------|----------|
| Schema | `packages/database/src/schema.ts` — `updates.linkedTaskId`, `tasks.sourceUpdateId` |
| Contracts | `packages/contracts/src/update.ts`, `task.ts` |
| Seed linkage | `packages/database/src/demo-seed/materialize.ts` — `applyUpdateTaskLinkage`, `linkOrphanUpdatesToTasks` |
| API updates list | `apps/api/src/routes/projects.ts` — `linkedToExistingTask` SQL, `deriveNoteState` |
| Demo validation | `packages/database/src/demo-seed/validate.ts` — connectivity check |

## Contracts

- [`packages/contracts/src/update.ts`](../../packages/contracts/src/update.ts)
- [`packages/contracts/src/media.ts`](../../packages/contracts/src/media.ts) (attachments)
- Standup **list items** are read models from tasks (`standup.ts`), not rows here.

## API Endpoints

### Flat Routes (Phase F)

Implemented per `NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md` §12.8:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/updates` | List updates with filters (projectId, siteId, recordedByTeamMemberId, status, from, to) and pagination |
| `GET` | `/v1/updates/:updateId` | Get single update by ID |
| `PATCH` | `/v1/updates/:updateId` | Update update fields (transcript, markAsRead, locationId) |

### Command Endpoints

Slash-style commands per §12.11:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/updates/:updateId/transcribe` | Transcribe audio to text |
| `POST` | `/v1/ai/voice-note-extraction` | Run AI extraction (body: `{ updateId, projectId }`) |
| `POST` | `/v1/updates/:updateId/confirm-review` | Confirm extraction review |
| `POST` | `/v1/updates/:updateId/escalate` | Escalate update for supervisor attention |
| `GET` | `/v1/updates/:updateId/extraction` | Read persisted extraction row |
| `PATCH` | `/v1/updates/:updateId/extraction` | Patch extraction review fields |

**Note:** Command URLs use slash-style (`/:id/action`) rather than canonical colon-style (`:id:action`) in some specs. Documented in [updates.md](../api/routes/updates.md) and [AGENTS.md](../api/routes/AGENTS.md).

### Project-Scoped Create

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/updates` | Create update with optional audio upload (multipart/form-data) |

### Implementation

- **Flat routes source:** `apps/api/src/routes/updates-router.ts`, `apps/api/src/routes/update-actions.ts`, `apps/api/src/routes/update-extraction.ts` (third `/v1/updates` mount for `/updates/:updateId/extraction`)
- **AI jobs source:** `apps/api/src/routes/ai-jobs.ts`

## See also

- [index.md](./index.md) — data model index (all entities), diagrams
- [task.md](./task.md) — task entity and `sourceUpdateId`
- [Entity-relationship diagram](./entity-relationship-diagram.md) — Mermaid ER for SQLite tables
- [Updates and tasks workflow invariants](./invariants/updates-tasks-workflow-invariants.md) — `Review` vs task execution state
- [Demo validator cross-check](../demo/data-contract-validator-crosscheck.md) — CSV join keys and `validate_demo_datasets.mjs`
- [HTTP API overview](../api/overview.md) — API boundary (stack, versioning, auth shape)
- [API routes](../api/routes/AGENTS.md) — per-router route docs (`apps/api/src/routes/`)
- [updates.md](../api/routes/updates.md) — flat update routes and AI commands
