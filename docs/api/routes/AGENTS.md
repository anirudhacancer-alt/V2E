# API routes (`docs/api/routes/`)

**Purpose:** One markdown file per **`/v1/<first-segment>`** (route parent), aligned with URLs and **`apps/api/src/routes/*.ts`**. Stack, auth, and AI boundaries: [`../overview.md`](../overview.md), [`../ai-runtime.md`](../ai-runtime.md).

**Shell:** [`v1.md`](v1.md) — routes on the `v1` app itself (`GET /v1`, `GET /v1/ping`, `GET /v1/debug/db-summary`). **Unversioned app:** [`root.md`](root.md).

## URL convention (pilot API)

- **Flat entity routes:** Persisted resources use **one path segment after `/v1`** (`/v1/commitments`, `/v1/cycles`, `/v1/attachments`, …). **Project scope** lives in **query params for GET** or **JSON body for POST/PATCH**.
- **Nested resource actions:** When an action targets one concrete resource, use **`/:id/<action>`** (`/v1/tasks/:taskId/review/submit`, `/v1/updates/:updateId/transcribe`, `/v1/standups/:standupId/open`).
- **AI jobs namespace:** One-shot AI commands that are not best modeled as CRUD live under **`/v1/ai/<job-name>`** (`/v1/ai/voice-note-extraction`, `/v1/ai/standup-summary`).
- **Project router:** **`/v1/projects`** is now limited to project CRUD and project-keyed read models that remain path-oriented.

## Canonical spec alignment

**Normative route catalog:** [`../../data-model/plans/NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md`](../../data-model/plans/NEW-DATA-MODELS-AND-ROUTES-REFERENCE.md) **§12** (HTTP surface) and **§17** (notification routes). Section **12** scores each path against `apps/api`; **⏸️** marks intentional deferrals (e.g. §12.1 `/v1/me`).

**When editing routes or these docs:**

1. Implement behavior in `apps/api/src/routes/` first; then update the **route-parent** `.md` here so the table matches the handler.
2. If the spec §12 path string differs from the code (path shape, not behavior), either adjust the implementation in agreement with product, **or** record the delta in the table below and (for non-trivial drift) add a line to [`../../../ISSUES.md`](../../../ISSUES.md).
3. Prefer linking entity behavior to [`../../data-model/`](../data-model/) pages, not phase-named filenames.

### Checked vs §12 / §17 (pilot API)

| Area | Spec section | Implementation files |
| ---- | ------------- | ---------------------- |
| Users, departments, roles, locations, sites, members | §12.2–§12.6 | `users.ts`, `departments.ts`, `roles.ts`, `locations.ts`, `sites.ts`, `members.ts` |
| Projects list/detail/CRUD | §12.7 | `projects.ts` |
| Updates list/get/patch, nested update commands | §12.8, §12.11 | `updates-router.ts`, `update-actions.ts` (second `/v1/updates` mount for get/detail/patch + update commands), `update-extraction.ts` (third `/v1/updates` mount for extraction subresource) |
| Unified attachments, nested extraction | §12.9–§12.10 | `attachments.ts`, `update-extraction.ts` |
| Tasks flat CRUD | §12.12 | `tasks-flat.ts` |
| Cycles, commitments | §12.14–§12.15 | `cycles.ts`, `commitments.ts` |
| Standup sessions, nested attendance, AI standup summary | §12.16–§12.18 | `standups.ts`, `ai-jobs.ts` |
| Task dependencies | §12.20 | `dependencies.ts` |
| Improvements | §12.21 | `improvements.ts` |
| Reviews | §12.22 | `task-reviews.ts`, `reviews.ts` |
| Audit | §12.23 | `audit.ts` |
| Files | §12.24 | `files.ts` |
| Pilot metrics / execution reliability | §12.25 | `metrics.ts` |
| Notifications | §17.0 | `notifications.ts` |

### Known path deltas (code vs §12 literal)

