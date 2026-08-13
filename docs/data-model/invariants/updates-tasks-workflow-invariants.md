# Updates and Tasks Workflow Invariants

This document defines the product invariants for how **execution-lead review of updates** relates to **task lifecycle states**.

It exists to prevent future drift between:

- API route behavior
- UI labels and filters
- task seeding assumptions
- review semantics for AI-generated work

## Core model

There are **two different state machines**:

1. **Update workflow state**
   - answers: "What should the execution lead do with this note?"
2. **Task lifecycle state**
   - answers: "What is the state of the task in the system?"

They are related, but they are **not the same state machine**.

## Task Status Lifecycle

Tasks progress through the following canonical statuses:

- **`Review`** — AI-created task awaiting execution-lead confirmation (initial state for voice/AI extraction)
- **`New`** — Human-created task or AI task that has been approved (backlog/triage state)
- **`Planned`** — Task scheduled with start/end dates in an upcoming sprint
- **`In-progress`** — Work is actively being executed on site (renamed from `Active`)
- **`Blocked`** — Work is blocked for some reason (dependency, material delay, etc.)
- **`Done`** — Work is completed

Note: `Overdue` is derived from `dueDate`, not stored.

### Status Transitions

**AI/Voice Path:**
```
Review → New → Planned → In-progress → Blocked/Done
     ↓
   (execution-lead approval moves to New)
```

**Human Path:**
```
New → Planned → In-progress → Blocked/Done
```

## Invariants

### 1. `Review` is dual-purpose

`Review` serves two contexts:

1. **Update-level queue state** — the execution lead still needs to confirm the AI extraction or task proposal
2. **Task-level state** — AI-created tasks start in `Review` status and remain there until execution-lead approval

A task with `status: "Review"`:
- Was created via AI/voice extraction (`sourceUpdateId` is set)
- Has not yet been approved by an execution lead
- May still have an associated update in the Updates queue requiring confirmation

### 2. Task lifecycle state evolves independently of update queue state

Tasks use the full lifecycle: `Review`, `New`, `Planned`, `In-progress`, `Blocked`, `Done`.

A task linked to a note in the Updates `Review` queue may be:
- `Review` (just created, awaiting approval)
- `New` (approved but not yet planned)
- `Planned` (scheduled for upcoming sprint)
- `In-progress` / `Blocked` (work underway)

That is valid product behavior.

### 3. A review note may reference a task already in execution

When the Updates screen shows:

- note state = `Review`
- linked task status = `In-progress` / `Blocked`

that means:

- the **note / extraction** still needs execution-lead confirmation
- the **work item** already exists and is being tracked in the lifecycle model

Those two facts can coexist.

### 4. Human review is required in exactly these scenarios

AI should ask for execution-lead review when either of these is true:

- **Low-confidence extraction**
  - the AI is not confident it interpreted the note correctly
- **New task proposed**
  - the AI proposes creating a new task from the note

These are the canonical review triggers.

**Escalation UX:** The extraction/review flows may **recommend escalation** when AI marks **Critical** severity or **High/Critical** schedule risk. That is a **product escalation path** (e.g. `POST /v1/updates/:updateId/escalate`) and does not replace the two review triggers above—it routes urgent items for explicit follow-up.

### 5. Task status `Review` is distinct from update queue `Review`

While both use the name "Review", they represent different concepts:

- **Task status `Review`** — The task itself was AI-created and hasn't been approved yet
- **Update queue `Review`** — The execution lead needs to confirm the AI extraction or task proposal

A task can move from `Review` → `New` without the associated update leaving the Updates `Review` queue if the execution lead approved the task creation but there's still extraction metadata to confirm.

### 6. Update queue state must not silently change task counts

Task counts on:

- Home / dashboard
- Tasks page
- Standup prep

should be driven by **task lifecycle state**, not by whether the source update is still in the Updates `Review` queue.

If product ever wants review-pending tasks excluded from counts, that must be an explicit product rule and backend invariant change.

### 7. `Linked` and `Review` are not opposites of "task exists" vs "no task exists"

The presence of a task alone does not determine the update queue bucket.

- `Linked` means a human follow-up note references an older existing task via `updates.linkedTaskId`
- `Review` means the note still needs execution-lead confirmation
- a voice/AI note can have `sourceUpdateId` on a task and still remain in `Review`

