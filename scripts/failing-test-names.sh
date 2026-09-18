#!/usr/bin/env bash
# Print the full name of every failing test, one per line, sorted.
# Used to compare a run against a baseline by NAME, not by count.
#
# Usage: bash scripts/failing-test-names.sh > /tmp/failures.txt
# Exit: 0 names printed (possibly none — a fully green suite), 2 the script
#       could not produce a trustworthy list.
#
# Exit 2 matters more than it looks. A baseline diff is only meaningful if
# both sides are real lists; a script that emits a placeholder line, or an
# empty list because the report never parsed, turns every later comparison
# into a pass that proves nothing.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || {
  echo "ERROR: not inside a git repository" >&2
  exit 2
}

out="$(mktemp -t yaae-vitest-XXXXXX).json"
trap 'rm -f "$out"' EXIT

pnpm exec vitest run --reporter=json --outputFile="$out" > /dev/null 2>&1
rc=$?

if [ ! -s "$out" ]; then
  echo "ERROR: vitest produced no JSON report (exit $rc)" >&2
  exit 2
fi

if ! jq -e 'type == "object" and has("testResults")' "$out" > /dev/null 2>&1; then
  echo "ERROR: '$out' is not a vitest JSON report — the reporter's shape may have changed." >&2
  exit 2
fi

jq -r '
  .testResults[] as $file
  | $file.assertionResults[]
  | select(.status == "failed")
  | "\($file.name | sub("^.*/(?<t>tests|bench)/"; "\(.t)/")) > \(.fullName)"
' "$out" | sort
