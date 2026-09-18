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
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 2

backup_dir="$(mktemp -d -t yaae-mutate-XXXXXX)"
trap 'rm -rf "$backup_dir" || true' EXIT

survivors=0
caught=0

# run_mutation <label> <file> <test-file> <perl-expr>
run_mutation() {
  local label="$1" file="$2" test_file="$3" expr="$4"
  local backup="$backup_dir/$(echo "$file" | tr / _)"

  cp "$file" "$backup"
  perl -0pi -e "$expr" "$file"

  if cmp -s "$file" "$backup"; then
    echo "  SKIP  $label — mutation matched nothing, pattern is stale"
    cp "$backup" "$file"
    survivors=$((survivors + 1))
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
echo "caught: $caught   survived: $survivors"
if [ "$survivors" -gt 0 ]; then
  echo "FAIL: $survivors mutation(s) survived — those assertions do not pin what they name." >&2
  exit 1
fi
echo "PASS: every mutation was caught."
