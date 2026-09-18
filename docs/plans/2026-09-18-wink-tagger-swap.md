---
status: in-progress
next: "Task 2 — metafile bundle check with a staged break"
branch: plan/wink-tagger-swap
pr: —
updated: 2026-09-18
date: 2026-09-18
session_id: fc7b8834-c59b-48df-92c9-fa42d4a84729
approved_session_id: fc7b8834-c59b-48df-92c9-fa42d4a84729
model: claude-opus-5
harness: claude-code 2.1.274
machine: a6d66f7901a3
---

# Swap the prose-highlight POS tagger to wink-nlp

## Context

yaae colors prose by part of speech. The tagger behind it, `compromise`, was measured against two alternatives in `docs/research/2026-09-17-pos-tagger-bakeoff.md` (PR #44). wink-nlp won by 11.7 macro-F1 points on Universal Dependencies English EWT and tags a cold 60-line viewport in 1.0 ms against compromise's 14.2 ms. Its tagger *code* is also smaller — 13 kB gzip against 140 kB. The cost is one 2.97 MB data file, which takes the shipped plugin from 195,813 to roughly 1,082,647 gzip bytes.

The bake-off's size rule rejected wink-nlp on that alone. The rule was withdrawn on 2026-09-18: across 19 installed Obsidian plugins, five exceed 1.3 MB raw and the largest is 5.2 MB raw / 1.18 MB gzip. This plan executes the swap the evidence now recommends.

**The change is smaller than it looks, and has two traps that a careless pass would fall into.** Panel review found both:

1. There are **two** tagger construction sites, not one — `highlighter-plugin.ts:237` and `reading-view.ts:48`. Changing only the first leaves reading view on compromise: the same note gets different colors in the two views, and both libraries ship.
2. `src/prose-highlight/tagger.ts` holds `CompromiseTagger` *and* its `import nlp from 'compromise'`. Demoting compromise to a devDependency while a `src/` file imports it leaves the bundle clean only by tree-shaking luck — one future value import silently re-adds 140 kB.

Both close with the same structural move: `CompromiseTagger` leaves `src/` entirely.

## Goal

Ship wink-nlp as yaae's POS tagger with no user-visible change except more accurate colors, and with compromise fully absent from the built bundle — by construction, not by a grep that cannot fail.

## Alternatives declined

- **Ship both behind a settings toggle** — the bake-off found no axis where compromise wins; a toggle ships a loser and doubles the surface.
- **Eagerly construct the model, as the bench does** — `winkNLP(model)` at module scope parses 3.6 MB at every Obsidian launch on every platform, including mobile, where prose highlighting is gated off. A lazy getter on first `tag()` keeps the seam synchronous and costs nothing.
- **A dedicated dependency-vetting task at Opus** — both packages have zero dependencies and no install scripts, and both are already in the lockfile from the bake-off. Moving a package between `package.json` sections is not a new supply-chain entry. It reduces to `pnpm audit --prod` plus one recorded judgement.
- **A committed hard-wrap accuracy harness with a stop-the-plan gate** — the scorer feeds whole sentences, the plugin feeds one editor line, so fragmentation is a fair question. But the house rule is no hard-wrapped prose, only 27.5% of EWT sentences exceed 72 columns, and the decision is already made. It shrinks to a throwaway check recorded in a commit body.

## Panel

Panel: plan-reviewer, red-team-reviewer, cameron-review ran — 27 findings, 24 folded in, 3 declined (see Panel review — findings declined). The two CRITICAL findings (second construction site, compromise import in `src/`) were independently verified against the code before folding.

## Panel review — findings declined

- **[Task 1] Pin exact versions rather than caret ranges** — `pnpm-lock.yaml` already pins resolved versions; a caret only affects a deliberate upgrade, and yaae has no automated dependency bumping that would take one silently.
- **[Task 2] Capture the 15 pre-existing failing test *names* into the branch before starting** — folded in spirit, not as an artifact: Task 1 diffs names rather than counts, but committing a snapshot file of a known-red suite invites it to rot. The diff is computed live.
- **[Task 3] Reopen yaae#32 before citing the mobile guard** — the guard's missing tracker is real but belongs to mobile highlighting, not to this swap. Filed as a follow-up instead of widening this plan.

## Architecture

`POSTagger` in `src/prose-highlight/tagger.ts` is the seam: `tag(text): POSTag[]` with character offsets. After this plan that file holds **only** the seam — `POSTag`, `POSTagger`, `categoryForTags` — and no NLP library import.

```
src/prose-highlight/
  tagger.ts        types + categoryForTags       (no library import)
  upos-map.ts      moved from bench/             (one copy, two callers)
  wink-tagger.ts   moved from bench/candidates/  ← the shipped tagger
bench/candidates/
  compromise-tagger.ts   moved from src/         (bench only)
  en-pos-tagger.ts       unchanged
```

Dependency direction stays `bench/ → src/`, never the reverse — `esbuild` follows every import from `main.ts`, so a `src/ → bench/` import ships the harness. `bench/upos-map.ts` becomes a re-export of the `src/` copy rather than a duplicate, because it is also the scorer's gold mapping and a second copy would silently shift every accuracy number.

## Tech Stack

- wink-nlp 2.4.0 + wink-eng-lite-web-model 1.8.1 — MIT, zero dependencies each, no install scripts — promoted to **runtime** dependencies
- compromise 14.14.5 demoted to a devDependency
- TypeScript 5.7 strict, esbuild 0.27, Vitest 4, pnpm 10 — unchanged

## Global Constraints

- `POSTagger` contract holds: `text.slice(start, end) === tag.text`, sorted by `start`, non-overlapping. `expectTagContract` in `tests/fixtures/prose-sample.ts` is the assertion — pair it with a non-empty tag count, since it passes vacuously on an empty array.
- Tagging stays **synchronous**. The reading-view post-processor cannot await.
- No behavior change beyond accuracy: five categories, settings toggles, heading skip, code-block exclusion, custom word lists all unchanged.
- `src/` MUST NOT import from `bench/`.
- `pnpm test` has 15 known failures in `auto-toc`, `commands`, `main-lifecycle`, `prose-highlight-debug`. The gate is **no new failing test names**, compared by name, not count — `prose-highlight-debug.test.ts` regex-matches `highlighter-plugin.ts` source and is already red, so a count gate would miss a regression there.
- `pnpm run typecheck` clean.

## Orchestrator

**Driver:** sonnet — every trap the panel found is named explicitly in the task steps, which is what makes this spec'd rather than judgement-heavy. No security-critical control changes; the dependency move is a lockfile-resident package changing `package.json` sections.

---

## Tasks

### Task 1 — Swap the tagger

**Files:**
- Create: `src/prose-highlight/wink-tagger.ts` (moved), `bench/candidates/compromise-tagger.ts` (moved), `src/prose-highlight/upos-map.ts` (moved)
- Modify: `src/prose-highlight/tagger.ts`, `src/prose-highlight/highlighter-plugin.ts`, `src/prose-highlight/reading-view.ts`, `bench/taggers.ts`, `bench/upos-map.ts`, `bench/accuracy.ts`, `package.json`
- Test: `tests/wink-tagger.test.ts` (new), `tests/tagger.test.ts`, `tests/tagger-equivalence.test.ts`

**Dispatch:** Serial · fresh Sonnet subagent

**Steps:**
- [x] Record the current failing test names: `pnpm test 2>&1 | grep -E '^\s+FAIL' | sort > /tmp/yaae-baseline-failures.txt`. This is the comparison set, not the count
- [x] Move `CompromiseTagger` and its `import nlp from 'compromise'` out of `src/prose-highlight/tagger.ts` into `bench/candidates/compromise-tagger.ts`. Leave `tagger.ts` holding `POSTag`, `POSTagger`, `categoryForTags` and **no library import**
- [x] Move `bench/upos-map.ts` to `src/prose-highlight/upos-map.ts`; make `bench/upos-map.ts` a re-export so `bench/accuracy.ts` keeps its gold mapping from one source
- [x] Move `bench/candidates/wink-tagger.ts` to `src/prose-highlight/wink-tagger.ts`, re-pointing its `mapUpos` import at the `src/` copy. **Change `const nlp = winkNLP(model)` from module scope to a lazy getter built on first `tag()`** — still synchronous, so mobile does not parse 3.6 MB at launch for a gated-off feature
- [x] Repoint **both** construction sites: `highlighter-plugin.ts:237` and `reading-view.ts:48`. Grep `new CompromiseTagger` across `src/` and `main.ts` afterwards; it must return nothing
- [x] Repoint imports in `tests/tagger.test.ts`, `tests/tagger-equivalence.test.ts`, and `bench/taggers.ts` at the new locations
- [x] `pnpm add wink-nlp wink-eng-lite-web-model`; move `compromise` to `devDependencies`. Run `pnpm audit --prod` and record the result
- [x] `tests/wink-tagger.test.ts`: `expectTagContract` over every fixture line **plus an assertion that at least one line yields a non-empty tag array**, so the contract cannot pass vacuously. Record wink's actual output for `'He ran to his house'` and pin that — do not assume it matches compromise's
- [x] Throwaway fragmentation check, recorded in the commit body, not committed as code: tag the eight fixture lines individually and again joined into one string; report the tag-count delta
- [x] `pnpm test` — diff failing names against the baseline file; any new name is a stop-and-report. `pnpm run typecheck` clean
- [x] Commit: `feat(prose-highlight): tag with wink-nlp`. Body carries the audit result, the fragmentation delta, and the dependency judgement

---

### Task 2 — Verify the shipped cost by construction

**Files:**
- Modify: `scripts/bundle-size.sh` or a new `scripts/check-bundle-inputs.sh`, `docs/research/2026-09-17-pos-tagger-bakeoff.md`

**Dispatch:** Serial (after Task 1) · fresh Sonnet subagent

**Rationale:** the production build minifies, so grepping `main.js` for a `bench/` symbol returns a confident negative whether or not the harness shipped. It reads as exoneration and cannot go red.

**Steps:**
- [ ] Build with `--metafile` and assert **no key of `metafile.inputs` starts with `bench/`** and none is `compromise`. Stage the break to prove it fails: add a temporary `import { candidates } from '../../bench/taggers'` to a `src/` file, confirm the check goes RED, remove it, confirm GREEN. Restore with an explicit-path `git checkout`, never a broad reset
- [ ] `bash scripts/bundle-size.sh` — record raw and gzip against the predicted 3.85 MB / 1,082,647 B. A material miss means the projection method was wrong; say so rather than adjusting the prediction
- [ ] Re-measure startup **like for like** (require-only for both, or require+first-tag for both) against the corrected 53–70 ms vs 66–67 ms figures
- [ ] `pnpm bench` — the shipped tagger's viewport number should match the candidate's
- [ ] Update the research doc's decision section with measured-after-swap numbers
- [ ] Commit: `test: assert the bundle excludes bench and compromise`

---

### Task 3 — Documentation and follow-ups

**Files:**
- Modify: `docs/prose-syntax/implementation.md`, `CLAUDE.md`

**Dispatch:** Serial (after Task 2) · fresh Sonnet subagent

**Steps:**
- [ ] `implementation.md` § 5: wink-nlp is shipped, compromise is no longer the recommendation. Keep the comparison table and its measured-results pointer
- [ ] `implementation.md` § 9.4: wink's 1.0 ms viewport retires the Web Worker question outright — say so
- [ ] `CLAUDE.md`: record that `src/prose-highlight/` must never import from `bench/`, and why
- [ ] `README.md` only if a user-visible claim changed — the five categories did not, so likely no edit
- [ ] File three follow-up issues: (a) post-merge mobile beta check on the rolling `beta` tag; (b) the `Platform.isMobile` prose-highlight guard has no open tracker since #32 closed; (c) POS-only model subsetting, worth 176 kB gzip, blocked on upstream
- [ ] Commit: `docs: wink-nlp is the shipped tagger`

---

## Verification

- `pnpm test`: no failing test **name** absent from the pre-swap baseline; `pnpm run typecheck` clean
- `new WinkTagger().tag('He ran to his house')` matches its pinned expectation
- The metafile check passes, and was proven able to fail by a staged break
- `grep -rn "new CompromiseTagger" src/ main.ts` returns nothing
- `grep -rn "bench/" src/ main.ts` returns nothing
- Built `main.js` size recorded against the 1,082,647 B prediction
- Reading view and live preview render the same colors for the same note

## Deviations

- **Branch is stacked on `plan/pos-tagger-bakeoff`, not `main`.** `bench/`, the wink candidate, and the research doc all live on that branch under open draft PR #44. Basing on `main` would have had nothing to move. The PR for this work targets `plan/pos-tagger-bakeoff`.
- **Driver is Opus, not the specified Sonnet subagents.** The three tasks are strictly serial and share the same files, so dispatching gains no parallelism and no context isolation, while the two CRITICAL traps are exactly the kind a spec'd worker misses. Recorded rather than silently taken.
- **Failing-test names come from `scripts/failing-test-names.sh`, not the inline grep.** The plan's `grep -E '^\s+FAIL'` matches nothing against vitest 4's output, which marks failures with a `×` glyph wrapped in ANSI codes. The script uses vitest's JSON reporter and prints `file > fullName`, which is stable. It is committed because it computes names live; the declined finding objected to committing a *snapshot*, which this is not.
- **`compromise` re-pinned to 14.14.5 after an accidental bump.** `pnpm remove` + `pnpm add -D` re-resolved it to 14.17.0. The research doc's compromise numbers were measured on 14.14.5, so a bump in the same PR would have changed the comparison baseline.
- **Two `bench/` mentions in `src/` comments were reworded.** The plan's `grep -rn "bench/" src/ main.ts` verification is a literal string check; prose mentions would have failed it for no real reason. The metafile check in Task 2 is the real guard.
- **No CHANGELOG entry.** The repo has no `CHANGELOG.md`; release-please generates release notes from the conventional-commit prefixes.

## Learnings

- Fragmentation is a non-issue: tagging the 29 fixture lines individually yields the same 200 tags as tagging them joined into one string. Delta 0.
- wink leaves the pronoun `He` and the possessive `his` untagged in `He ran to his house`, which is the exact case the old five-query compromise tagger got wrong. The accuracy win shows up in the pinned fixture, not just in the EWT score.
