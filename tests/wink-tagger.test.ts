import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { proseSampleLines, expectTagContract } from './fixtures/prose-sample';
import { WinkTagger } from '../src/prose-highlight/wink-tagger';

const fixtureLines = proseSampleLines();

describe('WinkTagger', () => {
  const tagger = new WinkTagger();

  it('should return empty array for empty input', () => {
    expect(tagger.tag('')).toEqual([]);
    expect(tagger.tag('   ')).toEqual([]);
  });

  it.each(fixtureLines.map((line, i) => [i, line] as const))(
    'line %i: tags are lossless, sorted, and non-overlapping',
    (_i, line) => {
      expectTagContract(line, tagger.tag(line));
    }
  );

  // expectTagContract passes vacuously on an empty array, so the contract
  // sweep above cannot on its own prove the tagger tagged anything.
  it('tags a substantial share of the fixture corpus', () => {
    const total = fixtureLines.reduce((n, line) => n + tagger.tag(line).length, 0);
    expect(total).toBeGreaterThan(fixtureLines.length);
  });

  // Recorded from wink's actual output, not assumed to match compromise's.
  // wink leaves the pronoun "He" and the possessive "his" untagged, which is
  // the behavior the old five-query compromise tagger got wrong.
  it('tags "He ran to his house" exactly as wink reports it', () => {
    expect(tagger.tag('He ran to his house')).toEqual([
      { text: 'ran', pos: 'verb', start: 3, end: 6 },
      { text: 'house', pos: 'noun', start: 14, end: 19 },
    ]);
  });

  // Comparing two instances' output does NOT test memoization: a tagger that
  // rebuilt the pipeline every call would return identical output and pass.
  // Timing is the observable difference — the first tag pays the ~37 ms
  // `winkNLP(model)` build, later ones pay nothing.
  it('builds the pipeline once, not per instance', () => {
    // Warm the module-level singleton so this test never measures the build.
    new WinkTagger().tag('warmup');

    const start = performance.now();
    for (let i = 0; i < 20; i++) {
      new WinkTagger().tag('The quick fox jumps');
    }
    const elapsed = performance.now() - start;

    // 20 pipeline builds would cost ~700 ms. 20 tags cost ~20 ms. The
    // threshold sits far from both, so it fails on a lost singleton without
    // being flaky on a slow machine.
    expect(elapsed).toBeLessThan(200);
  });

  // The offset fallback: wink normalizes some characters, so a token's
  // reconstructed slice can disagree with the source text. Curly quotes and
  // ligatures are the realistic triggers, and no other test feeds them.
  it('keeps offsets correct through characters wink may normalize', () => {
    for (const line of [
      'The “quick” brown fox jumps over the lazy dog',
      "Don’t let the ﬁrst draft stop you",
      'A non breaking space sits inside this sentence',
    ]) {
      const tags = tagger.tag(line);
      expectTagContract(line, tags);
      expect(tags.length).toBeGreaterThan(0);
    }
  });
});

// The swap's sharpest trap: two places construct a tagger, and repointing
// only one leaves the same note rendering different colors in live preview
// and reading view. This is a structural check because an integration test
// would need a real Obsidian editor and a real DOM.
describe('both view paths construct the same tagger', () => {
  const sources = [
    'src/prose-highlight/highlighter-plugin.ts',
    'src/prose-highlight/reading-view.ts',
  ];

  it.each(sources)('%s constructs WinkTagger and not CompromiseTagger', (rel) => {
    const source = readFileSync(join(__dirname, '..', rel), 'utf-8');
    expect(source).toMatch(/new WinkTagger\(\)/);
    expect(source).not.toMatch(/CompromiseTagger/);
  });
});
