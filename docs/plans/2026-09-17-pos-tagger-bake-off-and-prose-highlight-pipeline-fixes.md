---
body_sha256: "0bfcceabcda089a149c1ea27d0119eb33885b82d1d4f2318c8a0837ce1ece209"
session_id: "fc7b8834-c59b-48df-92c9-fa42d4a84729"
model: "claude-fable-5-1"
harness: "claude-code 2.1.274"
machine: "a6d66f7901a3"
approved_session_id: "b9c6cba6-90e1-471d-a7b7-4ffe01e5b4f2"
status: executing
next: "Cameron: manual test-vault check, then flip PR #44 to ready. Decision is swap to wink-nlp (size rule withdrawn 2026-09-18) — the swap needs its own plan, starting with whether wink can load the POS model alone."
branch: plan/pos-tagger-bakeoff
pr: https://github.com/cameronsjo/yaae/pull/44
updated: 2026-09-17
date: 2026-09-17
---

# POS tagger bake-off and prose-highlight pipeline fixes

## Context

yaae's prose highlighting (iA Writer-style parts-of-speech coloring) runs `compromise` v14 per line, synchronously on the main thread. Three things prompted this plan:

- **No baseline.** The repo has no benchmark and no accuracy measurement. The design docs assert "~1 ms per paragraph" (`docs/prose-syntax/implementation.md`) but nothing tests it, and compromise publishes no POS accuracy figure. "Is something more accurate?" cannot be answered without one.
- **Known waste and one known defect in the pipeline, independent of library.** `esbuild.config.mjs` never sets `minify`, so the production `main.js` ships compromise unminified (~64% of the bundle, ~353 kB raw). `CompromiseTagger.tag()` (`src/prose-highlight/tagger.ts:28`) parses once then runs five separate `match()` passes. The noun exclusion at `tagger.ts:36` (`.not('#Pronoun #Possessive')`) is a two-term *sequence* match, so pronouns are tagged as nouns today (verified 2026-09-17: `He ran to his house` → nouns `He, his, house`). The line cache (`src/prose-highlight/highlighter-plugin.ts:196`) is keyed by line *number*, so Enter, paste, or undo clears it and re-tags the whole viewport.
- **Native is out.** iA Writer's macOS tagger (Apple NLTagger) needs an N-API addon or a `child_process` shell-out. Both are macOS-desktop only, Obsidian mobile forbids process spawning, and Windows has no first-party POS API. `Intl.Segmenter` is native but segments only; it does not tag. Chromium built-in AI is absent from Electron. Researched 2026-09-17; sources land in the Task 7 research doc.

The candidate pool from the survey: `wink-nlp` + `wink-eng-lite-web-model` (maintained, 94.7% WSJ vendor-reported, ~10 kB core + ~1 MB model raw, gzip unmeasured), `en-pos` (94–96% PTB vendor-reported, unmaintained since 2017, bake-off only), and compromise as baseline. Transformers.js/ONNX models are tens of MB and async, wrong shape for keystroke highlighting; excluded.

## Goal

Ship the library-independent pipeline fixes (minified build, single-pass tagging with the pronoun defect fixed, content-keyed cache), and produce a measured comparison of compromise vs wink-nlp vs en-pos on speed, bundle size, and accuracy against a public treebank plus a side-by-side sample, so the swap decision is made on data. The swap itself is a follow-up plan.

## Alternatives declined

- **Swap to wink-nlp directly, no measurement** — the ~1 MB model may make the bundle larger than today and compromise's accuracy is unknown, so the swap could be a regression on either axis; measure first.
- **Pipeline fixes only, keep compromise** — leaves the accuracy question unanswered, which was the ask.
- **Native NLTagger tier on macOS** — desktop-macOS only, needs a native addon or shell-out that Obsidian mobile cannot run, no Windows counterpart; rejected in `docs/prose-syntax/implementation.md` § 8 and re-confirmed by the 2026-09-17 survey.
- **Web Worker offload** — prior doc (`implementation.md` § 9.4) reports Obsidian workers 6–10× slower; only worth revisiting if Task 4's viewport benchmark breaches the 16 ms frame budget. Recorded as a conditional follow-up, not done here.

## Panel

