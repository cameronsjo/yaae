# POS tagger benchmarks

Run with:

```bash
pnpm bench
```

This runs `vitest bench --run --reporter=verbose` once (no watch) over `bench/**/*.bench.ts`.

The harness uses the Vitest 5 test-context `bench` fixture; historical results below were measured with Vitest 4.

## Cases

Each registered tagger in `bench/taggers.ts` runs two cases:

- **throughput** — tags every line of a corpus repeated to ~5,000 words
  (`bench/corpus.ts`, sourced from `tests/fixtures/prose-sample.md`).
  Reported as vitest's ops/sec (hz) and mean ms per run; divide the corpus
  word count by the mean run time to get tokens/sec.
- **viewport** — constructs a fresh tagger and tags the first 60 non-empty
  lines of the corpus, cold (no warm-up). This approximates tagging a
  freshly scrolled editor viewport. 16 ms is the frame budget: a viewport
  tag pass slower than that will visibly stutter live highlighting.

## Accuracy

Every `pnpm test` (including CI) loads the small tracked
`bench/fixtures/scorer.conllu` fixture and checks all three candidates under
both AUX variants against committed count/macro-F1 snapshots. The contraction
case additionally checks that a prediction spanning two gold subtokens is used
only once. Missing fixture data throws at collection time; there is no skip or
network dependency in this gate. These are regression baselines, not estimates
of English-language accuracy.

The three fixture sentences were authored for this repository under its MIT
license; they are not extracted or adapted from UD-EWT. Only the CoNLL-U format
is shared. The full research corpus is much larger (2,077 sentences) and remains
an optional, checksum-pinned download:

```bash
bash scripts/fetch-ud-ewt.sh   # downloads bench/data/en_ewt-ud-test.conllu (pinned commit, gitignored)
pnpm bench:accuracy
```

When present, `bench/accuracy.test.ts` also scores the full UD_English-EWT test
split (Universal Dependencies, CC BY-SA 4.0) for both AUX variants and reports
precision/recall/F1 per category plus macro-F1. CI does not download this corpus;
the published 76.4 / 87.8 / 80.3% full-corpus measurements are local research
results, not the fixture baselines. To reproduce them, fetch the corpus first.
The required fixture and parser/scorer unit tests always run, with or without
the full corpus.

## Side-by-side sample

```bash
pnpm vitest run bench/sample.test.ts
```

Prints eight fixture lines as `word/CATEGORY` for every candidate, with a `*`
after each word the candidates disagree on. A felt check to read next to the
accuracy table; it asserts nothing.

## Results

The 2026-09-17 run and the swap decision are in
`docs/research/2026-09-17-pos-tagger-bakeoff.md`.