### 8. UI copy must make the review intent explicit

Whenever the Updates screen shows a note in `Review`, the copy should describe **what needs confirmation**, for example:

- extraction needs confirmation
- task proposal needs confirmation
- low-confidence AI result needs confirmation

Avoid copy that implies the linked task itself is not real or not yet in execution unless that is explicitly true.

Preferred review copy should make the pending action explicit, for example:

- `Confirm: AI extraction`
- `Confirm: AI extraction or task proposal`

### 9. Demo and seed sources must persist the review ask explicitly

The review ask should not live only in UI heuristics.

Demo/source bundles, seed inputs, and future persistence should carry structured review metadata such as:

- `reviewRequired`
- `reviewPrompt`
- `reviewReasons`
- `reviewFields`

If an item appears in the `Review` queue and has AI output, the data source should already say what the execution lead must confirm.

## Recommended interpretation for current product

Use this mental model:

- **Updates / Review** = "confirm the AI understanding or task proposal"
- **Tasks / Review|New|Planned|In-progress|Blocked** = "track the task through its lifecycle"

This means a card can correctly read:

- `Review` (update queue)
- `Task from note: Procurement action #73`
- `In-progress` (task status)
- `Confirm: AI extraction or task proposal`

That combination is intentional, not contradictory.

### 10. Auto-created tasks and review bands

When the API **auto-creates** a task after extraction (`tasks.sourceUpdateId` set):

- **Medium band** (confidence between low and high thresholds): the task is created with `status: "Review"`, but the update may still require **execution-lead confirmation** (`humanReviewRequired` / `reviewRequirement`) until the confirm-review flow runs.
- **High band**: the API may create the task with `status: "New"` or clear review metadata on `update_ai_outputs` after creation so the note no longer presents a pending AI review.

`deriveNoteState` for **Linked** vs **Review** is unchanged: voice-spawned tasks alone do not move a note to **Linked**; see [update entity doc](../update.md) (**Updates ↔ tasks (canonical)**).

Thresholds: `V2E_LOW_CONFIDENCE_THRESHOLD` (default **0.65**), `V2E_HIGH_CONFIDENCE_THRESHOLD` (default **0.85**) in `apps/api/src/env.ts`; implementation `apps/api/src/lib/extraction-auto-task.ts`.

### 11. Queue bucket semantics (Updates page — target)

Field-app **Updates** should converge on **queue buckets** (**Review**, **Linked**, **Escalated**, **Blocked**) that combine status, AI flags, and linkage—not a 1:1 mapping to raw `updates.status` strings alone. Server-side bucketing should stay aligned with **Home** metrics.

Formal decision: [`docs/architecture/adr/0007-queue-based-update-filtering.md`](../../architecture/adr/0007-queue-based-update-filtering.md).

## Zod enums (where defined)

| Concept | Export / field | Source | Entity doc |
| ------- | -------------- | ------ | ---------- |
| Task lifecycle | `TaskStatusEnum` | [`enums.ts`](../../../packages/contracts/src/enums.ts) | [task.md](../task.md) |
| Persisted update row | `UpdateSchema.status` | [`update.ts`](../../../packages/contracts/src/update.ts) | [update.md](../update.md) |
| Field-app list queue | `NoteStateEnum` (`Review`, `Linked`, `Escalated`) | [`api-responses.ts`](../../../packages/contracts/src/api-responses.ts) | List DTO `noteState`; not the same string as raw `updates.status` alone |
| AI review | `ReviewReasonEnum`, `ReviewFieldEnum` | [`update.ts`](../../../packages/contracts/src/update.ts) | [update.md](../update.md) |

## Related docs

- [Update entity (updates ↔ tasks)](../update.md)
- [AI Extraction Review Page](../../field-app/ai-extraction-review.md)
- [Task Board Page](../../field-app/task-board.md)
- [Standup Page](../../field-app/standup.md)
- [ADR 0006 — AI extraction and review workflow](../../architecture/adr/0006-ai-extraction-and-review-workflow.md)
- [ADR 0007 — Queue-based field-app updates](../../architecture/adr/0007-queue-based-update-filtering.md)
