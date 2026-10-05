#!/usr/bin/env bash
# Assert the production bundle contains nothing it should not.
#
# Two rules:
#   1. No input path under bench/ — the bake-off harness never ships.
#   2. No input from the compromise package — it is a devDependency, and
#      src/prose-highlight/ holds no import of it.
#
# This reads esbuild's metafile, the record of what actually entered the
# bundle. Grepping the built main.js cannot do this job: the production build
# minifies, so every symbol is renamed and a grep returns a confident negative
# whether or not the harness shipped.
#
# Usage: bash scripts/check-bundle-inputs.sh [meta.json]
#   Builds first when no metafile path is given.
# Exit: 0 clean, 1 forbidden input found, 2 the check itself could not run.
set -uo pipefail

meta="${1:-}"

if [ -z "$meta" ]; then
  # Always build, and always from the repo root. A bare relative "meta.json"
  # resolved against an arbitrary cwd is how a stale metafile from an earlier
  # build gets read as a PASS for the current tree.
  cd "$(git rev-parse --show-toplevel)" || {
    echo "FAIL: not inside a git repository" >&2
    exit 2
  }
  rm -f meta.json
  # mktemp, not a fixed /tmp name: a predictable path on a shared machine can
  # be pre-planted as a symlink, which this redirect would follow and truncate.
  build_log="$(mktemp -t yaae-build-XXXXXX)"
  if ! pnpm run build > "$build_log" 2>&1; then
    echo "FAIL: production build failed — see $build_log" >&2
    exit 2
  fi
  rm -f "$build_log"
  meta="meta.json"
fi

if [ ! -s "$meta" ]; then
  echo "FAIL: no metafile at '$meta'. Run 'pnpm run build' first." >&2
  exit 2
fi

# Guard the check itself: a metafile with no inputs would pass every rule
# below while proving nothing.
input_count=$(jq -r '.inputs | length' "$meta" 2>/dev/null)
if ! [[ "$input_count" =~ ^[0-9]+$ ]] || [ "$input_count" -lt 10 ]; then
  echo "FAIL: metafile has $input_count inputs — too few to be a real build." >&2
  exit 2
fi

forbidden=$(jq -r '
  .inputs
  | keys[]
  | select(startswith("bench/") or test("(^|/)node_modules/compromise/"))
' "$meta")

if [ -n "$forbidden" ]; then
  echo "FAIL: forbidden inputs in the production bundle:"
  # Quoted and line-oriented: these paths come from the metafile, and an
  # unquoted expansion would word-split and glob-expand them against the cwd.
  printf '%s\n' "$forbidden" | sed 's/^/  /'
  exit 1
fi

echo "PASS: $input_count bundle inputs, none from bench/ and none from compromise."
