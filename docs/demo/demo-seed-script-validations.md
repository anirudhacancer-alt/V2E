# Demo Seed Script Validations

This document defines the validation rules enforced by the demo seed pipeline.

**Canonical model (same FKs and codes as runtime):** [Canonical org, location, and integrity](../data-model/canonical-org-location-and-integrity.md) — use that doc for the full schema/API field matrix; this file focuses on **what the seed validator enforces**.

Primary implementation: `packages/database/src/demo-seed/validate.ts` (canonical org / list-label checks: `org-integrity-rules.ts`).
Seed entrypoint: `packages/database/src/seed.ts`.

If any rule is violated, seeding fails with a descriptive error:

```bash
pnpm --filter @v2e/database db:seed
```

## Core integrity rules

- **Canonical org model:** persisted rows use FK-backed codes (`users.orgRoleCode`, `team_members.orgRoleCode`, `tasks.assigneeRoleCode`, `tasks.departmentCode`, `update_ai_outputs.ownerRoleCode`, `update_ai_outputs.departmentCode`) referencing `role_types` and `departments`. CSV/materialization may still carry legacy string columns (`role`, `assigneeRole`, `department`); `persist.ts` maps them deterministically via `org-mappings.ts` / `org-canonical.ts`.
- **Post-map org master coverage (seed):** using the same helpers as `persist.ts` (`legacyUserRoleStringToRoleTypeCode`, `departmentStringToCode`), every mapped `role_types.code` on users, team members, tasks (`assigneeRole`), and AI rows (`ownerRole`) must exist in the bundle’s shared `role_types.csv`; every non-null mapped `departments.code` must exist in `departments.csv`. Non-empty `update_ai_outputs.ownerId` must resolve to a `users` or `team_members` row; `sites.projectManagerId` must resolve to a `users` row.
- **Location list labels (seed):** every `locations.csv` row must produce a non-empty compact label via `deriveLocationListLabel` (same helper as `persist.ts` → `locations.listLabel` / API list cards).
- **Location master:** `updates.locationId`, `tasks.locationId`, and `update_ai_outputs.locationId` are required and must reference `locations.id` scoped to the project (seed + runtime).
- **Pack-aware location vocabulary:** location validation is pack-driven. Residential, commercial, and factory bundles each enforce their own required coverage terms and banned vocabulary.
- **Pack-aware lead identity:** each bundle must contain the expected lead role and stable identity for that pack (`SiteSupervisor` for construction bundles, `ShiftSupervisor` for factory bundles, `AreaManager` for field-rep bundles when added). This identity is used for seeded task/update ownership and review routing.
- Every update must be connected to work through at least one path:
  - spawned task (`tasks.sourceUpdateId = updates.id`), or
  - linked existing task (`updates.linkedTaskId`).
- `tasks.sourceUpdateId` must reference a real update.
- `updates.linkedTaskId` must reference a real task created before the update.
- Review-state updates must include explicit review metadata in AI output:
  - `reviewRequired = 1`
  - `reviewPrompt` starting with `Confirm:`
  - non-empty `reviewReasonsJson`.

## Task status lifecycle rules (enforced)

Allowed task statuses in seeded demo data are:

- `Review`
- `New`
- `Planned`
- `Active`
- `Blocked`
- `Done`

Any other task status fails validation.

Task lifecycle interpretation:

- `Review` is reserved for AI-created tasks only (`sourceUpdateId` present).
- Non-AI tasks (`sourceUpdateId` empty) must never be `Review`.
- `New` tasks can be either:
  - human-created (`sourceUpdateId` empty), or
  - AI-origin tasks that were approved by an execution lead (review complete).
- For human-created tasks (`sourceUpdateId` empty), seed validation enforces:
  - `source = Manual`
  - owner can be any valid user or team member (`ownerId` must resolve in `users.csv` or `team_members.csv`).
- For AI-origin `New` tasks (`sourceUpdateId` present), validation enforces:
  - source update status is `CreatedNewTask`
  - source AI row has completed review metadata (`reviewedAt`, `reviewedBy`).

### Task creator vs owner (important)

- `tasks.csv` currently stores `ownerId` (task owner), **not** an explicit `createdBy` field.
- Creator is inferred from flow:
  - `sourceUpdateId` present => AI-created flow.
  - `sourceUpdateId` empty + `source=Manual` => human-created flow.
- In demo validation, task **ownership** is unrestricted (any valid user), but task
  **mutations** on existing tasks (`updates.linkedTaskId`) must be recorded by execution leads (or equivalent lead roles).

## Update lifecycle entries (current)

Persisted update statuses (`updates.status`) used by demo seed:

- `Pending`
- `Processed`
- `CreatedNewTask`
- `Escalated`
- `Saved`

Field review queue state is derived (not persisted as a separate column):

- `Review`
- `Linked`
- `Escalated`

Derived queue logic:

- `Escalated` when `updates.status = Escalated`
- `Linked` when `updates.linkedTaskId` points to an older existing task
- `Review` otherwise

