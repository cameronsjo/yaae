# POS tagger bake-off: compromise vs wink-nlp vs en-pos

Date: 2026-09-17. Machine: MacBook Air M3 (`sjomba`). Plan: `docs/plans/2026-09-17-pos-tagger-bake-off-and-prose-highlight-pipeline-fixes.md`.

## Decision

**Swap to wink-nlp.** It wins accuracy by 11.7 macro-F1 points and runs a cold 60-line viewport 14× faster, at a cost of about 887 kB gzip added to the plugin download.

The decision rule below failed wink-nlp on size alone, capping the shipped bundle at yaae's own pre-minify weight. That rule was withdrawn on 2026-09-18, and a measurement of 19 installed Obsidian plugins says the withdrawal is right. Five ship a `main.js` over 1.3 MB raw, and the largest, `outfit-planner`, is **5.2 MB raw / 1.18 MB gzip — bigger on both axes than yaae-with-wink would be** (3.85 MB raw / 1.08 MB gzip). A ceiling that forbids what a quarter of the sample already does was measuring the wrong thing.

en-pos is rejected on its own merits, unchanged: it misses the accuracy bar (+4.2 against a +5 requirement), is the largest of the three, and was last published in 2017.

The swap is its own plan: it adds a runtime dependency, needs a settings toggle, and needs mobile re-testing against yaae#32. This document is the evidence for it, not the execution.

### Where wink's weight actually is

| Component | Raw | Gzip |
|---|---:|---:|
| wink-nlp core (code) | **37,478** | **13,111** |
| wink-eng-lite-web-model (data) | 3,617,791 | 1,013,823 |
| compromise, for comparison (code) | 359,795 | 139,814 |

*Lower is better.*

Swapping the *code* makes yaae smaller: wink's tagger is 13 kB gzip against compromise's 140 kB. All of the added weight is one data file, `eng-core-web-model.json` at 2.97 MB raw. Two more models ride along that POS tagging never reads — `eng-sa-model.json` (sentiment, 404 kB raw) and `eng-ner-model.json` (entities, 172 kB raw). Whether wink can be configured to load only the POS model is the first question the swap plan should answer; it is worth roughly 575 kB raw before any other optimization.

## Decision rule (fixed in the plan before measurement)

Recommend a swap only if all four hold for the candidate:

1. Primary-variant macro-F1 beats compromise (post-Task-2) by at least 5 points.
2. 60-line viewport latency is at most 16 ms absolute and at most 1.5× compromise's.
3. Projected shipped gzip size (post-minify `main.js` minus compromise's share plus the candidate's bundle) is at most the pre-minify shipped baseline, so no user downloads a bigger plugin than today.
4. A release within the last 12 months.

| Rule | wink-nlp | en-pos |
|---|---|---|
| 1. Accuracy +5 F1 | PASS (+11.7) | FAIL (+4.2) |
| 2. Viewport latency | PASS (1.0 ms, 0.07×) | PASS (3.2 ms, 0.22×) |
| 3. Size ceiling 260,626 B gzip | FAIL (1,082,647 B) — **rule withdrawn** | FAIL (1,482,863 B) |
| 4. Release in last 12 months | PASS (2025-06-30) | FAIL (2017-04-09) |

Rule 3 was withdrawn on 2026-09-18, after the numbers were in. Fixing rules in advance is what keeps a bake-off honest, so the withdrawal is recorded here rather than edited away: the rule was a guess at what "too big" means, and the plugin measurement above shows the guess was wrong by a wide margin. Rules 1, 2, and 4 stand as written, and wink-nlp passes all three.

## Shipped baseline: bundle size

`scripts/bundle-size.sh`, esbuild production build of `main.js`.

| Build | Raw bytes | Gzip bytes |
|---|---:|---:|
| Before minify (shipped baseline, `f44da8c`) | 1,041,344 | 260,626 |
| After minify (`4349320`) | 554,970 | 195,785 |
| After all pipeline fixes (`004ed96`) | **555,105** | **195,813** |

*Lower is better. The pre-minify gzip figure is the size ceiling in rule 3.*

## Bundle size per candidate

Each candidate bundled alone (`esbuild --bundle --minify --format=cjs`, one entry re-exporting the tagger class), sized with `scripts/bundle-size.sh`.