| Topic | Spec | Code |
| ----- | ----- | ----- |
| Create update | Older docs showed `/v1/projects/updates` | Canonical route is `POST /v1/updates` — [updates.md](updates.md). |
| Review queue | Older docs used a project-nested queue URL | Canonical route is `GET /v1/reviews?projectId=...` — [reviews.md](reviews.md). |
| Metrics | Older docs used a pre-cutover metrics parent or path params | Canonical routes are `/v1/metrics/reliability?projectId=...` and `/v1/metrics/pilot?projectId=...`. |
| Attachments | Older docs split task/update parents | Canonical routes are under `/v1/attachments` — [attachments.md](attachments.md). |
| AI commands | Older docs mixed update and standup AI into resource parents | Canonical one-shot AI jobs live under `/v1/ai` — [ai.md](ai.md). |

## Mount order (`apps/api/src/routes/v1.ts`)

Order matters for overlapping paths. Current sequence:

1. `projectsRouter` → `/v1/projects`
2. `dashboardRouter` → `/v1/dashboard`
3. `standupPrepRouter` → `/v1/standup-prep`
4. `aiJobsRouter` → `/v1/ai`
5. `reviewsRouter` → `/v1/reviews`
6. `updatesEntryRouter` → `/v1/updates`
7. `tasksFlatRouter` → `/v1/tasks`
8. `taskReviewsRouter` → `/v1/tasks`
9. `cyclesRouter` → `/v1/cycles`
10. `commitmentsRouter` → `/v1/commitments`
11. `dependenciesRouter` → `/v1/dependencies`
12. `improvementsRouter` → `/v1/improvements`
13. `metricsRouter` → `/v1/metrics`
14. `standupsRouter` → `/v1/standups`
15. `notificationsRouter` → `/v1/notifications`
16. `usersRouter`, `departmentsRouter`, `rolesRouter`, `locationsRouter`, `sitesRouter`, `membersRouter`
17. `filesRouter` → `/v1/files`
18. `attachmentsRouter` → `/v1/attachments`
19. `updateExtractionRouter` → `/v1/updates` (second mount; nested extraction routes — `update-extraction.ts`)
20. `auditRouter` → `/v1/audit`

## Index by route parent

| Route parent | Doc | Primary source file |
| ------------ | --- | --------------------- |
| `ai` | [ai.md](ai.md) | `ai-jobs.ts` |
| `attachments` | [attachments.md](attachments.md) | `attachments.ts` |
| `audit` | [audit.md](audit.md) | `audit.ts` |
| `commitments` | [commitments.md](commitments.md) | `commitments.ts` |
| `cycles` | [cycles.md](cycles.md) | `cycles.ts` |
| `departments` | [departments.md](departments.md) | `departments.ts` |
| `files` | [files.md](files.md) | `files.ts` |
| `improvements` | [improvements.md](improvements.md) | `improvements.ts` |
| `locations` | [locations.md](locations.md) | `locations.ts` |
| `members` | [members.md](members.md) | `members.ts` |
| `metrics` | [metrics.md](metrics.md) | `metrics.ts` |
| `notifications` | [notifications.md](notifications.md) | `notifications.ts` |
| `projects` | [projects.md](projects.md) | `projects.ts` |
| `reviews` | [reviews.md](reviews.md) | `reviews.ts` |
| `roles` | [roles.md](roles.md) | `roles.ts` |
| `sites` | [sites.md](sites.md) | `sites.ts` |
| `standups` | [standups.md](standups.md) | `standups.ts` |
| `dependencies` | [dependencies.md](dependencies.md) | `dependencies.ts` |
| `tasks` | [tasks.md](tasks.md) | `tasks-flat.ts`, `task-reviews.ts` |
| `updates` | [updates.md](updates.md) | `updates-router.ts`, `update-actions.ts`, `update-extraction.ts` |
| `users` | [users.md](users.md) | `users.ts` |

Parent: [`../AGENTS.md`](../AGENTS.md).
