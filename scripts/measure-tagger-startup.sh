#!/usr/bin/env bash
# Measure POS tagger startup cost, like for like.
#
# Three phases are reported separately, because comparing one library's
# require-only against another's require+first-tag is what produced a wrong
# conclusion in an earlier revision of the bake-off doc:
#
#   require   — import the library and its model, construct nothing
#   build     — the above, plus building the pipeline (wink's lazy getter
#               defers exactly this; compromise has no equivalent step)
#   first-tag — the above, plus tagging one line
#
# Each measurement runs in a fresh node process, so no module cache carries
# over, and every phase runs under ONE runner chosen up front. A per-phase
# fallback between runners is what would make the comparison uneven again, so
# a missing runner is a hard failure rather than a silent switch.
#
# Usage: bash scripts/measure-tagger-startup.sh [runs]   (default 5)
# Exit: 0 all phases measured, 2 a phase could not be measured at all.
set -uo pipefail

runs="${1:-5}"

case "$runs" in
  ''|*[!0-9]*) echo "ERROR: runs must be a positive integer, got '$runs'" >&2; exit 2 ;;
esac
[ "$runs" -ge 1 ] || { echo "ERROR: runs must be at least 1" >&2; exit 2; }

cd "$(git rev-parse --show-toplevel)" || {
  echo "ERROR: not inside a git repository" >&2
  exit 2
}

# One runner for every phase. Resolved once, named in the output, and fatal if
# absent — never per-phase, which would let wink be measured under a different
# runtime than compromise.
if command -v node > /dev/null 2>&1; then
  RUNNER=node
  runner_version=$(node --version)
else
  echo "ERROR: node not found — cannot measure" >&2
  exit 2
fi

failures=0

run_phase() {
  local label="$1" script="$2" i ms
  local times=()
  local failed=0
  for ((i = 0; i < runs; i++)); do
    ms=$("$RUNNER" --input-type=module --eval "$script" 2>/dev/null)
    if [[ "$ms" =~ ^[0-9]+$ ]]; then
      times+=("$ms")
    else
      failed=$((failed + 1))
    fi
  done
  if [ ${#times[@]} -eq 0 ]; then
    echo "$label: FAILED — 0 of $runs runs produced a number"
    failures=$((failures + 1))
    return
  fi
  printf '%s: ' "$label"
  printf '%s ' "${times[@]}"
  printf 'ms'
  # Never report a short sample as if it were the full one.
  [ "$failed" -gt 0 ] && printf '  (WARNING: %d of %d runs failed)' "$failed" "$runs"
  printf '\n'
}

WINK_REQUIRE='
const t0 = performance.now();
await import("wink-nlp");
await import("wink-eng-lite-web-model");
console.log(Math.round(performance.now() - t0));
'

WINK_BUILD='
const t0 = performance.now();
const { default: winkNLP } = await import("wink-nlp");
const { default: model } = await import("wink-eng-lite-web-model");
winkNLP(model);
console.log(Math.round(performance.now() - t0));
'

WINK_FIRST_TAG='
const t0 = performance.now();
const { default: winkNLP } = await import("wink-nlp");
const { default: model } = await import("wink-eng-lite-web-model");
const nlp = winkNLP(model);
nlp.readDoc("The quick brown fox jumps over the lazy dog").tokens().each(() => {});
console.log(Math.round(performance.now() - t0));
'

COMPROMISE_REQUIRE='
const t0 = performance.now();
await import("compromise");
console.log(Math.round(performance.now() - t0));
'

COMPROMISE_FIRST_TAG='
const t0 = performance.now();
const { default: nlp } = await import("compromise");
nlp("The quick brown fox jumps over the lazy dog").json({ offset: true });
console.log(Math.round(performance.now() - t0));
'

echo "runner: $RUNNER $runner_version"
echo "runs per phase: $runs (first run of each phase is a cold-cache outlier)"
echo "--- require only ---"
run_phase "wink      " "$WINK_REQUIRE"
run_phase "compromise" "$COMPROMISE_REQUIRE"
echo "--- require + build pipeline (wink only; compromise has no such step) ---"
run_phase "wink      " "$WINK_BUILD"
echo "--- require + first tag ---"
run_phase "wink      " "$WINK_FIRST_TAG"
run_phase "compromise" "$COMPROMISE_FIRST_TAG"

if [ "$failures" -gt 0 ]; then
  echo "ERROR: $failures phase(s) produced no measurement" >&2
  exit 2
fi
