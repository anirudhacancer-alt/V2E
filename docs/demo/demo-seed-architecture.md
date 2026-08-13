# Multi-Domain Demo Seed Architecture

Date: 2026-03-25

## Purpose

This document defines how the demo seed system should evolve from a construction-only demo bundle into a reusable demo engine that can support other industries later, for example an FMCG chocolate factory.

The goal is not to make the current demo abstract for abstraction’s sake. The goal is:

- keep the current construction demo believable
- make the seed model modular enough that a new domain can be added without rewriting the whole pipeline

## Core Principle

The seed engine should stay generic.

The domain realism should live in domain packs.

That means:

- the engine owns time, ratios, validation, materialization, and relational consistency
- the domain pack owns vocabulary, roles, departments, locations, scenarios, and review rules

The LLM, when used, should sit behind the domain pack as a controlled content generator for descriptive fields only.

## Current Seed Pipeline

Today the seeding flow is already split into sensible layers:

1. `packages/database/src/seed.ts`
   - bootstraps SQLite
   - clears tables
   - loads bundles
   - materializes relative data
   - validates
   - persists
2. `packages/database/src/demo-seed/csv-bundle.ts`
   - loads shared master CSVs and per-project bundle CSVs
3. `packages/database/src/demo-seed/materialize.ts`
   - anchors dates to today
   - distributes task/update states
   - derives review prompts and review metadata
   - applies org and department mappings
4. `packages/database/src/demo-seed/validate.ts`
   - validates counts, recency, review metadata, and location links
5. `docs/demo/tools/validate_demo_datasets.mjs`
   - validates the source CSV bundles before seed

This is a strong base. The next improvement is to separate generic seed mechanics from domain vocabulary.

## Minimal Cross-Domain Seed Model

Every future demo pack should define the same five building blocks.

### 1. Locations

Master data, hierarchical, domain-specific.

Construction examples:

- tower
- podium
- level
- wing
- lobby

Chocolate factory examples:

- plant
- production block
- processing hall
- packaging line
- cold room
- warehouse
- utilities yard

### 2. Work Items

This is the domain-neutral replacement for “task”.

The database can keep the `tasks` table, but the seed engine should treat it as a generic work-item model with domain-specific labeling.

Examples:

- construction: snag closeout, pour clearance, material delivery follow-up
- factory: line stoppage fix, CIP verification, packing material shortage, QA release

### 3. Updates

An update is always an observation, report, or event captured from the field.

The update workflow can stay generic:

- `Review`
- `Linked`
- `Escalated`

But the domain pack must define:

- event categories
- uncertainty triggers
- escalation patterns
- field language

### 4. Organization

The domain pack must define:

- departments
- org roles
- specialty labels
- reporting lines
- responsibility ownership

This is where future RASCI should plug in.

### 5. Validation

Each domain pack must declare:

- vocabulary bans
- minimum recent activity
- required review cases
- required blocker/escalation cases
- required current-week planning patterns

## Recommended Domain-Pack Shape

For each demo domain, create a domain pack that includes:

### Master data

- `departments.csv`
- `role_types.csv`
- `locations.csv`
- future:
  - `responsibility_matrix.csv`
  - `team_structure.csv`

### Scenario catalogs

- task title templates
- update summary templates
- transcript templates
- blocker reasons
- escalation reasons
- review prompt rules

### LLM prompt specs

- task-generation prompt
- update-generation prompt
- transcript-generation prompt if separated
- JSON schemas for each batch response
- vocabulary bans and must-use terminology
- style rules by site type / domain

### Distribution config

- task lifecycle ratios
- recency ratios
- this-week planning expectations
- minimum same-day attention items

### Validation rules

- banned phrases
- required phrases
- location/department consistency rules
- role/owner consistency rules

## Recommended Architecture Layers

### Layer 1. Generic seed engine

This layer should remain stable across domains.

Responsibilities:

