import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { candidates } from './taggers';

const fixturePath = join(__dirname, '..', 'tests', 'fixtures', 'prose-sample.md');
const fixtureLines = readFileSync(fixturePath, 'utf-8')
  .split('\n')
  .filter((line) => line.trim().length > 0);

describe.each(Object.entries(candidates))('%s candidate tagger', (_name, makeTagger) => {
  const tagger = makeTagger();

  it.each(fixtureLines.map((line, i) => [i, line] as const))(
    'line %i: tags are lossless, sorted, and non-overlapping',
    (_i, line) => {
      const tags = tagger.tag(line);

      let lastEnd = -1;
      for (const tag of tags) {
        expect(line.slice(tag.start, tag.end)).toBe(tag.text);
        expect(tag.start).toBeGreaterThanOrEqual(lastEnd);
        lastEnd = tag.end;
      }
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
