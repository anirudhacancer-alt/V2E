# Demo: Daily standup and risk (contract **1330**)

**Duration:** ~5–7 minutes  
**Dataset:** `docs/demo/datasets/COM-1330/`  
**Story:** Show how standup rolls up attendance, planned/completed/blocked work, and links blockers to underlying tasks and update-level risk.

## Audience outcome

Viewers understand: standup as the operational hub → blocked items tied to tasks → severity and reasons → optional trace into updates and AI risk fields.

## Fixed anchors


| Concept                     | Example value                                                                                       | Source file                 |
| --------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------- |
| Site                        | Shared site UUID with 1328 bundle (`sites.csv` in 1330 folder)                                      | `sites.csv`                 |
| Project (contract 1330)     | `80758045-06d4-4b96-a81a-67e12f360d8a`                                                              | `projects.csv`              |
| Standup (first row)         | `0170398b-4206-43da-90b1-bda76b6f598e`                                                              | `standups.csv`              |
| Blocked task (DB `status` = `Blocked`) | e.g. id `f0f626a0-498f-4af4-a5e6-53eae606c13b` (`Finishing action #2`) | `tasks.csv` |


## Step-by-step (narration)

1. **Set context**
  - Switch contract/project to **1330** (project UUID above).  
  - Mention pilot rationale from [docs/common/AGENTS.md](../../common/AGENTS.md) (secondary regression dataset, strong forms coverage).
2. **Standup screen** ([standup.md](../../field-app/standup.md))
  - Open standup `0170398b-4206-43da-90b1-bda76b6f598e`.  
  - Walk through **attendance** stats on parent row + `standup_attendance_records.csv` / `attendances.csv`.  
  - Explain that **planned / completed / blocked** lists are **derived from `tasks.csv`** for the standup date (see [standup-prep-from-tasks](../standup-prep-from-tasks.md)); there are no separate line-item CSVs.
3. **Blocked → task**
  - Pick a task with `status` = `Blocked` (e.g. `f0f626a0-498f-4af4-a5e6-53eae606c13b`); show severity and description as the blocker narrative.  
  - Navigate to that task on the task board; show owner, location.
4. **Risk narrative**
  - Pick an update that fed risk text (optional: any update with downstream effects in `update_risk_downstream_effects.csv`).  
  - Connect **standup blocker severity** to **task severity** and, if demoing AI, to `update_ai_outputs` / risk child rows.
5. **Close**
  - Summarize: “Standup is where blockers surface; tasks and updates explain *why*.”

## Fallback if the app is not built

- Filter `standups.csv` by `projectId` = `80758045-06d4-4b96-a81a-67e12f360d8a`.  
- Filter `tasks.csv` by the same `projectId`; use `status === "Blocked"` for blocker examples; align planned/completed with standup **date** using UTC day rules in [standup-prep-from-tasks](../standup-prep-from-tasks.md).  
- Show `attendanceRate` and summary text on `standups.csv` parent rows.

## Expected questions

- **Why two attendance tables?** Validator assembles `Standup.attendance` from `standup_attendance_records.csv` and also validates `attendances.csv` for `AttendanceSchema`—both exist in the bundle design.  
- **1330 vs 1328:** Same site, different `projectId`; use bundle folder + `projects.csv` to avoid mixing rows in demos.
