#!/usr/bin/env bash
# Mutation sweep for the structural tests (#51).
#
# Each mutation deletes or alters one behavior a structural test claims to
# pin. The test that names that behavior MUST go red. A mutation that leaves
# the suite green means the assertion cannot fail for the thing it names —
# which is how the reading-view mobile gate went unguarded.
#
# Every mutation is applied to a copy, run, then restored from that copy.
# Never uses destructive git: a peer's uncommitted work is not ours to discard.
#
# Usage: bash scripts/mutate-structural-tests.sh
# Exit: 0 every mutation was caught, 1 at least one survived.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 2

backup_dir="$(mktemp -d -t yaae-mutate-XXXXXX)"

# The file currently mutated, if any. The cleanup handler restores it BEFORE
# removing the backups. Without that ordering there is a window — between the
# perl edit and the restoring cp — where dying would delete the only copy of
# the original while the source file is still mutated.
#
# Honest note: a timing-based interrupt test did not reproduce that window on
# either the old or the new ordering, because bash finishes the in-flight line
# before acting on SIGINT. This is defensive, not a fix for a demonstrated
# failure; it costs nothing and the damage if it ever did happen is a silently
# corrupted main.ts.
#
# Residual limit, not closed by anything here: SIGKILL runs no trap at all, so
# a hard kill mid-mutation still leaves the file edited. Recover with an
# explicit-path `git checkout -- main.ts` (never a broad reset — a peer's
# uncommitted work in a shared checkout is not ours to discard).
in_flight_src=""
in_flight_backup=""

cleanup() {
  if [[ -n "$in_flight_src" && -f "$in_flight_backup" ]]; then
    cp "$in_flight_backup" "$in_flight_src"
    echo "restored $in_flight_src after interruption" >&2
  fi
  rm -rf "$backup_dir"
  return 0
}
trap cleanup EXIT
trap 'exit 130' INT TERM

survivors=0   # assertion could not fail — the serious one
stale=0       # the mutation's own pattern matched nothing — fix this script
caught=0

# run_mutation <label> <file> <test-file> <perl-expr>
run_mutation() {
  local label="$1" file="$2" test_file="$3" expr="$4"
  local backup="$backup_dir/${file//\//_}"

  cp "$file" "$backup"
  in_flight_src="$file"
  in_flight_backup="$backup"
  perl -0pi -e "$expr" "$file"

  # Distinct from a surviving mutation: this means THIS SCRIPT is out of date
  # (the code it targets moved), not that a test assertion is weak. Different
  # fix, so a different counter.
  if cmp -s "$file" "$backup"; then
    echo "  STALE $label — mutation matched nothing; update this script"
    cp "$backup" "$file"
    in_flight_src=""
    in_flight_backup=""
    stale=$((stale + 1))
    return
  fi

  if pnpm exec vitest run "$test_file" > /dev/null 2>&1; then
    echo "  ALIVE $label — suite stayed GREEN, assertion cannot fail"
    survivors=$((survivors + 1))
  else
    echo "  dead  $label — caught"
    caught=$((caught + 1))
  fi

  cp "$backup" "$file"
  # Restored: nothing for the cleanup handler to undo any more.
  in_flight_src=""
  in_flight_backup=""
}

echo "Mutating behaviors the structural tests claim to pin:"

run_mutation "reading-view mobile gate removed" \
  main.ts tests/prose-highlight-debug.test.ts \
  's/      if \(this\.proseHighlightBlockedOnMobile\(\)\) return;\n//'

run_mutation "CM6 decoration-build error recording removed" \
  src/prose-highlight/highlighter-plugin.ts tests/prose-highlight-debug.test.ts \
  's/        recordProseHighlightError\(err, "decoration-build"\);\n//'

run_mutation "CM6 update error recording removed" \
  src/prose-highlight/highlighter-plugin.ts tests/prose-highlight-debug.test.ts \
  's/        recordProseHighlightError\(err, "update"\);\n//'

run_mutation "validateOnSave runtime check removed" \
  main.ts tests/main-lifecycle.test.ts \
  's/      if \(!this\.settings\.document\.validateOnSave\) return;\n//'

run_mutation "a command id renamed" \
  main.ts tests/commands.test.ts \
  's/id: "yaae-generate-toc"/id: "yaae-generate-toc-MUTATED"/'

run_mutation "vault modify listener notification removed" \
  main.ts tests/auto-toc.test.ts \
  's/      this\.autoTocManager\.notifyModified\(file\.path\);\n//'

echo
echo "caught: $caught   survived: $survivors   stale: $stale"

rc=0
if [[ "$survivors" -gt 0 ]]; then
  echo "FAIL: $survivors mutation(s) survived — those assertions do not pin what they name." >&2
  rc=1
fi
if [[ "$stale" -gt 0 ]]; then
  echo "FAIL: $stale mutation(s) matched nothing — this script targets code that moved." >&2
  rc=1
fi
if [[ "$rc" -eq 0 ]]; then
  echo "PASS: every mutation was caught."
fi
exit "$rc"
