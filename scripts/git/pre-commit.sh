#!/usr/bin/env bash
# Invoked only from .husky/pre-commit — see scripts/git/README.md
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "${SCRIPT_DIR}/pre-commit-staged-lfs.sh"
bash "${SCRIPT_DIR}/check-docs-agent-entry-files.sh"
pnpm check:agents-md-contract
pnpm docs:tree:check
pnpm check:markdown-frontmatter
pnpm check:contracts-boundary
pnpm check:route-structure-invariant
pnpm exec turbo run typecheck
