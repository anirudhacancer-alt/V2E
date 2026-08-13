---
last_changes: "Frontmatter refresh (pre-commit last_updated window)."
last_updated: "2026-03-27T15:32:00Z"
---

# ADR 0006: AI extraction and review workflow

Date: 2026-03-27  
Status: Accepted

## Context

Voice updates need **structured extraction** (assignments, severity, risk) and optional **task creation** with review gates. Provider calls must not sprawl inside `apps/api`; the product already standardizes on **`packages/ai`** + **`ai-gateway`**.

## Decision

1. **Runtime:** Implement orchestration in **`packages/ai`** (TypeScript). **`apps/api`** calls `packages/ai`, not cloud SDKs directly.
2. **Gateway:** Use **`ai-gateway`** for provider routing, credentials, and model endpoints; align model IDs with `providers.yaml` as the catalog.
3. **Persistence:** Persist extraction to `update_ai_outputs` and risk child tables; support review metadata (`humanReviewRequired`, `reviewPrompt`, `reviewReasonsJson`, `suggestedSnapshotJson`).
4. **Hybrid auto-task:** After `POST /v1/ai/voice-note-extraction`, the API may call **`applyPostExtractionAutoTask`** (`apps/api/src/lib/extraction-auto-task.ts`) when confidence and required fields allow:
   - **Below `V2E_LOW_CONFIDENCE_THRESHOLD`** (default **0.65**): no auto-task; extraction stands for manual review.
   - **Between low and high thresholds:** auto-create task if valid; **medium** band keeps review flags on `update_ai_outputs` until cleared.
   - **At or above `V2E_HIGH_CONFIDENCE_THRESHOLD`** (default **0.85**): auto-create task if valid; **high** band may clear review metadata after creation.
5. **Idempotency:** `sourceUpdateId` on tasks and checks in `applyPostExtractionAutoTask` prevent duplicate auto-tasks for the same update.

## Consequences

- Single place to change confidence thresholds: **`apps/api/src/env.js`** (`LOW_CONFIDENCE_THRESHOLD`, `HIGH_CONFIDENCE_THRESHOLD`).
- Evaluation harnesses and labeled datasets remain **out of band** (offline) but should align with these thresholds.
- See **`docs/api/ai-runtime.md`**, **`docs/api/routes/updates.md`**, and **`docs/data-model/invariants/updates-tasks-workflow-invariants.md`** for operational detail.

## Related

- `docs/data-model/update.md` (**Updates ↔ tasks (canonical)**)
- ADR `0005` (Bearer auth on mutating routes)