- load CSV bundles
- resolve IDs
- anchor dates relative to seed day
- assign lifecycle and recency buckets
- enforce ratios
- persist to SQLite
- run validation

### Layer 2. Domain pack

This layer should vary by demo type.

Responsibilities:

- define departments
- define roles
- define locations
- define scenario language
- define review semantics
- define validation vocabulary

### Layer 2A. Batch content generation

This should be a controlled sub-layer between structured seed materialization and final persistence.

Responsibilities:

- take structured seed skeletons as input
- call an LLM in batches
- fill descriptive text fields only
- validate JSON output shape
- reject low-quality or non-compliant responses
- support regeneration of specific batches

### Layer 3. Presentation vocabulary

This layer converts structured data into user-facing text.

Responsibilities:

- short task titles
- update card summaries
- transcript snippets
- review prompts
- dashboard labels

This should not be ad hoc inside seed scripts. It should be driven by the domain pack.

## Recommended LLM Usage Model

Use a two-step batch generation flow.

### Step 1. Task generation

Code should first build task skeletons with:

- task ID
- project/domain
- site type
- department
- owner role
- severity
- lifecycle state
- due bucket
- location
- scenario type

Then the LLM generates only:

- `title`
- `description`

### Step 2. Update and transcript generation

After tasks exist, code should build update skeletons that explicitly reference:

- related task ID
- related task title
- task lifecycle state
- timing bucket
- department
- location
- update category
- review requirement
- escalation state

Then the LLM generates only:

- update summary/body
- transcript text
- optional explicit confirmation wording if needed

This order matters. Updates should be downstream of tasks, not generated independently.

## Why This Split Is Correct

The model is good at:

- phrasing
- variation
- domain tone
- concise descriptive language

The model is bad at:

- exact ratios
- date math
- deterministic linkage
- hard constraints across hundreds of rows

So the correct architecture is:

- code controls structure
- LLM controls wording

## Batch Generation Guidance

Recommended operating pattern:

- generate `20` tasks per batch
- generate `20` updates per batch
- validate each batch immediately
- rerun only failed or weak batches

This keeps generation cheap, auditable, and easy to tune.

## Batch Prompt Inputs

Every LLM batch should receive:

- domain pack name
- site type
- terminology rules
- banned vocabulary
- JSON output schema
- examples of acceptable outputs
- the structured batch rows to enrich

For update generation, the prompt must also receive the related task context.

## Batch Prompt Constraints

Prompts should explicitly forbid:

- inventing IDs
- changing statuses
- changing dates
- changing locations
- changing roles
- changing linkage between tasks and updates
- introducing cross-domain vocabulary

Prompts should explicitly require:

- concise, realistic wording
- correct site-type terminology
- correct department terminology
- correct relationship to the provided task
- explicit review ask wording when review is required

## Construction Pack Model

The current construction demo should become the first proper domain pack.

Suggested pack dimensions:

- `ConstructionResidential`
- `ConstructionCommercial`

Shared:

- core task lifecycle
- update review model
- org-role model
- validation framework

Different:

- location taxonomy
- scenario catalogs
- department weighting by site type
- vocabulary packs

## Future Chocolate Factory Pack

The future FMCG chocolate factory demo should not be hacked into the construction language.

It should become a separate domain pack, for example:

- `FactoryFMCGChocolate`

That pack would define:

### Location taxonomy

- `Plant 1`
- `Raw Material Store`
- `Mixing Hall`
- `Conching Line`
- `Moulding Line`
- `Cooling Tunnel`
- `Packaging Hall`
- `Finished Goods Warehouse`
- `Utilities Block`
- `Boiler Room`
- `QA Lab`

### Departments

- `Production`
- `Packaging`
- `Maintenance`
- `Utilities`
- `Quality`
- `Warehouse`
- `Planning`
- `Procurement`
- `Safety`

### Roles