### `CreatedNewTask` semantics (enforced)

`CreatedNewTask` is reserved for **new task creation** only.

Validation enforces:

- update must spawn a task (`tasks.sourceUpdateId = updates.id`)
- update must **not** use `updates.linkedTaskId`

For notes linked to existing tasks, use other update statuses (`Pending`,
`Processed`, `Saved`, or `Escalated` as appropriate), not `CreatedNewTask`.

## AI suggestion rules (enforced)

### 1) AI new-task suggestion stays in Review

If a task is spawned from a voice/update note (`task.sourceUpdateId` is set):

- default status is `Review` until an execution lead decides.
- once approved in review, it may move into backlog buckets (`New` / `Planned`) only when:
  - source update is `CreatedNewTask`
  - AI row has completed review metadata (`reviewedAt`, `reviewedBy`).

Additionally, non-AI tasks must not be in `Review`:

- if `task.sourceUpdateId` is empty, `task.status` cannot be `Review`.

This enforces: AI-suggested new tasks are not added to backlog immediately.
Only after execution-lead review completion should they move into `New`.

### 1b) AI review metadata represents AI uncertainty

For updates that resolve to queue state `Review`, AI metadata must represent
AI uncertainty:

- `reviewRequired = 1`
- `reviewReasonsJson` present and non-empty (`[]` is invalid)
- all reasons must be uncertainty reasons:
  - `low_confidence_extraction`
  - `category_uncertain`
  - `location_uncertain`
  - `severity_uncertain`
  - `owner_uncertain`
  - `due_date_uncertain`

## Where AI Review / confidence is persisted (CSV)

### `updates.csv` (update lifecycle + linkage)

- `status` (`Pending | Processed | CreatedNewTask | Escalated | Saved`)
- `linkedTaskId` (used to derive `Linked` queue state)

### `update_ai_outputs.csv` (AI extraction + review payload)

- `confidence` (numeric extraction confidence)
- `reviewRequired` (`0/1`)
- `reviewPrompt` (optional AI clarification text for reviewer)
- `reviewReasonsJson` (e.g. `["low_confidence_extraction"]`)
- `reviewFieldsJson`
- `reviewedAt`, `reviewedBy`

### Low-confidence threshold

- In seed materialization, low-confidence review reasons are derived in
  `normalizeSeedReviewRequirement(...)`.
- Default threshold is `0.65` unless overridden (`lowConfidenceThreshold` param).
- If confidence is below threshold, reason `low_confidence_extraction` is added,
  which in turn drives `reviewRequired/prompt/reasons` persistence in
  `update_ai_outputs.csv`.

### 2) AI blocker suggestion must link to an existing task

For AI rows where `category = Blocker`:

- the corresponding update must have `linkedTaskId`;
- `linkedTaskId` must resolve to an existing task;
- linked task must be older than the update.

This enforces: blocker notes are attached to existing work, not treated as standalone new tasks.

### 3) Blocker presence today

- Seed output must contain at least one `Blocker` AI update for the anchor day.
- If no blocker exists for today, seed materialization promotes one linked update to `Blocker`.

## Sprint-planning validations (next week basket rules)

These rules are used to demo execution-lead-centric sprint planning behavior:

- **Future window definition**: "future" means tasks due **next week onward** (starting Monday of the next week).
- **Allowed future buckets**: only `New`, `Planned`, `Review`, `Blocked` are allowed for future tasks.
- **Thursday planning readiness**:
  - for future planning candidates (`New`/`Planned`) created up to current-week Thursday EOD,
    at least **80%** must be in `Planned`.
- **Friday planning readiness**:
  - for future planning candidates (`New`/`Planned`) created up to current-week Friday EOD,
    at least **96%** must be in `Planned`.

## Operational behavior

- Validation runs inside `validateMaterializedBundle(...)` during seeding.
- Legacy distribution/tolerance validations are still enforced for overall realism:
  - update status validity (`Pending`, `Processed`, `CreatedNewTask`, `Escalated`, `Saved`)
  - task Done ratio
  - task Blocked ratio
  - task overdue ratio
  - note Linked ratio
  - note Escalated ratio
- Demo execution-lead identity is hard-pinned for both demo projects:
  - `role = SiteSupervisor`
  - `id = bcea1e0f-b972-4f75-8563-c9f64aa9756f`
  - `email = supervisor.gurugram@demo.local`
  - `name = Narayanan`
- Task mutation actor rule:
  - updates that reference an existing task (`updates.linkedTaskId`) must be recorded by a
    execution-lead role (`*Supervisor` code suffix in demo data), or be part of AI create-new-task flow.
- Any failure throws an aggregated error and aborts the seed operation.
- No partial "success" is accepted when validation errors are present.

## Phase A read-model fixture validation

Phase A introduces read-model contracts (Commitment, Dependency, Improvement, Cycle) that are derived from existing task data. No new DB tables are added in Phase A.

### Phase A contracts (read-model-first)

The following contracts are added in Phase A (`packages/contracts/src/`):

