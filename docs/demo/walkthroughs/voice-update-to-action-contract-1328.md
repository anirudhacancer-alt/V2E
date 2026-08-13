# Demo: Voice update → action (contract **1328**)

**Duration:** ~5–7 minutes  
**Dataset:** `docs/demo/datasets/RES-1328/`  
**Story:** Show how a voice-derived update moves through review, AI structuring, and onto the task board with full traceability.

## Audience outcome

Viewers understand: transcript quality gate → structured extraction → task creation → board visibility → link back to source update.

## Fixed anchors (for scripts and QA)


| Concept                        | Example value                              | Source file                                                        |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------ |
| Site                           | `b8b4c52e-a249-4496-9fd4-00999c79a4a3`     | `sites.csv`                                                        |
| Project (contract 1328)        | `5c9006de-c2bd-4624-b3ab-33c1b3a9bc68`     | `projects.csv`                                                     |
| Update (processed, has AI row) | `cdb049aa-dd82-4eaf-a433-b5852215d11f`     | `updates.csv`                                                      |
| Task linked to that update     | `656655a8-86ff-4723-a3d5-c6efd206df64`     | `tasks.csv` (`sourceUpdateId` = update id, `source` = VoiceUpdate) |
| AI output row                  | same `updateId` in `update_ai_outputs.csv` | flattened AI fields                                                |


## Step-by-step (narration)

1. **Home dashboard** ([home-dashboard.md](../../field-app/home-dashboard.md))
  - Scope UI to **project 1328** / project UUID above.  
  - Call out cards driven by `tasks.csv`, `updates.csv`, `standups.csv`, and blocked items as specified in MVP docs.
2. **Task board** ([task-board.md](../../field-app/task-board.md))
  - Filter **Blocked** or **All**.  
  - Open task **Carpentry action #2** (`656655a8-86ff-4723-a3d5-c6efd206df64`).  
  - Point to severity, trade, location, owner, and **source** = VoiceUpdate.
3. **Traceability**
  - From the task, show **source update** `cdb049aa-dd82-4eaf-a433-b5852215d11f` (or navigate from updates feed if implemented).  
  - Open `update_ai_outputs.csv` row for that `updateId` and mention confidence, category, and risk lists assembled from child CSVs.
4. **Record flow** ([record-update.md](../../field-app/record-update.md) → [transcript-review.md](../../field-app/transcript-review.md) → [ai-extraction-review.md](../../field-app/ai-extraction-review.md))
  - *If live recording is not available:* walk through the **same IDs** as if a new update were saved, then “Process with AI,” then “Create task” vs “Save as update.”  
  - Status rules: see aligned copy in page specs (`Saved` without AI; `Processed` after AI save-without-task; `ConvertedToTask` after task create).
5. **Close**
  - Return to board; show the new or existing task in the correct swimlane.  
  - One-line value: “Every board card can be traced to a voice update and AI extraction when applicable.”

## Fallback if the app is not built

- Open `tasks.csv` and `updates.csv` in an editor or spreadsheet; filter `sourceUpdateId` = `cdb049aa-dd82-4eaf-a433-b5852215d11f`.  
- Show `update_ai_outputs.csv` for the same `updateId`.  
- This still tells a credible data story for investors or design reviews.

## Expected questions

- **Is projectId on every row?** Yes for `updates.csv` and `tasks.csv` in generated bundles.  
- **What about Manual tasks?** Present in data (`source` = Manual); clarify they are not voice-sourced but share the same board.
