---
status: accepted
date: 2026-03-27
deciders: platform, api, frontend
tags: api, routes, http, invariant
last_changes: "GET filters in query; POST/PATCH inputs in body; nested actions on resources; AI jobs under /v1/ai/<job-name>"
last_updated: "2026-03-27T15:32:00Z"
---

# ADR 0011: Route Structure Invariant - HTTP Parameter Semantics

## Context

As part of migrating from nested project-scoped routes (`/v1/projects/:projectId/*`) to flat entity routes (`/v1/*`), we need consistent rules for how parameters are passed to the API.

## Decision

We adopt the following invariants for all API routes:

### Invariant 1: Read vs Write Parameter Location

- **GET** requests: Filtering and scoping parameters go in **query parameters**.
- **POST/PUT/PATCH** requests: Request payload data goes in the **request body**.
- GET request content is not part of this API contract and must not be used for scoping or filtering.

### Invariant 2: Standard REST Collections

Use standard REST collection patterns where the unique ID is sufficient for single-item operations:

**Collection routes** (filtering via query params):
- `GET /v1/tasks?projectId=...` — list with filters
- `POST /v1/tasks` — create (projectId in body)

**Single-item routes** (ID in path, no extra scoping needed):
- `GET /v1/tasks/:taskId`
- `PATCH /v1/tasks/:taskId`
- `DELETE /v1/tasks/:taskId`

Authorization is handled server-side based on the authenticated user's access to the resource.

**Resource-scoped actions** use nested paths; identifiers that are not already in the path (e.g. `projectId` for scope checks) go in the JSON body:
- `POST /v1/updates/:updateId/transcribe` with `{ projectId }` in body
- `POST /v1/tasks/:taskId/review/approve` with `{ projectId, ... }` in body

**Dedicated AI jobs** (not modeled as CRUD on a first-class resource) use `POST /v1/ai/<job-name>`:
- `POST /v1/ai/voice-note-extraction` with `{ updateId, projectId }`
- `POST /v1/ai/standup-summary` with `{ projectId }`

### Invariant 3: Platform Rule for Writes

In this platform, POST/PUT/PATCH requests do not use query parameters for application inputs; those inputs belong in the request body.

This ensures:
1. Adherence to HTTP semantics (GET content has no defined semantics per RFC 9110; write methods carry payloads in body)
2. Consistent flat route structure across all entities
3. Clear separation between read operations (query params) and write operations (body)
4. No ambiguity about parameter location

## Consequences

### Positive
- Clear, predictable API contract
- Follows HTTP semantics naturally
- Easy to document and test
- No ambiguity about where parameters go

### Negative
- Requires frontend to handle two different patterns for the same conceptual filter
- Some GET requests may have long URLs with multiple query parameters

## Examples

### GET - List (Query Parameters for filtering)

```http
GET /v1/dashboard?projectId=80758045-06d4-4b96-a81a-67e12f360d8a
GET /v1/tasks?projectId=80758045-06d4-4b96-a81a-67e12f360d8a&status=Active
GET /v1/commitments?projectId=80758045-06d4-4b96-a81a-67e12f360d8a&status=planned
```

### Standard Collection - Single Item by ID

```http
GET    /v1/tasks/:taskId
PATCH  /v1/tasks/:taskId
DELETE /v1/tasks/:taskId
```

The unique ID in the path identifies the resource. Authorization is server-side.

### POST - Create Resource (JSON Body)

```http
POST /v1/commitments
Content-Type: application/json

{
  "projectId": "80758045-06d4-4b96-a81a-67e12f360d8a",
  "title": "Complete foundation work",
  "ownerId": "..."
}
```

### POST - Nested resource action

```http
POST /v1/updates/abc123/transcribe
Content-Type: application/json

{
  "projectId": "80758045-06d4-4b96-a81a-67e12f360d8a"
}
```

### POST - Task review command

```http
POST /v1/tasks/def456/review/approve
Content-Type: application/json

{
  "projectId": "80758045-06d4-4b96-a81a-67e12f360d8a",
  "approvedBy": "user-1",
  "notes": "Approved after site inspection"
}
```

### POST - AI job (not resource CRUD)

```http
POST /v1/ai/voice-note-extraction
Content-Type: application/json

{
  "updateId": "abc123",
  "projectId": "80758045-06d4-4b96-a81a-67e12f360d8a"
}
```

### ❌ WRONG - Mutation inputs in query string

```http
# DO NOT DO THIS - query params for mutation inputs
POST /v1/updates/abc123/transcribe?projectId=...
```

## Migration Guide

When moving from nested to flat routes:

| Old (Nested) | New (Flat) |
|-------------|-----------|
| `GET /v1/projects/:id/dashboard` | `GET /v1/dashboard?projectId=:id` |
| `POST /v1/projects/:id/commitments` | `POST /v1/commitments` (body) |
| `GET /v1/projects/:id/standup-prep` | `GET /v1/standup-prep?projectId=:id` |

## Enforcement

This invariant is **machine-enforced** end-to-end:

1. **Automated script** — `scripts/check/route-structure-invariant.mjs` parses all TypeScript route files via AST/regex signals and fails if any of the three invariants are violated.
2. **Auto-generated inventory** — the same script writes `ROUTE-INVENTORY.md` at the repo root on every run; the file must never be edited manually.
3. **Pre-commit hook** — `pnpm check:route-structure-invariant` runs as part of `scripts/git/pre-commit.sh`, blocking commits that violate the rules.
4. **Pre-push hook** — `pnpm test` (Vitest) runs route-level unit tests that exercise the refactored flat-route contracts.

## References

- [ROUTE-INVENTORY.md](../../../../ROUTE-INVENTORY.md) (auto-generated, repo root)
- `scripts/check/route-structure-invariant.mjs` (enforcer + inventory generator)
- [v1.ts route mounting](../../apps/api/src/routes/v1.ts)
