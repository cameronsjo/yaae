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

# A temp DIR, not "$(mktemp ...).json". Appending a suffix means the file
# mktemp atomically created is not the one used, so the original leaks every
# run and the path actually written is created without O_EXCL.
tmpdir="$(mktemp -d -t yaae-vitest-XXXXXX)"
trap 'rm -rf "$tmpdir" || true' EXIT
out="$tmpdir/report.json"
runlog="$tmpdir/vitest.log"
shape_log="$tmpdir/report-shape.log"

pnpm exec vitest run --reporter=json --outputFile="$out" > "$runlog" 2>&1
rc=$?

emit_error() {
  echo "$1" >&2
  if [ -s "$runlog" ]; then
    echo "--- vitest output ---" >&2
    command cat "$runlog" >&2
  fi
  if [ -f "$shape_log" ] && [ -s "$shape_log" ]; then
    echo "--- report validation output ---" >&2
    command cat "$shape_log" >&2
  fi
  exit 2
}

if [ ! -s "$out" ]; then
  emit_error "ERROR: vitest produced no JSON report (exit $rc)"
fi

if ! jq -e '
  type == "object"
  and (.testResults | type == "array")
  and all(.testResults[]; type == "object" and (.assertionResults | type == "array"))
' "$out" > /dev/null 2>"$shape_log"; then
  emit_error "ERROR: '$out' is not a vitest JSON report — the reporter's shape may have changed."
fi

suite_count="$(jq -r '.testResults | length' "$out")" || {
  emit_error "ERROR: could not count collected test suites in '$out'."
}
assertion_count="$(jq -r '[.testResults[].assertionResults[]] | length' "$out")" || {
  emit_error "ERROR: could not count collected test assertions in '$out'."
}
runtime_failure_count="$(jq -r '[.testResults[] | select(.status == "failed" and (.assertionResults | length == 0))] | length' "$out")" || {
  emit_error "ERROR: could not inspect collection/runtime failures in '$out'."
}

if [ "$runtime_failure_count" -gt 0 ]; then
  emit_error "ERROR: vitest reported $runtime_failure_count collection/runtime failure(s) without test assertions (exit $rc)."
fi

if [ "$suite_count" -eq 0 ] || [ "$assertion_count" -eq 0 ]; then
  emit_error "ERROR: vitest produced no collected test suites or assertions (exit $rc)."
fi

failed_assertion_count="$(jq -r '[.testResults[].assertionResults[] | select(.status == "failed")] | length' "$out")" || {
  emit_error "ERROR: could not count failed assertions in '$out'."
}
if [ "$rc" -ne 0 ] && { [ "$rc" -ne 1 ] || [ "$failed_assertion_count" -eq 0 ]; }; then
  emit_error "ERROR: vitest runner failed without a usable assertion-failure result (exit $rc)."
fi

jq -r '
  .testResults[] as $file
  | $file.assertionResults[]
  | select(.status == "failed")
  | "\($file.name | sub("^.*/(?<t>tests|bench)/"; "\(.t)/")) > \(.fullName)"
' "$out" | sort
