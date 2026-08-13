# Phase 5 — Technical review and blockers

## Goal

Support **technical review** gates and a dedicated **blocker** workspace for escalation and aging.

**Prerequisite:** Phase 2+ (review queue) should be complete for shared patterns.

## What ships

### Technical review workspace

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (384px)    │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │             │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │             │
│  │  ───────────────  │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │    Review Queue   │  │                                                  │             │
│  │    Tasks          │  │  [ Technical review ]           [filters]     │             │
│  │    Commitments    │  │  ─────────────────────────────────────────────│             │
│  │  ▶ Tech Review   │  │                                                  │             │
│  │    Blockers       │  │  ┌──────────────────────────────────────────────┐│             │
│  │    Standup        │  │  │  TECHNICAL REVIEW QUEUE (spec / plan)      ││             │
│  │    Schedule       │  │  │  Same split layout as Phase 2               ││             │
│  │  ──────────────    │  │  │  ─────────────────────                     ││             │
│  │    Reports        │  │  │  [spec review items / plan reviews]         ││             │
│  │    Admin          │  │  └──────────────────────────────────────────────┘│             │
│  └───────────────────┘  │                                                  │             │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Blocker workspace

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  LEFT RAIL (256px)     │              TOP BAR (56px)                    │ RIGHT PANEL │
│                         │                                                  │  (384px)    │
│  ┌───────────────────┐  │  ┌──────────────────┐ ┌──────┐ ┌──────┐ ┌────┐ │             │
│  │  V2E Planning     │  │  │ 🔍 Search...     │ │Saved │ │Filter│ │User│ │             │
│  │  ───────────────  │  │  └──────────────────┘ └──────┘ └──────┘ └────┘ │             │
│  │    Review Queue   │  │                                                  │             │
│  │    Tasks          │  │  [ Blockers ]    [All ◀ ▼] [Sev ◀ ▼]            │             │
│  │    Commitments    │  │  ─────────────────────────────────────────────│             │
│  │    Tech Review    │  │                                                  │             │
│  │  ▶ Blockers       │  │  ┌──────────────────────────────────────────────┐│             │
│  │    Standup        │  │  │ ## Aging Summary                           ││             │
│  │    Schedule       │  │  │ 24h+  ████░░░░░░░░░░░░░  4 blockers       ││             │
│  │  ──────────────    │  │  │ 48h+  ██░░░░░░░░░░░░░░░  2 blockers       ││             │
│  │    Reports        │  │  │ 72h+  █░░░░░░░░░░░░░░░░  1 blocker        ││             │
│  │    Admin          │  │  └──────────────────────────────────────────────┘│             │
│  └───────────────────┘  │  │                                              ││             │
│                          │  │  ## Blocker List                             ││             │
│  [workspace context]    │  │  ┌──────────────────────────────────────┐    ││             │
│                          │  │  │ 🚨 Pending electrical permit        │    ││             │
│                          │  │  │    Sev: Critical  ·  52h old       │    ││             │
│                          │  │  │    Owner: @SAR  ·  Gate: Permit     │    ││             │
│                          │  │  └──────────────────────────────────────┘    ││             │
│                          │  │  ┌──────────────────────────────────────┐    ││             │
│                          │  │  │ ⚠️ Awaiting equipment delivery     │    ││             │
│                          │  │  │    Sev: High  ·  28h old           │    ││             │
│                          │  │  └──────────────────────────────────────┘    ││             │
│                          │  └──────────────────────────────────────────────┘│             │
└──────────────────────────┴─────────────────────────────────────────────────┴─────────────┘
```

### Blocker detail panel

```
┌─────────────────────────────────────┐
│  ✕  Blocker Detail          [Edit]  │
│  ─────────────────────────────────  │
│                                     │
│  🚨 Pending electrical permit       │
│  Critical · 52h old                 │
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Severity  │ Critical         │ │
│  │ Age        │ 52h              │ │
│  │ Owner      │ @SAR             │ │
│  │ Gate       │ Permit           │ │
│  │ Task       │ T-0042           │ │
│  └───────────────────────────────┘ │
│                                     │
│  ─────────────────────────────────  │
│  ## Description                    │
│  Electrical permit still pending   │
│  from city inspector. Cannot start │
│  wiring work until approved.      │
│                                     │
│  ─────────────────────────────────  │
│  ## Escalation Path                │
│  1. @SAR (owner)                   │
│  2. @PM (project manager)          │
│  3. @GM (general manager)          │
│                                     │
│  ─────────────────────────────────  │
│  ## Linked Task                    │
│  [T-0042: Install electrical panel]│
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [Escalate]         [Resolve ✓]   │
└─────────────────────────────────────┘
```

### Aging summary widget

```
┌─────────────────────────────────────┐
│  ## Blocker Aging                   │
│                                     │
│  24h+  ████████████░░░░░░  4       │  ← progress bar
│  48h+  ██████░░░░░░░░░░░  2       │
│  72h+  ████░░░░░░░░░░░░░  1       │
│  1w+   ░░░░░░░░░░░░░░░░  0       │
│                                     │
│  Total: 7 active blockers          │
└─────────────────────────────────────┘
```

## Components built in this phase

### Technical review components

| Component | File | Description |
|-----------|------|-------------|
| `TechnicalReviewPage` | `technical-review/technical-review-page.tsx` | Main technical review workspace |
| `TechnicalReviewList` | `technical-review/technical-review-list.tsx` | List of review items |
| `TechnicalReviewItemCard` | `technical-review/technical-review-item-card.tsx` | Spec/plan review item card |
| `TechnicalReviewDetailPanel` | `technical-review/technical-review-detail-panel.tsx` | Review item detail |

Note: Technical review reuses Phase 2 review queue patterns but with different data types (spec reviews vs field updates). Queue data: **`GET /v1/reviews?projectId=...`** ([`reviews.md`](../../../api/routes/reviews.md)).

### Blocker components

| Component | File | Description |
|-----------|------|-------------|
| `BlockersPage` | `blockers/blockers-page.tsx` | Main blockers workspace |
| `BlockersList` | `blockers/blockers-list.tsx` | Scrollable list of blocker cards |
| `BlockerCard` | `blockers/blocker-card.tsx` | Single blocker card with severity + age |
| `BlockerDetailPanel` | `blockers/blocker-detail-panel.tsx` | Full blocker detail |
| `BlockerAgingSummary` | `blockers/blocker-aging-summary.tsx` | Aging histogram widget |
| `BlockerEscalationPath` | `blockers/blocker-escalation-path.tsx` | Escalation chain display |
| `BlockerFilters` | `blockers/blocker-filters.tsx` | Severity, age range, owner filters |
| `NewBlockerDialog` | `blockers/new-blocker-dialog.tsx` | Create blocker modal |
| `BlockerLinkedTask` | `blockers/blocker-linked-task.tsx` | Linked task preview |

### Severity badge variants

Uses `PlanningBadge` with `--color-planning-amber` for high/critical, `--color-surface-brand` for medium.

## Key data entities

| Entity | Source | Notes |
|--------|--------|-------|
| `ReviewItem` | `@v2e/contracts` | Technical review items (spec/plan reviews) |
| `Blocker` | `@v2e/contracts` | Blocker entity |
| `ImprovementAction` | `@v2e/contracts` | DMAIC improvement items (if surfaced) |
| `User` | `@v2e/contracts` | Owner, assignee |

## Routes

```
/console/technical-review              → TechnicalReviewPage
/console/technical-review/:itemId     → Same with item selected
/console/blockers                      → BlockersPage
/console/blockers/:blockerId           → Same with blocker selected
```

## Design token usage

| Token | Applied where |
|-------|--------------|
| `--color-planning-violet` | Technical review badge background |
| `--color-planning-violet-subtle` | Technical review badge text |
| `--color-planning-amber` | Critical/high severity |
| `--color-surface-error` | Critical severity (alert style) |
| `planning-material-badge-sla` | SLA-related badges |
| Aging bars | `planning-progress-bar` tinted amber→red by age |

## Empty and error states

| State | Component | Shown when |
|-------|-----------|------------|
| No blockers | `PlanningEmptyState` | Blocker list is empty |
| No review items | `PlanningEmptyState` | Tech review queue is empty |
| Loading | `PlanningSkeleton` | API fetching |

## Exit criteria

1. Blocker list shows all blockers with severity, age, owner
2. Aging summary shows count per age bucket (24h+, 48h+, 72h+)
3. Clicking a blocker opens detail in right panel
4. Escalation path is visible in blocker detail
5. Filter by severity and age range works
6. "Resolve" button marks blocker resolved (mock or API)
7. "Escalate" button triggers escalation flow (mock or API)
8. Tech review workspace mirrors Phase 2 review queue layout

## Out of scope

- Full DMAIC improvement loop UI (documented but not built)
- Actual API persistence for resolution/escalation (mock handlers)
- Push notifications for escalation

## Dependencies

- Phase 2 (review queue) complete for shared patterns
- Phase 0 (components) complete
- `@v2e/contracts` for `Blocker`, `ReviewItem`, `Severity` types
- TanStack Query for data fetching

## Files created in this phase

```
apps/planning-web/src/routes/console/
├── technical-review.tsx              # Technical review route
└── blockers.tsx                     # Blockers route
└── blockers.$blockerId.tsx          # Blocker detail route

apps/planning-web/src/components/planning/
├── technical-review/
│   ├── technical-review-page.tsx
│   ├── technical-review-list.tsx
│   ├── technical-review-item-card.tsx
│   └── technical-review-detail-panel.tsx
└── blockers/
    ├── blockers-page.tsx
    ├── blockers-list.tsx
    ├── blocker-card.tsx
    ├── blocker-detail-panel.tsx
    ├── blocker-aging-summary.tsx
    ├── blocker-escalation-path.tsx
    ├── blocker-filters.tsx
    ├── new-blocker-dialog.tsx
    └── blocker-linked-task.tsx
```

Parent: [`AGENTS.md`](AGENTS.md).
