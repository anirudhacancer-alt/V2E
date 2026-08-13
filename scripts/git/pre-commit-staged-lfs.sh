#!/usr/bin/env bash
# Staged-file checks (Git LFS CSV pointers + size cap). Called from scripts/git/pre-commit.sh.
set -euo pipefail

max_size_bytes=$((10 * 1024 * 1024))

blocked=0

while IFS= read -r -d '' path; do
  lower_path=$(printf '%s' "$path" | tr '[:upper:]' '[:lower:]')

  case "$lower_path" in
    *.csv)
      # CSV is tracked via Git LFS (.gitattributes). Staged content must be an LFS pointer,
      # not a raw large CSV (avoids accidental commits without LFS).
      first_line=""
      if git rev-parse --verify --quiet ":$path" >/dev/null; then
        first_line=$(git show ":$path" 2>/dev/null | head -n 1 || true)
      fi
      if [[ "$first_line" != "version https://git-lfs.github.com/spec/v1" ]]; then
        echo "pre-commit: blocking staged CSV (not a Git LFS pointer): $path"
        echo "pre-commit: ensure Git LFS is installed and run: git lfs install && git add $path"
        blocked=1
      fi
      ;;
  esac

  if git rev-parse --verify --quiet ":$path" >/dev/null; then
    size=$(git cat-file -s ":$path")
    if [ "$size" -gt "$max_size_bytes" ]; then
      size_mb=$(awk "BEGIN { printf \"%.2f\", $size / 1024 / 1024 }")
      limit_mb=$(awk "BEGIN { printf \"%.2f\", $max_size_bytes / 1024 / 1024 }")
      echo "pre-commit: blocking large staged file: $path (${size_mb} MB > ${limit_mb} MB)"
      blocked=1
    fi
  fi
done < <(git diff --cached --name-only --diff-filter=ACMR -z)

if [ "$blocked" -ne 0 ]; then
  cat <<'EOF'
pre-commit: commit rejected.

Rules:
- CSV files must be committed as Git LFS pointers (not raw file contents).
- Files larger than 10 MB must not be committed.
EOF
  exit 1
fi

exit 0