| Candidate | Raw bytes | Gzip bytes | Projected shipped gzip |
|---|---:|---:|---:|
| compromise 14.14.5 | **359,795** | **139,814** | **195,813** (as shipped) |
| wink-nlp 2.4.0 + wink-eng-lite-web-model 1.8.1 | 3,656,028 | 1,026,648 | 1,082,647 |
| en-pos 1.0.16 | 4,949,015 | 1,426,864 | 1,482,863 |

*Lower is better. Projected shipped gzip = 195,813 − 139,814 + candidate gzip. en-pos's own code is about 169 kB; the rest is its `en-lexicon`, `humannames`, and `cities-list` word-list dependencies.*

## Throughput and viewport latency

`pnpm bench` (vitest bench), `tests/fixtures/prose-sample.md` repeated to 5,280 words, run once on the M3 Air. Mean of samples.

| Candidate | 5,280-word corpus (ms) | Tokens/sec | 60-line viewport cold (ms) | Ratio to compromise |
|---|---:|---:|---:|---:|
| compromise | 101.5 | 52,000 | 14.2 | 1.00× |
| wink-nlp | **7.7** | **686,000** | **1.0** | **0.07×** |
| en-pos | 23.1 | 229,000 | 3.2 | 0.22× |

*Lower ms is better. Higher tokens/sec is better. The 16 ms frame budget holds for all three, but compromise sits at 14.2 ms with a 15.9 ms p99, so a longer viewport or a slower machine can breach it.*

## Accuracy against UD English EWT

`pnpm bench:accuracy` after `scripts/fetch-ud-ewt.sh`. Test split of UD_English-EWT at commit `4a4d77f`, 2,077 sentences. A gold token counts as predicted category X when a predicted span overlaps it and carries X. Precision also counts false positives on tokens whose gold category is none of the five. Sub-tokens of a multiword token (`don't` is gold `do` + `n't`) get consecutive sub-spans of the contraction, so one predicted tag over the whole contraction is scored against one sub-token, not both.

Primary variant (`auxIsVerb: true`, auxiliaries count as verbs, matching iA Writer):

| Category F1 | compromise | wink-nlp | en-pos |
|---|---:|---:|---:|
| adjective | 74.8% | **78.1%** | 69.8% |
| noun | 87.3% | **91.3%** | 88.3% |
| adverb | 64.9% | **85.1%** | 76.0% |
| verb | 88.1% | **94.0%** | 89.8% |
| conjunction | 65.2% | **90.8%** | 77.4% |
| **Macro-F1** | 76.1% | **87.8%** | 80.3% |

Secondary variant (`auxIsVerb: false`), for context:

| Category F1 | compromise | wink-nlp | en-pos |
|---|---:|---:|---:|
| verb | 68.9% | 71.7% | **72.2%** |
| **Macro-F1** | 72.2% | **83.4%** | 76.7% |

*Higher is better. Only the verb row changes between variants; every tagger colors auxiliaries as verbs, so the secondary variant mostly measures how many auxiliaries the treebank contains.*

Per-category precision and recall for the primary variant:

| Candidate | adjective P/R | noun P/R | adverb P/R | verb P/R | conjunction P/R |
|---|---|---|---|---|---|
| compromise | 80.1 / 70.1 | 84.5 / 90.3 | 81.4 / 54.0 | 85.4 / 91.1 | 55.9 / 78.2 |
| wink-nlp | 89.1 / 69.5 | 88.3 / 94.5 | 89.1 / 81.5 | 93.7 / 94.2 | 97.3 / 85.0 |
| en-pos | 63.4 / 77.7 | 86.3 / 90.4 | 78.9 / 73.3 | 92.2 / 87.5 | 99.9 / 63.1 |

Where compromise loses: adverb recall (54%) and conjunction precision (56%). It misses about half the adverbs and over-tags conjunctions, mostly `to` and sentence-initial `So`, as the sample below shows.

## Side-by-side sample

Eight fixture lines rendered as `word/CATEGORY` per candidate (`pnpm vitest run bench/sample.test.ts`). A `*` marks a word the candidates disagree on. `-` means no category.

