# POS tagger benchmarks

Run with:

```bash
pnpm bench
```

This runs `vitest bench` once (no watch) over `bench/**/*.bench.ts`.

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

Scores each candidate tagger (`bench/taggers.ts`) against the UD_English-EWT
test split (Universal Dependencies, CC BY-SA 4.0) instead of measuring speed.

```bash
bash scripts/fetch-ud-ewt.sh   # downloads bench/data/en_ewt-ud-test.conllu (pinned commit, gitignored)
pnpm bench:accuracy
```

`bench/accuracy.test.ts` parses the CoNLL-U file (`bench/conllu.ts`), maps
each gold UPOS tag to a yaae `POSCategory` (`bench/upos-map.ts`), and reports
precision/recall/F1 per category plus macro-F1 (`bench/accuracy.ts`) for
every candidate under both `auxIsVerb` variants. Without the data file the
UD-EWT case is skipped (message: "run scripts/fetch-ud-ewt.sh first"); the
parser and scorer unit tests still run.

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