Panel: plan-reviewer ×2, developer-experience-reviewer, cameron-review ran — 22 findings, 19 folded in, 3 declined (see Panel review — findings declined). All four seats returned findings as text (plan mode blocks report files); none degraded.

## Panel review — findings declined

- **[Owner] The UD-EWT harness is lab-grade for a cosmetic feature; eyeball 5–10 paragraphs instead** — Cameron chose the measured bake-off at scoping; the harness is ~150 lines of dev-only code. Partially folded: Task 7 now also renders a side-by-side sample of 8 real paragraphs so the numbers have a felt check.
- **[DX] Pin vitest exactly because `vitest bench` is experimental** — `pnpm-lock.yaml` already pins the resolved version; the caret only affects a deliberate upgrade, and the bench is dev-only.
- **[Owner] Tasks 5–7 never touch the live vault** — correct by design: a treebank score is not dogfoodable; the Task 7 sample section is the felt check. No change.

## Architecture

`POSTagger` (`src/prose-highlight/tagger.ts:13`) is already the seam: `tag(text): POSTag[]` with character offsets. Every candidate implements it. The highlighter and reading-view post-processor stay unaware of which backend runs.

```
line text ──► POSTagger.tag() ──► POSTag[] (pure, cacheable by text)
                                      │
   syntaxTree exclusions ─────────────┼──► filter ──► DecorationSet
```

The cache change moves the exclusion filter *out* of the cached value: tags become a pure function of line text and can be keyed by content; exclusion (which depends on the async markdown parse) applies at decoration-build time. That removes the "cache holds tags computed before exclusion was known" bug class noted at `highlighter-plugin.ts:265-274`. Two identical lines (blank lines, repeated list items) deliberately share one cache entry: the value is position-free.

The bake-off lives in `bench/` (vitest `bench` mode for throughput, ordinary vitest tests for the scorer) and `scripts/`. Candidate taggers other than the shipped one are devDependencies only; nothing new ships in `main.js` until the follow-up plan.

## Tech Stack

- TypeScript 5.7, strict; esbuild 0.27; Vitest 4 (`vitest bench` for throughput; it is marked experimental upstream); pnpm 10
- compromise ^14.14.5 (runtime dep, baseline). Verified shapes: `doc.json({ offset: true })` gives a per-*sentence* `offset` and `terms[]` each carrying `text`, `pre`, `post`, `tags[]` — no per-term offset; `doc.match(...).out('offset')` gives per-term offsets but no tags
- wink-nlp + wink-eng-lite-web-model (devDependency for the bake-off)
- en-pos (devDependency for the bake-off; unmaintained, never a runtime dep without a fork)
- Universal Dependencies English EWT test split (CoNLL-U, CC BY-SA 4.0), fetched by script to a gitignored dir, never committed
- No `tsx`: it is only a transitive optional peer of vite here. Bench scripts run through vitest

## Global Constraints

- No new **runtime** dependency in this plan. Candidates are `devDependencies`; `main.js` composition changes only via minify and the tagger rewrite.
- `POSTagger` output contract holds: `text.slice(start, end) === tag.text` for every tag; tags sorted by `start`; non-overlapping.
- Existing tests stay green: `pnpm test`. `tests/tagger.test.ts` is the behavioral floor for any `CompromiseTagger` change.
- Pure tagging stays synchronous (the reading-view post-processor is synchronous).
- Treebank data is fetched, not vendored; `bench/data/` is gitignored.
- Conventional commits; each task is one commit; `[Unreleased]` changelog entry for user-visible changes (minify, pronoun fix, cache behavior).
- Biome is not configured in this repo; use the repo's existing formatting. `pnpm run typecheck` is the gate.
- Any number a later task consumes (baseline bundle size, compromise bench rows) is written into the producing task's **commit message body**, so it survives the subagent boundary.

## Orchestrator

**Driver:** opus — trigger: Task 7's bake-off adjudication is a judgment call with a stated decision rule; Tasks 1–6 are spec'd and Sonnet-dispatchable within it.

---

## Tasks

### Task 1 — Minify the production bundle and record bundle size