```text
> Alice was beginning to get very tired of sitting by her sister on the bank,
compromise Alice/N was/V beginning/V to/CONJ* get/V very/ADV tired/ADJ of/- sitting/N* by/- her/- sister/N on/- the/- bank,/N
wink       Alice/N was/V beginning/V to/-* get/V very/ADV tired/ADJ of/- sitting/V* by/- her/- sister/N on/- the/- bank,/N
en-pos     Alice/N was/V beginning/V to/-* get/V very/ADV tired/ADJ of/- sitting/V* by/- her/- sister/N on/- the/- bank,/N

> and of having nothing to do. She had peeped into the book her sister was
compromise and/CONJ of/- having/V nothing/N* to/CONJ* do./V She/- had/V peeped/V into/- the/- book/N her/- sister/N was/V
wink       and/CONJ of/- having/V nothing/-* to/-* do./V She/- had/V peeped/V into/- the/- book/N her/- sister/N was/V
en-pos     and/CONJ of/- having/V nothing/N* to/-* do./V She/- had/V peeped/V into/- the/- book/N her/- sister/N was/V

> reading, but it had no pictures or conversations in it, and _what is the use
compromise reading,/V* but/CONJ it/- had/V no/- pictures/N or/CONJ conversations/N in/- it,/- and/CONJ _what/N* is/V the/- use/N
wink       reading,/N* but/CONJ it/- had/V no/- pictures/N or/CONJ conversations/N in/- it,/- and/CONJ _what/-* is/V the/- use/N
en-pos     reading,/N* but/CONJ it/- had/V no/- pictures/N or/CONJ conversations/N in/- it,/- and/CONJ _what/N* is/V the/- use/N

> So she was considering in her own mind, as well as she could, for the hot
compromise So/CONJ* she/- was/V considering/V in/- her/- own/ADJ mind,/N as/-* well/ADV as/-* she/- could,/V for/- the/N* hot/N*
wink       So/ADV* she/- was/V considering/V in/- her/- own/ADJ mind,/N as/ADV* well/ADV as/CONJ* she/- could,/V for/- the/-* hot/ADJ*
en-pos     So/ADV* she/- was/V considering/V in/- her/- own/ADJ mind,/N as/ADV* well/ADV as/-* she/- could,/V for/- the/-* hot/N*

> day made her feel very sleepy and stupid, whether the pleasure of making a
compromise day/N made/V her/- feel/N* very/ADV sleepy/ADJ and/CONJ stupid,/ADJ whether/CONJ* the/- pleasure/N of/- making/V a/-
wink       day/N made/V her/- feel/V* very/ADV sleepy/ADJ and/CONJ stupid,/ADJ whether/-* the/- pleasure/N of/- making/V a/-
en-pos     day/N made/V her/- feel/V* very/ADV sleepy/ADJ and/CONJ stupid,/ADJ whether/-* the/- pleasure/N of/- making/V a/-

> [[daisy-chain]] would be worth the trouble of getting up and picking the
compromise [[daisy-chain]]/- would/V be/V worth/V* the/- trouble/N of/- getting/V up/V* and/CONJ picking/V the/-
wink       [[daisy-chain]]/- would/V be/V worth/ADJ* the/- trouble/N of/- getting/V up/-* and/CONJ picking/V the/-
en-pos     [[daisy-chain]]/- would/V be/V worth/V* the/- trouble/N of/- getting/V up/ADV* and/CONJ picking/V the/-

> daisies, when suddenly a **White Rabbit** with pink eyes ran close by her.
compromise daisies,/N when/-* suddenly/ADV a/- **White/- Rabbit**/N with/- pink/ADJ eyes/N ran/V close/V* by/- her./-
wink       daisies,/N when/ADV* suddenly/ADV a/- **White/- Rabbit**/N with/- pink/ADJ eyes/N ran/V close/ADJ* by/- her./-
en-pos     daisies,/N when/-* suddenly/ADV a/- **White/- Rabbit**/N with/- pink/ADJ eyes/N ran/V close/N* by/- her./-

> There was nothing so *very* remarkable in that, nor did Alice think it so
compromise There/- was/V nothing/N* so/ADV *very*/- remarkable/ADJ in/- that,/- nor/CONJ did/V Alice/N think/V it/- so/ADV
wink       There/- was/V nothing/-* so/ADV *very*/- remarkable/ADJ in/- that,/- nor/CONJ did/V Alice/N think/V it/- so/ADV
en-pos     There/- was/V nothing/V* so/ADV *very*/- remarkable/ADJ in/- that,/- nor/CONJ did/V Alice/N think/V it/- so/ADV
```

Felt read: compromise's visible misses are `to` colored as a conjunction (twice), `sitting` and `feel` as nouns, `the hot` as nouns, and `close` as a verb. wink-nlp's are `sitting/V` (arguably right), `worth/ADJ` (right), and a missed `nothing`. Three of the eight lines have a compromise error a reader would notice; wink-nlp has none that a reader would call wrong. The scorer's 12-point gap is the same story at scale.