- `PlantManager`
- `ShiftSupervisor`
- `LineSupervisor`
- `QualityLead`
- `MaintenanceEngineer`
- `Operator`
- `Technician`
- `Storekeeper`

### Work patterns

- line stoppage
- quality hold
- material shortage
- preventive maintenance
- dispatch delay
- sanitation/CIP issue

### Review triggers

- low-confidence extraction
- ambiguous line or asset
- new action proposal
- unclear shift ownership
- ambiguous quality impact

The engine should not need a rewrite for this. Only the domain pack should change.

## Current Schema State

The schema is moving in the right direction, but it is not fully canonical yet.

### Strong pieces already in place

- `locations` master table exists
- `departments` master table exists
- `role_types` master table exists
- `tasks`, `updates`, and `update_ai_outputs` now carry `locationId`
- review metadata is structured on `update_ai_outputs`
- task lifecycle supports more than just `Active`, `Blocked`, `Done`

### Transitional pieces still visible

- operational tables still store `department`, `orgRole`, `specialty`, `role`, `ownerRole`, and `assigneeRole` as strings instead of master-data IDs
- runtime creation paths are not yet fully aligned to the same discipline as seeded data
- the seed config has not yet fully normalized around the expanded task lifecycle

So the architecture is good enough to keep iterating, but not yet finished enough to call the model canonical.

## Recommended Next Critical Work

### 1. Make master data authoritative

Move from “master data plus duplicated strings” toward “master data plus resolved display fields”.

Priority targets:

- departments
- role types
- future responsibility templates

### 2. Introduce responsibility master data

If the seed is going to support RASCI later, do not hardcode ownership in scenario templates forever.

Recommended future master:

- `responsibility_matrix.csv`

Possible columns:

```csv
id,domain,department,workType,siteType,responsibleRole,accountableRole,supportingRoles,consultedRoles,informedRoles,isActive
```

This should drive:

- default task owners
- escalation targets
- standup grouping
- review routing

### 3. Separate scenario catalogs from row generation

The current seed still contains too much content logic inline.

Next step:

- scenario catalog files per domain/site type
- seed engine chooses scenarios by bucket
- row materialization fills dates, ownership, and linkage
- LLM batch generation fills only descriptive fields

### 4. Add content-quality validation

Current validation is strong structurally. It needs a second layer for vocabulary quality.

Examples:

- ban imported PM-system strings
- ban enum-shaped transcript phrasing
- enforce domain vocabulary presence
- enforce site-type vocabulary separation

### 5. Add post-seed DB audit

CSV validation is not enough because runtime-created data can drift.

A future `db:audit-demo` should validate the actual SQLite output:

- location links
- role/department consistency
- update-task linkage
- review metadata integrity
- current-week attention items

## Seed Requirements for Any New Demo Domain

To onboard a new domain quickly, the seed requirements should stay simple.

Every new domain pack should provide:

1. locations
2. departments
3. roles and reporting model
4. work-item scenario catalog
5. update/transcript scenario catalog
6. review rules
7. responsibility mapping
8. validation vocabulary and recent-activity thresholds
9. prompt specs for task/update batch generation

If those inputs exist, the seed engine should be able to generate a believable demo.

## Recommended Rollout

### Phase 1. Finish construction properly

- tighten Residential and Commercial language
- make current seed content believable
- add construction-specific content validation

### Phase 2. Canonicalize organization and responsibility

- make master data authoritative
- add responsibility matrix
- reduce legacy string duplication

### Phase 3. Package the domain model

- create explicit domain-pack boundaries
- move construction into pack-driven content generation

### Phase 4. Prove portability

- create a new pack for FMCG chocolate factory
- do not change the core engine
- validate that only pack data and scenario catalogs changed

## Definition of Success

The seed architecture is ready when:

- construction demos feel native to construction customers
- new domains can be added without rewriting seed internals
- validations protect both structure and vocabulary quality
- roles, locations, review logic, and ownership are all pack-driven
- a future chocolate factory demo is a new pack, not a construction fork
