---
last_changes: "Frontmatter refresh (pre-commit last_updated window)."
last_updated: "2026-03-27T03:56:00Z"
---

# ADR 0002: End-to-end tests use WebKit only

Date: 2026-03-27  
Status: Accepted

## Context

We want automated browser tests without maintaining three parallel browser matrices. Mobile-first targets (iOS WebKit-class engines) align with running E2E in WebKit locally and in CI.

## Decision

Playwright is configured with a **single project** using **Desktop Safari** (WebKit). We do not add Chromium or Firefox projects unless a future ADR changes this.

## Consequences

- **Faster** install (`playwright install webkit`) and less CI surface area.
- **Risk:** Chromium-only regressions are not caught by E2E; mitigate with unit/route tests and manual spot checks when needed.
- Developers run `pnpm test:e2e` against a running field app (`E2E_BASE_URL`) or rely on CI `webServer` when `CI` is set.