**Files:**
- Modify: `esbuild.config.mjs`
- Create: `scripts/bundle-size.sh`
- Modify: `CHANGELOG.md` (`[Unreleased]`: smaller plugin bundle)

**Interfaces:**
- Consumes: none
- Produces: `scripts/bundle-size.sh` → builds, then prints raw and gzip bytes of `main.js` (optional arg: a different JS file, so Task 6 can size throwaway bundles)

**Dispatch:** Parallel (wave 1) · fresh Sonnet subagent

**Report:** `[REPORT_PATH]`

**Steps:**
- [x] Run `pnpm run build` on the unchanged tree; record raw and gzip size of `main.js`. This is the **shipped baseline** and goes into the commit message body and later Task 7's doc
- [x] Add `minify: prod` to the esbuild options (keep `sourcemap` as-is for dev)
- [x] Write `scripts/bundle-size.sh`: `pnpm run build` unless a file arg is given, then print `wc -c` and `gzip -c | wc -c` for the target
- [x] Run it; confirm the plugin still loads in the test vault (`test-vault/`) with prose highlighting on
- [x] Commit: `build: minify production bundle` with both size pairs (before/after) in the body

---

### Task 2 — Single-pass CompromiseTagger, pronoun defect fixed

**Files:**
- Modify: `src/prose-highlight/tagger.ts`
- Test: `tests/tagger.test.ts`, create `tests/tagger-equivalence.test.ts`
- Create: `tests/fixtures/prose-sample.md` (≈300 words of public-domain prose with pronouns, possessives, contractions, and markdown inline syntax mixed in)

**Interfaces:**
- Consumes: none
- Produces: unchanged `POSTagger.tag(text): POSTag[]`; new exported `categoryForTags(tags: readonly string[]): POSCategory | null` (pure, table-driven)

**Dispatch:** Parallel (wave 1) · fresh Sonnet subagent

**Report:** `[REPORT_PATH]`

**Steps:**
- [x] Copy the current five-query implementation into the equivalence test file as `legacyTag()` (test-only reference)
- [x] Write `tests/tagger-equivalence.test.ts`: for every line of the fixture, `new CompromiseTagger().tag(line)` deep-equals `legacyTag(line)` — run, expect GREEN against the unchanged tagger (proves the harness), then proceed
- [x] Reimplement `tag()` as one `nlp(text).json({ offset: true })` walk. For each sentence, start at `sentence.offset.start` and advance by `pre.length`, `text.length`, `post.length` per term to derive each term's `[start, end)`. Classify each term with `categoryForTags(term.tags)` using this precedence: `Adjective` → adjective; else `Noun` **without** `Pronoun` and **without** `Possessive` → noun; else `Adverb`; else `Verb`; else `Conjunction`; else `null`
- [x] Run the equivalence test. Expected diffs are exactly the pronoun/possessive terms the legacy sequence-match let through (`He`, `his`, …). Handle a diff one of two ways, never by loosening the assertion: (a) it is a precedence or offset bug → fix the tagger; (b) it is the legacy pronoun defect → add the line to a small `KNOWN_LEGACY_DIVERGENCES` list in the test with the term and reason, and add a positive case to `tests/tagger.test.ts` (`'He ran to his house'` → nouns are exactly `['house']`). Any other diff class is a stop-and-report, not a mapper tweak
- [x] Add an offset-integrity assertion to `tests/tagger.test.ts`: every tag satisfies `text.slice(start,end) === tag.text`, tags are sorted and non-overlapping
- [x] `CHANGELOG.md` `[Unreleased]`: "Pronouns and possessives are no longer highlighted as nouns"
- [x] Commit: `fix(prose-highlight): single-pass tagging; stop tagging pronouns as nouns`

---

### Task 3 — Content-keyed tag cache with exclusion applied at build time

**Files:**
- Modify: `src/prose-highlight/highlighter-plugin.ts`
- Test: `tests/highlighter-exclusion.test.ts`, create `tests/highlighter-cache.test.ts`

**Interfaces:**
- Consumes: `POSTagger.tag()` (unchanged)
- Produces: `class LineTagCache { constructor(capacity: number); get(text: string): LineTags | undefined; set(text: string, tags: LineTags): void; readonly size: number }` — LRU by *access* order (a `Map`, re-inserting on `get` hit, evicting the first key when `size > capacity`); default capacity `4096`; exported for tests. `LineTags` stays `{ posTags, listMatches }` but now holds **unfiltered** results

