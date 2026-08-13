---
last_changes: "Frontmatter refresh (pre-commit last_updated window)."
last_updated: "2026-03-27T03:56:00Z"
---

# ADR 0005: Bearer token authentication pattern (pilot API)

Date: 2026-03-27  
Status: Accepted

## Context

The demo API exposes read routes for the field app UI without auth, but **mutating** routes (uploads, transcription, extraction, task create/update, escalation, etc.) must not be open on the public internet. The team needed a **lightweight** shared secret before a full `auth-service` exists.

## Decision

1. **Server:** `apps/api` validates `Authorization: Bearer <token>` on mutating routes against **`V2E_API_TOKEN`** (see `apps/api/src/middleware/auth.ts`). Default **`dev-token`** for local development.
2. **Client:** `apps/field-app` sends the token on mutations via **`VITE_API_TOKEN`**, defaulting to match **`dev-token`** when unset (`apps/field-app/src/lib/api.ts`).
3. **Scope:** Pilot/internal only; production must set strong tokens and HTTPS.
4. **Future:** Centralized auth (JWT, `auth-service`) is documented in deployment plans; this pattern is a **bridge**, not the final identity model.

## Consequences

- Simple to configure for demos and device testing (Tailscale, staging).
- No per-user identity in the API from this token alone—**actor** fields in audit payloads may still use demo user IDs.
- Documentation must keep env var names (`V2E_API_TOKEN`, `VITE_API_TOKEN`) stable for client/server parity.

## Related

- `docs/api/overview.md`
- `docs/api/routes/AGENTS.md`
