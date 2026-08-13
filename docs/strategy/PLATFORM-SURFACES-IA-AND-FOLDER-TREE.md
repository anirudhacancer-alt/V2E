---
last_changes: "Planning console IA: /console/technical-review routes and folder tree naming."
last_updated: "2026-03-27T15:32:00Z"
---

# Platform Surfaces: Information Architecture and Folder Tree

Date: 2026-03-26  
Status: Proposed (exact IA + repo structure)

## Product Decision (Locked)

One product platform, three frontend surfaces:

1. **Field App** (mobile-first execution)
2. **Planning Console** (desktop-first coordination)
3. **Marketing Site** (public website + demand generation)

Shared across all three (where relevant):
- Backend/API
- Contracts/domain model
- Permissions and workflow states
- AI extraction/review logic
- **Enact UI** as the upstream design system (`@enact-ui/*` packages)—each surface applies its **own** theme/flavour and **does not** share app-level React components with the others (see [`docs/field-app/web-ui-enact-ui.md`](../field-app/web-ui-enact-ui.md#independent-surface-uis-locked))

**Field App + mobile:** one execution UI (`apps/field-app`; `apps/mobile` wraps the same build)—shared shell, field-app UI components (`components/supervisor/*`), and Enact UI usage.

**Planning Console** and **Marketing Site:** separate apps with independent page/component trees; they consume Enact UI primitives only, not each other’s or the field app’s components.

Note: The **Marketing Site** should be a separate app with mostly public routes and limited/no operational domain UI. It should not mirror operational product IA.

---

## 1) Exact Information Architecture (Side by Side)

## Global object model (shared)

Primary entities used by operational surfaces (Field App + Planning Console):
- `Task`
- `Update` (voice/text/photo update)
- `ReviewItem` (AI extraction/review queue item)
- `Blocker`
- `Commitment` (standup/planning commitment with target horizon)
- `StandupPrepItem`
- `StandupSession` (workflow/read-model instance; not required as a new persisted DB table initially)
- `WorkCycle` (sprint/week execution window)
- `ImprovementItem` (DMAIC action and control item)
- `Project`, `Team`, `Location`, `User`

Same entities everywhere; presentation and interaction differ by surface.

Primary system outcome:
- **Execution reliability** (not only capture volume or task count)

---

## Role perspectives (operational surfaces)

The same platform should expose role-tuned views, not separate products:

- **Execution lead / plant manager:** daily standup owner, prioritization, blocker resolution
- **Department / discipline lead:** team-level execution, quality checks, technical review, escalations
- **Frontline worker / operator / sales rep:** capture evidence, execute assigned actions, close tasks

Execution model is hierarchical:
- Team standup -> Department/area standup -> Site/plant standup
- Structured outputs from each layer roll up to the next layer

---

## Language strategy

Internal language (product/ops design):
- backlog, sprint/cycle, commitment reliability, DMAIC

External language (customer-facing):
- daily plan, weekly commitments, action board, blocker review, recovery plan, shift handover

---

## Expansion archetypes and tiers

Expansion should follow frontline execution archetypes, not generic industry labels.

Archetypes:
- **Shift-based operations** (factory, warehouse, healthcare ops, logistics hubs)
- **Field execution** (construction, utilities, maintenance, facilities)
- **Visit-based execution** (retail/RGM, inspections, audits, NGO field programs)
- **Incident/exception-driven operations** (quality, EHS, venue/hospitality ops)

Priority tiers:
- **Tier 1:** construction, factory/plant ops, warehouse/logistics, facilities/property ops
- **Tier 2:** retail/RGM, venue operations, hospitality ops, utilities/field service
- **Tier 3:** healthcare operations, NGO/humanitarian programs, public field programs

Rule:
- Keep one operating model and ship vertical workflow packs with domain language overlays.

---

## Field App IA (Mobile + Tablet)

### IA intent
- **Capture and action in <30 seconds**
- Minimize navigation depth
- Keep context local to user + current project/site

### Primary nav (bottom tabs)
1. **Today**
2. **Capture**
3. **Queue**
4. **Blockers**
5. **Standup**

### Screen map

#### 1. Today
- My tasks due today
- My commitments due today
- Assigned blockers needing action
- Team highlights (lightweight)
- Quick actions:
  - Start capture
  - Mark task complete
  - Escalate blocker

#### 1b. This Week / Look-ahead
- Weekly commitments by owner and due date
- Carry-over risk and late-risk indicators
- Items likely to impact standup and escalations

#### 2. Capture (primary CTA flow)
- Step 1: Record voice / add text / attach photos
- Step 2: Transcript review
- Step 3: AI suggestion review
- Step 4: Confirm task(s) and assign basic metadata
- Step 5: Submit update

#### 3. Queue
- Personal review queue (AI items awaiting approval)
- Lightweight filters:
  - Project
  - Status
  - Priority
- Bulk actions intentionally limited on phone

#### 4. Blockers
- Open blockers by urgency
- Escalation actions:
  - Assign owner
  - Add note
  - Mark resolved
- Fast communication actions (call/message link-outs if needed)

#### 5. Standup
- Auto-generated prep list for today
- Quick reorder / mark discussed
- Quick convert note -> task/update
- Role mode switch:
  - Team member view (my commitments)
  - Standup owner view (team agenda + blockers)
- Standup sections:
  - Yesterday completed
  - Today committed
  - Blockers
  - Escalations
  - Carry-overs

### Tablet adaptations (same IA, richer layout)
- Split-view mode:
  - Left: list/queue
  - Right: details/editor
- Side-by-side transcript + extracted tasks in Capture and Queue
- Retains same route structure for mental model continuity

---

## Planning Console IA (Desktop Web)

### IA intent
- **Compare, coordinate, and plan across many items**
- Information density and persistent controls
- Multi-item operations and cross-project visibility

### App shell layout
- **Left rail (persistent):** global navigation + workspace selector
- **Top bar:** global search, date range, saved views, alerts, user menu
- **Main workspace:** table/board/timeline views
- **Right details panel (persistent drawer):** selected item details and actions

### Primary navigation (left rail)
1. **Review Queue**
2. **Tasks**
3. **Blockers**
4. **Standup Prep**
5. **Schedule**
6. **Reports**
7. **Admin**

### Screen map

#### 1. Review Queue (default landing)
- AI extracted items awaiting human decision
- Views:
  - Table (default)
  - Split review
- Core columns:
  - Source update, project, assignee role, severity, confidence, created at
- Bulk actions:
  - Approve
  - Reject
  - Reassign
  - Set priority/location

#### 2. Tasks
- Multi-view task workspace:
  - Table (default)
  - Board (status lanes + drag-and-drop)
  - Timeline (date/dependency view)
- Persistent filters:
  - Project, team, location, assignee, priority, status, due date
- Bulk actions:
  - Assign owner
  - Change status/priority
  - Set due date
  - Add to standup agenda

Board lanes (default):
- `Backlog`
- `In Progress`
- `Blocked`
- `Done`

Sprint/planning support:
- `WorkCycle` selector (weekly/bi-weekly)
- Commitment tracking (planned vs completed)
- Carry-over visibility for continuous improvement reviews

Technical review mode:
- Plan/spec-linked issue queue
- Technical clarification and markup
- Approve/rework gates before closure

#### 3. Blockers
- Escalation and resolution workspace
- Views:
  - Severity queue
  - Aging view
  - Owner view
- Actions:
  - Escalate path
  - SLA tracking
  - Dependency linking to tasks

#### 4. Standup Prep
- Team/project standup preparation
- Inputs:
  - Open tasks
  - Critical blockers
  - Recent updates
- Outputs:
  - Standup agenda by team/location
  - Follow-up items

#### 5. Schedule
- Timeline and dependency management
- Views:
  - Gantt-like timeline
  - Milestone risk panel
- Actions:
  - Shift dates
  - Identify risk collisions
  - Flag critical path impacts

#### 6. Reports
- Operational trend analysis
- Prebuilt dashboards:
  - Throughput
  - Blocker aging
  - SLA attainment
  - Team productivity indicators
  - Sprint commitment reliability
  - WIP aging and flow efficiency
  - DMAIC improvement impact trends

#### 7. Admin
- Team/project/location configuration
- Roles and permissions
- Workflow/state config (guardrailed)

---

## Marketing Site IA (Public Web)

### IA intent
- Explain value clearly and fast
- Drive qualified pipeline (demo requests / trials)
- Build trust with proof (outcomes, security, reliability)
- Present one platform with three launch packs (factory, construction, field sales/retail)

### Global nav
1. **Product**
2. **Launch Packs**
3. **Customers**
4. **Pricing**
5. **Resources**
6. **Company**
7. **Sign in** (to app)
8. **Primary CTA** — use **Join launch list** / **Design partner** on the homepage draft; **Book demo** remains a strong secondary conversion path (align copy per page).

### Marketing CTA note

Homepage copy may emphasize **Join the launch list** and **Become a design partner** (see `MARKETING-WEBSITE-HOMEPAGE-SECTIONS.md` in this repo). Global nav can still expose **Book demo** where appropriate; document dual CTAs in analytics as separate events.

### Screen map

#### 1. Home
- Positioning and value proposition
- Hero with clear CTA
- Three launch-pack section (factory first, then construction and field sales/retail)
- One shared execution engine section
- Trust bar (logos/compliance)
- Execution reliability outcomes section
- Roadmap section (`Now`, `Q2 2026`, `Next`)
- Final CTA block

#### 2. Product
- Platform overview
- Side-by-side surface story:
  - Field App (capture/execution)
  - Planning Console (coordination/planning)
- AI workflow explainer (capture -> extraction -> review -> execution)

#### 3. Solutions
- Factory Execution Pack
- Construction Execution Pack
- Field Sales/Retail Execution Pack
- Optional vertical expansion pages by archetype/tier

#### 4. Customers
- Case studies
- Metrics/outcomes
- Testimonial proof

#### 5. Pricing
- Plan tiers
- Feature matrix
- FAQ
- Procurement/contact CTA

#### 6. Resources
- Blog/articles
- Guides/playbooks
- Release notes and product updates

#### 7. Company
- About
- Careers
- Contact
- Security/Trust center links

#### 8. Conversion flows
- Book demo form
- Contact sales form
- Newsletter capture

---

## 2) Side-by-side functional mapping

| Capability | Field App | Planning Console | Marketing Site |
|---|---|---|---|
| Primary objective | Fast onsite execution | Multi-item planning/coordination | Demand generation + trust + conversion |
| Create/review work | Primary | Secondary + bulk | None |
| Task operations | Personal/team slice | Cross-team/project workspace | None |
| Reporting | Lightweight personal snapshot | Full operational analytics | Product/value storytelling only |
| Access model | Authenticated app users | Authenticated app users | Public + conversion endpoints |
| Success metric | Time-to-action and completion | Throughput, SLA, planning quality | Demo requests, qualified leads, activation |

---

## 3) Recommended route structure (exact)

## Field App routes

- `/field/today`
- `/field/look-ahead`
- `/field/capture/new`
- `/field/capture/:draftId/review`
- `/field/queue`
- `/field/queue/:itemId`
- `/field/blockers`
- `/field/blockers/:blockerId`
- `/field/standup`
- `/field/standup/:sessionId`
- `/field/profile`

## Planning Console routes

- `/console/review-queue`
- `/console/review-queue/:itemId`
- `/console/tasks`
- `/console/tasks/board`
- `/console/tasks/timeline`
- `/console/tasks/:taskId`
- `/console/commitments`
- `/console/technical-review`
- `/console/technical-review/:itemId`
- `/console/blockers`
- `/console/blockers/:blockerId`
- `/console/standup`
- `/console/standup/:sessionId`
- `/console/schedule`
- `/console/reports`
- `/console/admin/projects`
- `/console/admin/teams`
- `/console/admin/locations`
- `/console/admin/roles`

## Marketing Site routes

- `/`
- `/product`
- `/launch-packs`
- `/launch-packs/factory`
- `/launch-packs/construction`
- `/launch-packs/field-sales-retail`
- `/customers`
- `/customers/:caseStudySlug`
- `/pricing`
- `/resources`
- `/resources/:articleSlug`
- `/company`
- `/security`
- `/book-demo`
- `/design-partner`
- `/contact`
- `/signin` (handoff to product auth)

---

## 3A) Current monorepo layout (today)

The repository **contains**:

- **`apps/api`** — Hono API (`@v2e/api`)
- **`apps/field-app`** — Field App / field app UI (`@v2e/field-app`): React/Vite, TanStack Router, mobile-first layout; also the web bundle consumed by Capacitor
- **`apps/mobile`** — Capacitor shell (`@v2e/mobile`); native iOS/Android load `../field-app/dist` after build + sync
- **`apps/planning-web`** — Placeholder Vite shell (`@v2e/planning-web`, port 3002) for the future Planning Console desktop UI
- **`apps/marketing-site`** — Placeholder Vite shell (`@v2e/marketing-site`, port 3003) for the future public marketing site

Shared packages under **`packages/`** (e.g. `contracts`, `database`, `ai`, `shared`) as today.

**§4** below still describes an **aspirational** internal layout (`src/app/`, `src/routes/...` per surface). The **on-disk app folders** above are the current split; product routes and feature folders inside `planning-web` / `marketing-site` remain to be built. See **§5** for migration notes.

---

## 4) Target folder tree (aspirational monorepo)

This keeps one backend + one domain model + three frontend surfaces. The diagram describes the **end state** to build toward, not necessarily what exists on disk yet.

```text
voice-to-execution/
├── apps/
│   ├── api/                            # existing Hono API
│   │   └── src/
│   │       ├── routes/
│   │       ├── services/
│   │       └── index.ts
│   │
│   ├── marketing-site/                 # new: public marketing website
│   │   ├── src/
│   │   │   ├── app/                    # marketing shell/layout/seo
│   │   │   ├── routes/
│   │   │   │   ├── product/
│   │   │   │   ├── solutions/
│   │   │   │   ├── customers/
│   │   │   │   ├── pricing/
│   │   │   │   ├── resources/
│   │   │   │   ├── company/
│   │   │   │   └── conversion/         # book-demo/contact forms
│   │   │   ├── features/
│   │   │   │   ├── homepage/
│   │   │   │   ├── case-studies/
│   │   │   │   ├── pricing/
│   │   │   │   ├── blog/
│   │   │   │   └── lead-capture/
│   │   │   ├── components/
│   │   │   │   ├── marketing/
│   │   │   │   └── shared/
│   │   │   ├── content/                # md/mdx/cms adapters
│   │   │   └── lib/
│   │   └── public/
│   │
│   ├── field-app/                      # new: mobile/tablet surface
│   │   ├── src/
│   │   │   ├── app/                    # app shell, providers, navigation
│   │   │   ├── routes/
│   │   │   │   ├── today/
│   │   │   │   ├── capture/
│   │   │   │   ├── queue/
│   │   │   │   ├── blockers/
│   │   │   │   ├── standup/
│   │   │   │   ├── look-ahead/
│   │   │   │   └── cycles/
│   │   │   ├── features/
│   │   │   │   ├── capture/
│   │   │   │   ├── transcript-review/
│   │   │   │   ├── review-queue/
│   │   │   │   ├── blockers/
│   │   │   │   ├── standup-prep/
│   │   │   │   └── role-modes/
│   │   │   ├── components/
│   │   │   │   ├── mobile/
│   │   │   │   └── shared/
│   │   │   └── lib/
│   │   └── capacitor/                  # optional mobile wrapper
│   │
│   └── planning-web/                   # new: desktop planning console
│       ├── src/
│       │   ├── app/                    # desktop shell (left rail/top bar/right panel)
│       │   ├── routes/
│       │   │   ├── review-queue/
│       │   │   ├── tasks/
│       │   │   ├── commitments/
│       │   │   ├── technical-review/
│       │   │   ├── blockers/
│       │   │   ├── standup/
│       │   │   ├── cycles/
│       │   │   ├── schedule/
│       │   │   ├── reports/
│       │   │   └── admin/
│       │   ├── features/
│       │   │   ├── queue-workspace/
│       │   │   ├── task-workspace/
│       │   │   ├── commitment-workspace/
│       │   │   ├── technical-review-workspace/
│       │   │   ├── sprint-board/
│       │   │   ├── blocker-workspace/
│       │   │   ├── improvement-loop/
│       │   │   ├── schedule-workspace/
│       │   │   └── reports/
│       │   ├── components/
│       │   │   ├── desktop/
│       │   │   └── shared/
│       │   └── lib/
│       └── public/
│
├── packages/
│   ├── contracts/                      # existing: canonical schemas/types
│   ├── database/                       # existing: Drizzle + SQLite
│   ├── ai/                             # existing: extraction/AI logic
│   ├── shared/                         # existing: utility helpers
│   │
│   ├── ui-system/                      # optional (not current): do not use for cross-surface React sharing
│   │   ├── src/
│   │   │   ├── tokens/
│   │   │   ├── icons/
│   │   │   ├── mobile-primitives/
│   │   │   ├── desktop-primitives/
│   │   │   └── composables/
│   │   └── package.json
│   │
│   └── features/                       # optional shared business hooks/services
│       ├── src/
│       │   ├── tasks/
│       │   ├── commitments/
│       │   ├── queue/
│       │   ├── technical-review/
│       │   ├── blockers/
│       │   ├── standup/
│       │   ├── cycles/
│       │   └── improvement/
│       └── package.json
│
├── docs/
│   ├── architecture/
│   └── plans/
│
└── turbo.json
```

---

## 5) Migration path from current setup

Current state uses `apps/field-app` as a blended responsive surface.  
Recommended transition:

1. Keep `apps/api`, `packages/contracts`, `packages/database` as-is.
2. Split frontend into:
   - `apps/field-app` (capture/execution focus)
   - `apps/planning-web` (planning workspace focus)
   - `apps/marketing-site` (public narrative + conversion)
3. Keep `apps/marketing-site` operationally isolated from app internals:
   - only public content APIs and lead-capture endpoints
   - no direct operational workflow UI
4. Move shared feature logic into `packages/features` (optional but recommended).
5. Keep each surface’s **visual system** grounded in Enact UI with **independent** app-level composition—do **not** introduce a shared `packages/ui-system` across field, planning, and marketing unless an ADR explicitly adds it.

This avoids a backend split while allowing each surface to optimize for its core job and its own UI flavour.

### Deferred: splitting `apps/field-app` (separate PR)

Renaming or splitting **`apps/field-app`** into **`apps/field-app`** and **`apps/planning-web`**, and adding **`apps/marketing-site`**, is **not** a simple `git mv`: it requires Turbo/Vite/package names, env, CI, and import updates. Track that work as its own change set after docs and contracts are stable; do not mix it with low-risk documentation-only moves.

---

## 6) Acceptance criteria for this architecture

- A field user can complete update capture + review in <= 30 seconds.
- A planner can triage 20+ queue items without changing pages repeatedly.
- Desktop has persistent filters, multi-select, and right-side details.
- Desktop board supports drag-drop between `Backlog`, `In Progress`, `Blocked`, `Done`.
- Team/department/site standup rollups are supported through role-based views.
- Mobile keeps one-thumb primary actions and limited cognitive load.
- Department-lead and technical-review workflows are first-class (not limited to the field app).
- Commitments are trackable across `Today`, `This Week`, and `Look-ahead` horizons.
- Standup sessions are first-class workflow objects (agenda, blockers, carry-overs, escalations).
- Marketing site communicates value in <60 seconds and drives demo conversion.
- Marketing, planning, and field surfaces remain **separate app shells** with **no cross-app React component sharing**; brand alignment comes from Enact UI and product copy, not shared app component packages.
- Domain model and workflow states remain identical across product surfaces (contracts/API).

---

## 7) Implementation companion and repo hygiene

For exact object schemas, dependency model, and API/backend upgrade path, see:

- `AGILE-EXECUTION-DATA-MODEL.md` (same directory as this file)

Related operational docs (monorepo hygiene and workstreams):

- `docs/strategy/WORKSTREAM-DOCS-FRAMEWORK.md` — three parallel workstreams (marketing, planning app, demo packs)
- `docs/common/important-code-roots.json` — manifest for the generated code index
- `docs/common/IMPORTANT-CODE-TREE.md` — auto-generated important code tree (`pnpm docs:tree:update`)
- `CHANGELOG.md` — notable repo and process changes
