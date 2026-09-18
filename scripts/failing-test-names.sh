#!/usr/bin/env bash
# Print the full name of every failing test, one per line, sorted.
# Used to compare a run against a baseline by NAME, not by count.
#
# Usage: bash scripts/failing-test-names.sh > /tmp/failures.txt
set -uo pipefail

out="$(mktemp -t yaae-vitest-XXXXXX).json"
pnpm exec vitest run --reporter=json --outputFile="$out" > /dev/null 2>&1
rc=$?

if [ ! -s "$out" ]; then
  echo "ERROR: vitest produced no JSON report (exit $rc)" >&2
  exit 2
fi

jq -r '
  if type == "object" and has("testResults") then
    .testResults[] as $file
    | $file.assertionResults[]
    | select(.status == "failed")
    | "\($file.name | sub("^.*/(?<t>tests|bench)/"; "\(.t)/")) > \(.fullName)"
  else
    "NOT_A_VITEST_REPORT"
  end
' "$out" | sort
