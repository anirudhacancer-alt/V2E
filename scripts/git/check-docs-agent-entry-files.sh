#!/usr/bin/env bash
# Reject README.md (except allowlisted ADR index) and INDEX.md under docs/.
# Agent-facing folder entry points must be AGENTS.md — rename offending files.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

if [[ ! -d docs ]]; then
  exit 0
fi

ALLOWED_README="docs/architecture/adr/README.md"
FAILED=0

while IFS= read -r -d '' f; do
  rel="${f#"${ROOT}/"}"
  if [[ "$rel" == "$ALLOWED_README" ]]; then
    continue
  fi
  echo "check-docs-agent-entry: rename ${rel} to AGENTS.md in the same folder (merge into existing AGENTS.md if needed). The only README.md allowed under docs/ is docs/architecture/adr/README.md." >&2
  FAILED=1
done < <(find docs -name README.md -type f -print0 2>/dev/null || true)

while IFS= read -r -d '' f; do
  rel="${f#"${ROOT}/"}"
  echo "check-docs-agent-entry: rename ${rel} to AGENTS.md in the same folder (merge into existing AGENTS.md if needed). INDEX.md is not used under docs/." >&2
  FAILED=1
done < <(find docs -name INDEX.md -type f -print0 2>/dev/null || true)

if [[ "$FAILED" -ne 0 ]]; then
  echo "check-docs-agent-entry: content contract for AGENTS.md (what belongs / what to avoid): docs/AGENTS.md#what-belongs-in-agentsmd" >&2
fi

exit "$FAILED"