- `commitment.ts`: CommitmentSchema, CommitmentCardSchema, CommitmentHorizonEnum
- `dependency.ts`: DependencySchema, DependencyCardSchema, DependencySummarySchema
- `improvement.ts`: ImprovementSchema, ImprovementCardSchema
- `cycle.ts`: CycleSchema, CycleCardSchema

These are read-model shapes - persistence is deferred to Phase B.

### Seed data requirements for Phase A

Seed data must support derivation of:

1. **Commitment horizons** (field app grouping):
   - `today`: Tasks due on anchor date
   - `this_week`: Tasks due within 7 days of anchor
   - `look_ahead`: Tasks due within 14 days after this_week
   - `past`: Tasks with due date before anchor (overdue)

2. **Technical review queue** (blocked/high-severity tasks):
   - Tasks with status `Blocked` or `Review`
   - Priority given to `Critical` and `High` severity

3. **Task dependency summaries**:
   - Persisted `task_dependencies` (Phase B+); API computes counts via `apps/api/src/lib/dependencies.ts` (`DependencySummarySchema` in `@v2e/contracts`).

### Phase A validation targets (enforced)

Implementation: `collectPhaseAMetrics` / `validatePhaseAFixtures` in `packages/database/src/demo-seed/phase-a-read-models.ts`

| Metric | Minimum | Purpose |
|--------|---------|---------|
| Tasks due today | 3 | Commitment horizon "today" |
| Tasks due this week | 5 | Commitment horizon "this_week" |
| Tasks due look-ahead | 4 | Commitment horizon "look_ahead" |
| Overdue/past tasks | 2 | Commitment horizon "past" |
| Blocked/review tasks | 4 | Technical review queue |
| High-severity blocked | 2 | Technical review priority |
| Critical tasks | 1 | Severity coverage |

### How existing seed config supports Phase A

The existing seed configuration (`config.ts`) already provides good coverage:

- `TASK_STATUS_RATIOS`: 20% Blocked, 30% Done, 50% In-progress
- `BLOCKED_OPEN_BUCKET_RATIOS`: Distributed across due date buckets
- `SEED_TARGETS.overduePct`: 10% overdue tasks

Phase A validation confirms this coverage is sufficient for read-model derivation.

### Task card dependency fields (Phase A)

TaskCardSchema includes dependency fields with stub defaults:

```typescript
dependencyCount: z.number().int().min(0).default(0),
blockedByCount: z.number().int().min(0).default(0),
blocksCount: z.number().int().min(0).default(0),
isDependencyBlocked: z.boolean().default(false),
```

In Phase A, these are always 0/false. Phase B will populate actual dependency counts.

## LLM content-generation findings

This section documents the current model-evaluation findings for the separate
content-generation pipeline. It does not change any seed validation rules.

### Separation of concerns

- `db:seed` stays deterministic and should not call the LLM by default.
- LLM wording generation runs as a separate compile step and persists per-batch
  output under `docs/demo/datasets/<contract>/generated-content/`.
- Each generated row should carry enough metadata to know which model and prompt
  version produced it.
- A generated batch is only valid if it returns the exact requested IDs with no
  missing, extra, or duplicate rows. Partial batch success must be rejected and
  retried; it must never publish incomplete overlays.

### Current quality findings

From the first-pass and strict small-batch tests:

- `nano-gpt-glm-5-thinking` is currently the strongest overall candidate.
  - best task-title discipline
  - strongest compliance with short action-oriented task titles
  - good description quality under stricter wording checks
- `nano-gpt-kimi-k2-5-thinking` remains strong, especially on update wording.
  - more natural note/update language
  - good candidate where field-report tone matters more than title precision
- `nano-gpt-minimax-m2-7` is useful for first-pass enrichment only.
  - improves generic source wording
  - not strong enough for strict final publish under tighter title/description rules

### Current wording tolerance

For the current construction content pass, title/description wording validation is
intentionally set to:

- title: `3-5` words
- description: `10-20` words
- title/description overlap: up to `3` shared words

The overlap tolerance was relaxed from `2` to `3` with explicit approval so
realistic phrases like `lift lobby reinforcement` are not rejected unnecessarily.

### Current working recommendation

- Prefer `nano-gpt-glm-5-thinking` as the default strict final-output model.
- Keep `nano-gpt-kimi-k2-5-thinking` in the evaluation set for update-heavy
  passes and side-by-side comparison.
- Do not use `nano-gpt-minimax-m2-7` as the final strict publish model unless
  prompt rules are relaxed.

### Per-project publish model policy

Using different publish models per demo contract is acceptable when done
intentionally and documented.

Current guidance:

- If the goal is one consistent voice across all construction demos, publish the
  same model for both projects.
- If the goal is to let the two demos have slightly different tones, it is
  acceptable to publish:
  - one project with `nano-gpt-glm-5-thinking`
  - the other with `nano-gpt-kimi-k2-5-thinking`
- If different models are used per project, record that choice in the generated
  content metadata and keep it stable for that contract so future reseeds do not
  silently switch style.