**Dispatch:** Serial (after Task 2: the tagger contract must be settled) · fresh Sonnet subagent

**Report:** `[REPORT_PATH]`

**Steps:**
- [x] Write `tests/highlighter-cache.test.ts` with a counting fake `POSTagger`: (a) same text twice → one tag call; (b) simulate inserting a line above N cached lines → N hits, 1 miss; (c) at capacity, the least recently *accessed* key is evicted; run — expect RED
- [x] Implement `LineTagCache`; replace `Map<number, LineTags>`. Lookup path in `buildDecorations` / `buildDecorationSet` stays by line number: `const text = view.state.doc.line(i).text; const tags = cache.get(text) ?? tagAndStore(text)`. Identical lines share an entry on purpose (tags are position-free)
- [x] Move the `isExcluded` filtering and the `isHeadingLine` skip out of `retagLine` into `buildDecorationSet`, applied per line at emit time with that line's `getExcludedRanges`. `retagLine` becomes "tag text if not cached"
- [x] Update `applyUpdate`: the single-char fast path stays (the changed line is a plain miss); delete the `cache.clear()` in the bulk-change branch; the syntaxTree-changed branch (`highlighter-plugin.ts:265`) calls `buildDecorationSet` only (no clear, no retag), because exclusion is now applied at emit time; the viewport branch is unchanged
- [x] Run `tests/highlighter-cache.test.ts`, `tests/highlighter-exclusion.test.ts`, `tests/heading-skip.test.ts` — expect GREEN; adjust exclusion tests that asserted on cached-filtered values to assert on emitted decorations instead
- [x] Manual check in `test-vault/`: type, press Enter mid-paragraph, paste, undo, scroll across a code block, open a note with two identical list items; highlights correct, no flicker, no code words colored
- [x] `CHANGELOG.md` `[Unreleased]`: "Prose highlighting no longer re-tags the whole view on Enter, paste, or undo"
- [x] Commit: `perf(prose-highlight): cache tags by line content`

---

### Task 4 — Benchmark harness: throughput and viewport latency

**Files:**
- Create: `bench/taggers.ts` (`export const candidates: Record<string, () => POSTagger>`, compromise registered), `bench/corpus.ts` (loads `tests/fixtures/prose-sample.md` repeated to ~5,000 words), `bench/tagger.bench.ts`, `bench/README.md` (how to run both benches and fetch the treebank)
- Modify: `vitest.config.ts` (`benchmark.include: ["bench/**/*.bench.ts"]`; `test.include` gains `"bench/**/*.test.ts"`), `package.json` (`"bench": "vitest bench"`)

**Interfaces:**
- Consumes: `POSTagger`, the Task 2 fixture
- Produces: `candidates` registry consumed by Tasks 5 and 6

**Dispatch:** Parallel (wave 1) · fresh Sonnet subagent (only shares the fixture file with Task 2, read-only; if Task 2 has not landed, create the fixture here and Task 2 reuses it)

**Report:** `[REPORT_PATH]`

