# AI Extraction Review Page

## Purpose

Review AI assessment for a transcript note. The API may **automatically create a task** after extraction when confidence and required fields allow (hybrid bands). The page is **not** a full task-creation form: execution leads confirm review when required, correct **location** via the project location dropdown, open the linked task, re-run analysis, or create a **new** task from the task board.

## Screen preview

```
┌────────────────────────────────────────────────────────────┐
│ AI extraction    Confidence band · Open task (if any)     │
├────────────────────────────────────────────────────────────┤
│ AI confidence    [=========····]  Medium / High            │
│ AI assessment    Category · Severity · Dept · Location ▼  │
│                  Vendor · Role · Due · Description (read)   │
│ Risk (collapse)  Schedule · Effects · Actions             │
│ [ Confirm review ]  [ Re-analyze ]  [ New task (board) ]   │
└────────────────────────────────────────────────────────────┘
```

## Primary Data Inputs

- `updates.csv`
- `update_ai_outputs.csv`
- `update_risk_downstream_effects.csv`
- `update_risk_recommended_actions.csv`
- `tasks.csv` (when the server auto-creates or the user creates from the board)

## Page Layout

1. Header — AI extraction title (flow width; shared field-app / `Supervisor*` shell).
2. **AI confidence** — bar + band hint: manual follow-up / task + confirm / task + auto-clear review.
3. **AI assessment** — read-only fields; **Location** is a `<select>` over **`GET /v1/locations?projectId=...`** (PATCH update `locationId` when changed).
4. **Risk assessment** — collapsible (impact, schedule risk, lists).
5. Actions — **Open task** when `sourceTaskId` is present; **Confirm review** when `reviewRequirement.required` and not reviewed; **Re-analyze**; **New task (board)** → `/supervisor/tasks/new`.
6. **Escalation** — separate card when not already escalated.

## Server-side auto task (hybrid bands)

- **`V2E_LOW_CONFIDENCE_THRESHOLD`** (default `0.65`): below this, no automatic task from extraction.
- Between low and **`V2E_HIGH_CONFIDENCE_THRESHOLD`** (default `0.85`): auto-create task when department, description, owner resolution, and location validate; **execution lead review stays required** on the update until confirmed.
- **At or above** the high threshold: same auto-create rules; **review flags are cleared** on the AI output row (`reviewedAt` / `reviewedBy`) after task creation.

Idempotent `POST /v1/ai/voice-note-extraction` replies include `autoTaskOutcome` when applicable.

## Render Rules

- Category values must remain within `UpdateCategoryEnum` ([contracts](../../packages/contracts)).
- Tasks spawned from voice use `tasks.sourceUpdateId` ([update.md](../data-model/update.md)).
- `Review` is an update workflow state, not a task execution state ([workflow invariants](../data-model/invariants/updates-tasks-workflow-invariants.md)).
- `normalizeReviewRequirement` treats `taskProposalSuggested` as false once `reviewedAt` is set, so completed review does not re-trigger “new task proposed” in API responses.

## Validation Rules

- Location changes must use a valid project `locationId` (canonical locations).
- Client-initiated `POST /v1/tasks` (body includes `projectId`) with `sourceUpdateId` still returns **409** when `humanReviewRequired` is set and `reviewedAt` is null (server auto-create uses an internal path).
