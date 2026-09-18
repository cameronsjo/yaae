#!/usr/bin/env bash
# Measure POS tagger startup cost, like for like.
#
# Two phases are reported separately, because comparing one library's
# require-only against another's require+first-tag is what produced a wrong
# conclusion in an earlier revision of the bake-off doc:
#
#   require   — import the library and its model, construct nothing
#   first-tag — the above, plus building the pipeline and tagging one line
#
# Each phase runs in a fresh node process, so no module cache carries over.
#
# Usage: bash scripts/measure-tagger-startup.sh [runs]   (default 5)
set -uo pipefail

runs="${1:-5}"

run_phase() {
  local label="$1" script="$2" i ms
  local times=()
  for ((i = 0; i < runs; i++)); do
    ms=$(pnpm exec tsx --eval "$script" 2>/dev/null \
      || node --input-type=module --eval "$script" 2>/dev/null)
    [ -n "$ms" ] && times+=("$ms")
  done
  if [ ${#times[@]} -eq 0 ]; then
    echo "$label: FAILED to measure" >&2
    return 1
  fi
  printf '%s: ' "$label"
  printf '%s ' "${times[@]}"
  printf 'ms\n'
}

WINK_REQUIRE='
const t0 = performance.now();
await import("wink-nlp");
await import("wink-eng-lite-web-model");
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

echo "runs per phase: $runs"
echo "--- require only ---"
run_phase "wink      " "$WINK_REQUIRE"
run_phase "compromise" "$COMPROMISE_REQUIRE"
echo "--- require + first tag ---"
run_phase "wink      " "$WINK_FIRST_TAG"
run_phase "compromise" "$COMPROMISE_FIRST_TAG"
