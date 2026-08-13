#!/usr/bin/env bash
# Invoked only from .husky/pre-push — see scripts/git/README.md
set -euo pipefail

command -v git-lfs >/dev/null 2>&1 || {
  printf >&2 "\n%s\n\n" "This repository uses Git LFS but 'git-lfs' was not found on your PATH."
  exit 2
}
git lfs pre-push "$@"
pnpm exec vitest run
pnpm exec playwright test