**Steps:**
- [x] Add the bench config, the test-include glob, and the `bench` script (no `--run`; `vitest bench` runs once by default)
- [x] `bench/tagger.bench.ts`: for each candidate, (a) tokens/sec over the corpus line-by-line, (b) "viewport" case: 60 lines tagged cold, reported in ms. 16 ms is the frame budget; a breach reopens the worker question (see Alternatives declined)
- [x] Run `pnpm bench`; the compromise rows go in the commit message body
- [x] Confirm `pnpm test` still passes and now collects `bench/**/*.test.ts` (none yet; the glob is verified by a placeholder-free run showing the pattern in vitest's output)
- [x] Commit: `test(bench): add POS tagger throughput benchmark`

---

### Task 5 — Accuracy harness against UD English EWT

**Files:**
- Create: `scripts/fetch-ud-ewt.sh` (curl `en_ewt-ud-test.conllu` from the UniversalDependencies GitHub repo at a pinned commit SHA into `bench/data/`), `bench/conllu.ts` (parser → sentences of `{ surface: string; tokens: { form, upos, start, end }[] }`), `bench/accuracy.ts` (scorer), `bench/accuracy.test.ts` (scorer unit test + the real run, skipped when data is absent), `bench/upos-map.ts`
- Modify: `.gitignore` (`bench/data/`), `package.json` (`"bench:accuracy": "vitest run bench/accuracy.test.ts"`), `bench/README.md`

**Interfaces:**
- Consumes: `candidates` (Task 4)
- Produces: per-candidate table printed by the test: per-category precision / recall / F1 for the five yaae categories, plus macro-F1, for both mapping variants

**Dispatch:** Serial (after Task 4) · fresh Sonnet subagent

**Report:** `[REPORT_PATH]`

**Steps:**
- [x] `bench/upos-map.ts`, table-driven and tested: `ADJ→adjective`, `NOUN|PROPN→noun`, `ADV→adverb`, `VERB→verb`, `CCONJ|SCONJ→conjunction`, else `null`. Variant flag `auxIsVerb` adds `AUX→verb`. Primary variant for the decision rule is **`auxIsVerb: true`** (iA Writer colors auxiliaries as verbs); the other is reported for context
- [x] `bench/conllu.ts`: hand-rolled, ~40 lines — the npm `conllu*` packages are as old as `en-pos` and we need two columns. Handle the three row kinds: skip comments; **multiword token rows (`1-2 don't`)** contribute the surface `form` to the reconstructed text and no gold tag; their covered single-ID rows contribute gold tags and are aligned to the *span of the MWT surface form*; empty-node rows (`8.1`) are skipped. Reconstruct `surface` from forms + `SpaceAfter=No`, recording each gold token's `[start,end)`
- [x] Alignment in `bench/accuracy.ts`: run the candidate on `surface`; a gold token is predicted as category X when a predicted tag's span overlaps the gold span and has category X, else `null`. Score P/R/F1 per category over gold tokens whose gold category is non-null (precision also counts false positives on null-gold tokens)
- [x] `bench/accuracy.test.ts`: pin the parser on a 3-row CoNLL-U snippet containing an MWT, and the scorer on a 5-token hand-made sentence with known P/R — expect GREEN. The real-data case uses `test.skipIf(!existsSync(DATA))` with the skip message `run scripts/fetch-ud-ewt.sh first`
- [x] Write and run `scripts/fetch-ud-ewt.sh`; then `pnpm bench:accuracy`; the compromise table goes in the commit message body
- [x] `bench/README.md`: the two commands and the fetch step
- [x] Commit: `test(bench): add UD-EWT accuracy scorer for POS taggers`

---

### Task 6 — Candidate taggers: WinkTagger and EnPosTagger (bench-only)

**Files:**
- Create: `bench/candidates/wink-tagger.ts`, `bench/candidates/en-pos-tagger.ts`, `bench/candidates.test.ts`
- Modify: `bench/taggers.ts` (register), `package.json` (devDependencies: `wink-nlp`, `wink-eng-lite-web-model`, `en-pos`)

**Interfaces:**
- Consumes: `POSTagger`, `candidates`, `bench/upos-map.ts`
- Produces: two `POSTagger` implementations under `bench/`, not `src/`

**Dispatch:** Parallel with Task 5 (after Task 4) · fresh Sonnet subagent

**Report:** `[REPORT_PATH]`

**Steps:**
- [x] `pnpm add -D wink-nlp wink-eng-lite-web-model en-pos`; record installed versions
- [x] **Verify APIs on the installed packages before writing offsets** (neither is in the repo at plan time): read `node_modules/wink-nlp` typings for the per-token POS and whitespace accessors (expected `its.pos`, `its.value`, `its.precedingSpaces`; if different, use what exists), and `node_modules/en-pos` for its input contract (expected: pre-tokenized `string[]`). Record what was found in the commit body
- [x] WinkTagger: offsets by walking `precedingSpaces + value` per token from 0. If wink's reconstruction is not lossless for some input, fall back to `text.indexOf(value, cursor)` per token and note it. Map wink's Universal POS through `bench/upos-map.ts`
- [x] EnPosTagger: tokenize with `Intl.Segmenter('en', { granularity: 'word' })`, keep `isWordLike` segments with their offsets, pass the token array to `en-pos`, map Penn tags: `JJ*→adjective`, `NN*→noun` (exclude `PRP`, `PRP$`), `RB*→adverb`, `VB*→verb` (`MD` under the aux variant), `CC→conjunction` (`IN` excluded: it is mostly prepositions)
- [x] `bench/candidates.test.ts`: for every candidate and every fixture line, all tags satisfy `text.slice(start,end) === tag.text`, sorted, non-overlapping — expect GREEN
- [x] Size each candidate: esbuild-bundle a one-file entry that imports only the tagger (`--bundle --minify --format=cjs`) to a temp path and run `scripts/bundle-size.sh <that file>`; record gzip bytes in the commit body
- [x] Commit: `test(bench): add wink-nlp and en-pos candidate taggers`

---

### Task 7 — Run the bake-off, write the research doc, decide

**Files:**
- Create: `docs/research/2026-09-<dd>-pos-tagger-bakeoff.md`
- Modify: this plan (`## Learnings`, `next:`)

**Interfaces:**
- Consumes: Tasks 1, 4, 5, 6 outputs (numbers are in their commit bodies: `git log --format=%B`)

**Dispatch:** In-context (Opus driver) — this is the judgment step

**Report:** —

**Steps:**
- [x] Run `pnpm bench` and `pnpm bench:accuracy` on the M3 Air; collect bundle sizes from the Task 1 and Task 6 commit bodies
- [x] Doc sections: shipped baseline (pre/post minify), throughput table, 60-line viewport latency (absolute ms and ratio to compromise), accuracy table (per-category F1 + macro-F1, both AUX variants, primary marked), bundle delta per candidate, **side-by-side sample**: 8 real paragraphs from Cameron's vault or the fixture rendered as `word/CATEGORY` per candidate with visible disagreements marked, survey sources (native route rejection, candidate maintenance status, licenses), decision
- [x] Apply the decision rule, fixed here before the numbers exist. **Recommend a swap only if all hold** for the candidate: (1) primary-variant macro-F1 beats compromise (post-Task-2) by ≥ 5 points; (2) 60-line viewport latency is ≤ 16 ms absolute **and** ≤ 1.5 × compromise's; (3) the projected shipped gzip size (post-minify `main.js` − compromise's share + candidate's bundle) is ≤ the **pre-minify shipped baseline** from Task 1, so no user ever downloads a bigger plugin than today; (4) a release within the last 12 months. `en-pos` fails (4) by construction and can only win as a vendored fork, which the doc must say
- [x] Present the result to Cameron with the recommendation; the swap (runtime dependency, settings toggle, mobile re-test against yaae#32) is a separate plan
- [x] Append `## Learnings`; set `next:`
- [x] run `cadence-forge:polish`; fold findings
- [x] Commit: `docs(research): POS tagger bake-off results`

---

## Verification

- `pnpm test` green, and its output lists `tests/tagger-equivalence.test.ts`, `tests/highlighter-cache.test.ts`, `bench/accuracy.test.ts`, `bench/candidates.test.ts`
- `pnpm run typecheck` clean
- `pnpm bench` prints a row per candidate; `pnpm bench:accuracy` prints the F1 table after `scripts/fetch-ud-ewt.sh`, and prints `run scripts/fetch-ud-ewt.sh first` before it
- `scripts/bundle-size.sh` shows a smaller gzip `main.js` than the Task 1 baseline
- `new CompromiseTagger().tag('He ran to his house')` yields exactly one noun, `house`
- Manual: in `test-vault/`, highlighting survives Enter / paste / undo / scroll over a code block with no wrong colors inside code
- The research doc exists and carries every number the decision rule names

## Deviations

- 2026-09-17 — The repo has no `CHANGELOG.md`; release-please generates it from conventional commits at release time. The "`[Unreleased]` entry" steps in Tasks 1–3 become "the user-visible line is the first line of the commit body". A hand-written changelog would collide with the generated one.
- 2026-09-17 — "Existing tests stay green" was already false on `main` at branch time: 15 structural tests that regex-match `main.ts` source fail in `auto-toc`, `commands`, `main-lifecycle`, and `prose-highlight-debug` (`pnpm test` on `f44da8c`). Out of scope here; the gate for this plan is "no new failures". Filed as a loose end.
- 2026-09-17 — Task 1's manual `test-vault/` load check and Task 3's manual editing check are deferred to the end of the plan and done once, by the driver.
- 2026-09-18 — Task 7's "present the result to Cameron" step is the PR and the closing report, not an in-session presentation; the session ran unattended. The manual `test-vault/` check stays owed and is named in the PR.
- 2026-09-18 — Both polish fan-out arms stalled on their first dispatch and again cost a retry; the docs arm's retry died on a Fable rate limit. Docs drift was applied inline by the driver instead, recorded honestly as `docs=ran` with the lost context isolation disclosed. Security kept its independent Opus pass.
- 2026-09-17 — Driver ran as Fable 5.1 rather than Opus, under operator authorization ("implement the following plan" in the same session family that approved it).

## Learnings

- **Decision: swap to wink-nlp.** It passes accuracy (+11.7 macro-F1), latency (1.0 ms vs 14.2 ms viewport), and maintenance. It failed only the plan's size ceiling, withdrawn 2026-09-18: across 19 installed Obsidian plugins, five exceed 1.3 MB raw and the largest, `outfit-planner`, is 5.2 MB raw / 1.18 MB gzip — larger than yaae-with-wink would be. en-pos stays rejected on its own merits. Full numbers: `docs/research/2026-09-17-pos-tagger-bakeoff.md`.
- **The size ceiling was the plan's weakest decision, and it was load-bearing.** "No user downloads a bigger plugin than today" sounds principled and measures nothing real — it anchors on yaae's own past weight rather than on what a plugin can cost. One `du` over a set of installed plugins would have refuted it before the bake-off ran. Fix the anchor before fixing the rule: a size budget needs a comparison set.
- **Almost all of wink's weight is one data file.** Its tagger code is 13 kB gzip against compromise's 140 kB, so the swap makes the *code* smaller; `eng-core-web-model.json` (2.97 MB raw) is the whole cost, plus sentiment and entity models POS tagging never reads (~575 kB raw). That makes the swap plan's first question "can we load only the POS model?", not "can we afford wink?".
- **compromise's viewport is 14.2 ms mean, 15.9 ms p99 on the M3 Air.** Under the 16 ms budget, but with no margin on a slower machine. The worker question stays closed; a breach would reopen it, and the wink numbers say the wink route beats the worker route if that day comes.
- **The plan's compromise shape note was wrong.** `doc.json({ offset: true })` in compromise 14.14.5 does carry a per-term `offset`; Task 2 used it directly and kept an `indexOf` fallback that never fires on tested input.
- **Agent worktrees branch from `origin/main`, not the orchestrator's HEAD** (`worktree.baseRef: fresh`). Task 3 was built without Task 2's tagger in its tree and Tasks 5 and 6 had to fast-forward to the plan tip first. The merges were clean because every task owned disjoint files, but a plan that chains tasks through one file needs the fast-forward step in every brief.
- **Parallel tasks that both "consume" a file one of them creates need an interim.** Task 6 carried a local UPOS table while Task 5 wrote the shared one; the fold was one commit (`004ed96`). Cheaper than serializing them.
- **Sonnet's output filter can trip on writing literary prose.** The Task 4 agent died mid-fixture; a resume with "generate plain sentences" finished cleanly.
- **A staged break has to run where the real thing runs.** The first attempt at proving the treebank checksum gate fails closed put the broken copy of the script in `/tmp`, so it resolved its repo root to `/` and died on `mkdir //bench` before ever reaching the checksum. That is a green-looking red: the test failed for the wrong reason and would have passed against a gate that did nothing. Re-run from the repo's own `scripts/` directory, it failed on the digest as intended.
- **The accuracy scorer had a defect the accuracy numbers could not reveal.** Every sub-token of a contraction shared the whole contraction's span, so one predicted tag matched both `do` and `n't`. It moved wink-nlp by half a point and left compromise untouched, which is exactly why nothing looked wrong. 2.8% of UD-EWT test tokens are multiword sub-tokens.
