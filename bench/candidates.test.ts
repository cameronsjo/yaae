import { describe, it, expect } from 'vitest';
import { proseSampleLines, expectTagContract } from '../tests/fixtures/prose-sample';
import { candidates } from './taggers';

const fixtureLines = proseSampleLines();

describe.each(Object.entries(candidates))('%s candidate tagger', (_name, makeTagger) => {
  const tagger = makeTagger();

  it.each(fixtureLines.map((line, i) => [i, line] as const))(
    'line %i: tags are lossless, sorted, and non-overlapping',
    (_i, line) => {
      expectTagContract(line, tagger.tag(line));
    }
  );

  it('tags "He ran to his house" with exactly the expected nouns and a verb', () => {
    const tags = tagger.tag('He ran to his house');

    const nouns = tags.filter((t) => t.pos === 'noun').map((t) => t.text);
    expect(nouns).toEqual(['house']);

    const verbs = tags.filter((t) => t.pos === 'verb').map((t) => t.text);
    expect(verbs).toContain('ran');
  });
});