Markdown-wrapped words (`*very*`, `**White`, `_what`) get no category from any tagger because the marker is glued to the word. That is a tokenization gap in all three, not a tagger difference; it is out of scope here.

## What shipped alongside the bake-off

- Minified production bundle: 260,626 → 195,813 gzip bytes (`4349320`).
- Single-pass `CompromiseTagger` with `categoryForTags()`; pronouns and possessives are no longer highlighted as nouns (`610ca4b`). `He ran to his house` now yields one noun, `house`.
- Content-keyed `LineTagCache` (LRU by access, capacity 4096); Enter, paste, undo, and syntax-tree progress no longer clear the cache, and code-block exclusion is applied when decorations are emitted (`de7492c`).
- `bench/`: throughput bench, UD-EWT scorer, candidate taggers, side-by-side sample; see `bench/README.md`.

## Survey: why native and worker routes are out

- **Apple NLTagger from Electron** needs a native addon or a shell-out. Electron's own guide covers Swift addons (`electronjs.org/docs/latest/tutorial/native-code-and-electron-swift-macos`); the Obsidian developer policies forbid plugins that spawn processes on mobile and the plugin must ship one `main.js`. macOS-desktop only, no Windows counterpart.
- **`Intl.Segmenter`** segments words and sentences but carries no part-of-speech information (MDN, `web.dev/blog/intl-segmenter`). It is useful as a tokenizer (en-pos uses it here), not as a tagger.
- **Chromium built-in AI** is not present in Electron (CEF issue 3982 tracks the same absence).
- **Web Workers in Obsidian** are possible with an inline-worker bundle (`RyotaUshio/obsidian-web-worker-example`, `esbuild-plugin-inline-worker`), but the prior measurement in `docs/prose-syntax/implementation.md` § 9.4 puts them 6–10× slower here, and the forum thread on CPU-heavy plugin work reports the same. Compromise's 14.2 ms viewport stays under the 16 ms budget, so the worker question stays closed for now.

## Candidate status and licenses

| Candidate | Version | Last publish | License | Notes |
|---|---|---|---|---|
| compromise | 14.14.5 | active | MIT | shipped baseline |
| wink-nlp + wink-eng-lite-web-model | 2.4.0 + 1.8.1 | 2025-06-30 / 2024-11-30 | MIT | `winkjs/wink-nlp` |
| en-pos | 1.0.16 | 2017-04-09 | MIT | `FinNLP/en-pos`, unmaintained; a runtime use would need a vendored fork |

Treebank: UD_English-EWT test split, CC BY-SA 4.0, fetched by script and never committed.

Considered and excluded before measuring: `retext-pos` and `pos-js` (ports of the older FastTag/Brill lexicon tagger, no published accuracy figure), `natural` and `nlp.js` (broader NLP toolkits whose POS support is the same Brill-style tagger or absent), and Transformers.js/ONNX models (tens of MB and asynchronous, wrong shape for keystroke highlighting).

## Open questions for the swap plan

- **Can wink load only the POS model?** Worth ~575 kB raw (the sentiment and entity models POS tagging never reads). Answer this before optimizing anything else.
- **Is the model lazy-loadable?** Deferring `eng-core-web-model.json` until the first highlight would keep plugin startup near today's cost. Obsidian loads every enabled plugin's `main.js` at launch, so 3.85 MB of mostly-JSON is parsed on every app start whether or not the user highlights anything.
- **Mobile.** Prose highlighting is currently disabled on mobile (yaae#32). Until that is resolved, mobile users would carry the model's weight for a feature they cannot use — which argues for lazy-loading, not against the swap.
- **A viewport breach was not the trigger.** compromise sits at 14.2 ms mean, 15.9 ms p99 against a 16 ms budget, so the worker question (`implementation.md` § 9.4) stays closed either way; wink's 1.0 ms retires it outright.

## Reproduce

```bash
pnpm install
bash scripts/bundle-size.sh          # shipped main.js, raw and gzip
pnpm bench                           # throughput and viewport latency
bash scripts/fetch-ud-ewt.sh         # one-time treebank fetch to bench/data/
pnpm bench:accuracy                  # per-category F1, both AUX variants
pnpm vitest run bench/sample.test.ts # side-by-side sample
```
