# Entity: Standup AI summary

**Table:** `project_standup_ai_summaries`  
**Schema:** [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (`projectStandupAiSummaries`)

## Purpose

**Storage note:** The field app standup brief uses **`POST /v1/ai/standup-summary`** — a **one-shot** AI response with **no HTTP-persisted summary** for that flow.

This table may still hold **demo seed** or legacy rows. It is **not** exposed as a public HTTP resource in the current API; do not document consumer flows against `GET`/`POST` routes for this table unless a future feature reintroduces them explicitly.

## Fields

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `projectId` | text | primaryKey | FK to `projects.id` (one row per project) |
| `id` | text | notNull | UUID of the summary record |
| `summaryDate` | text | notNull | UTC calendar day `YYYY-MM-DD` |
| `summaryText` | text | notNull | Generated summary text |
| `modelUsed` | text | notNull | AI model identifier used |
| `updatedAt` | text | notNull | Timestamp of last update |

## Notes

- Distinct from **standup prep lists**, which are **read models** from `tasks` (see [`../field-app/standup-prep-from-tasks.md`](../field-app/standup-prep-from-tasks.md)).

## Enums

No fixed enum for `modelUsed` or `summaryText`—**`modelUsed`** is a provider/model identifier string from the AI runtime.

## See also

- [index.md](./index.md)
- [update.md](./update.md) (standup prep read model context)
