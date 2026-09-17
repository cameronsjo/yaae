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

Task 5 adds `pnpm bench:accuracy`, which scores each candidate tagger
against a POS-tagged treebank (fetched as part of that task's setup) instead
of measuring speed.
