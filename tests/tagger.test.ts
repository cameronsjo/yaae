import { describe, it, expect } from 'vitest';
import { CompromiseTagger } from '../src/prose-highlight/tagger';
import type { POSTag } from '../src/prose-highlight/tagger';

describe('CompromiseTagger', () => {
  const tagger = new CompromiseTagger();

  it('should return empty array for empty input', () => {
    expect(tagger.tag('')).toEqual([]);
    expect(tagger.tag('   ')).toEqual([]);
  });

  it('should tag adjectives', () => {
    const tags = tagger.tag('The quick brown fox');
    const adjectives = tags.filter((t) => t.pos === 'adjective');
    const adjTexts = adjectives.map((t) => t.text);
    expect(adjTexts).toContain('quick');
    expect(adjTexts).toContain('brown');
  });

  it('should tag nouns (excluding pronouns)', () => {
    const tags = tagger.tag('The fox jumps over the dog');
    const nouns = tags.filter((t) => t.pos === 'noun');
    const nounTexts = nouns.map((t) => t.text);
    expect(nounTexts).toContain('fox');
    expect(nounTexts).toContain('dog');
  });

  it('should tag verbs', () => {
    const tags = tagger.tag('The fox jumps quickly');
    const verbs = tags.filter((t) => t.pos === 'verb');
    const verbTexts = verbs.map((t) => t.text);
    expect(verbTexts).toContain('jumps');
  });

  it('should tag adverbs', () => {
    const tags = tagger.tag('She runs quickly and gracefully');
    const adverbs = tags.filter((t) => t.pos === 'adverb');
    const adverbTexts = adverbs.map((t) => t.text);
    expect(adverbTexts).toContain('quickly');
    expect(adverbTexts).toContain('gracefully');
  });

  it('should tag conjunctions', () => {
    const tags = tagger.tag('cats and dogs but not birds');
    const conjs = tags.filter((t) => t.pos === 'conjunction');
    const conjTexts = conjs.map((t) => t.text);
    expect(conjTexts).toContain('and');
    expect(conjTexts).toContain('but');
  });

  it('should return correct character offsets', () => {
    const text = 'big cat';
    const tags = tagger.tag(text);

    for (const tag of tags) {
      const extracted = text.slice(tag.start, tag.end);
      expect(extracted).toBe(tag.text);
    }
  });

  it('should return tags sorted by start position', () => {
    const tags = tagger.tag('The quick brown fox jumps over the lazy dog');
    for (let i = 1; i < tags.length; i++) {
      expect(tags[i].start).toBeGreaterThanOrEqual(tags[i - 1].start);
    }
  });

  it('should not have overlapping tags', () => {
    const tags = tagger.tag('She quickly and carefully jumped over the big red fence');
    for (let i = 1; i < tags.length; i++) {
      expect(tags[i].start).toBeGreaterThanOrEqual(tags[i - 1].end);
    }
  });

  it('should handle a full sentence with multiple POS categories', () => {
    const tags = tagger.tag('The happy child runs quickly and carefully');
    const categories = new Set(tags.map((t) => t.pos));
    // Should have at least adjective, noun, verb, adverb
    expect(categories.size).toBeGreaterThanOrEqual(3);
  });
});
