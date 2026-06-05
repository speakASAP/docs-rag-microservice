#!/bin/bash
# Copy markdown documentation from ecosystem repos into docs-rag for a central docs snapshot.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPOS_ROOT="${GIT_BASE_PATH:-$(dirname "$PROJECT_ROOT")}"
DEST_ROOT="$PROJECT_ROOT/docs/services"

mkdir -p "$DEST_ROOT"

find "$DEST_ROOT" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +

while IFS= read -r -d '' repo_dir; do
  repo_name="$(basename "$repo_dir")"
  [ "$repo_name" = "docs-rag-microservice" ] && continue
  mkdir -p "$DEST_ROOT/$repo_name"
  while IFS= read -r -d '' doc_file; do
    rel="${doc_file#$repo_dir/}"
    mkdir -p "$DEST_ROOT/$repo_name/$(dirname "$rel")"
    cp "$doc_file" "$DEST_ROOT/$repo_name/$rel"
  done < <(find "$repo_dir" \
    -path '*/.git' -prune -o \
    -path '*/node_modules' -prune -o \
    -path '*/dist' -prune -o \
    -path '*/coverage' -prune -o \
    -type f \( -iname '*.md' -o -iname '*.mdx' \) -print0 2>/dev/null || true)
done < <(find "$REPOS_ROOT" -mindepth 1 -maxdepth 1 -type d -print0)

count="$(find "$DEST_ROOT" -type f \( -iname '*.md' -o -iname '*.mdx' \) | wc -l | tr -d ' ')"
echo "Synced $count markdown documents into $DEST_ROOT"
