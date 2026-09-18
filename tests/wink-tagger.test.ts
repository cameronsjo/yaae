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

  it('reuses one pipeline across instances', () => {
    const a = new WinkTagger().tag('The quick fox jumps');
    const b = new WinkTagger().tag('The quick fox jumps');
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });
});
