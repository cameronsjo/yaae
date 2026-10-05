import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import type { POSTag } from '../../src/prose-highlight/tagger';

/** Non-blank lines of the shared prose fixture, in file order. */
export function proseSampleLines(): string[] {
  const fixturePath = join(__dirname, 'prose-sample.md');
  return readFileSync(fixturePath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim().length > 0);
}

/**
 * Asserts the POSTagger output contract for one line: every tag's text is
 * the slice it names, tags are sorted by start, and no two overlap.
 */
export function expectTagContract(line: string, tags: readonly POSTag[]): void {
  let lastEnd = -1;
  for (const tag of tags) {
    expect(line.slice(tag.start, tag.end)).toBe(tag.text);
    expect(tag.start).toBeGreaterThanOrEqual(lastEnd);
    lastEnd = tag.end;
  }
}
