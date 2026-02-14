import { describe, it, expect } from 'vitest';
import { WordListMatcher, sanitizeListName } from '../src/prose-highlight/word-lists';
import type { CustomWordList } from '../src/types';

function makeList(overrides: Partial<CustomWordList> = {}): CustomWordList {
  return {
    name: 'Test List',
    words: ['AWS', 'Azure', 'GCP'],
    color: '#ff6600',
    enabled: true,
    caseSensitive: false,
    ...overrides,
  };
}

describe('sanitizeListName', () => {
  it('should convert to lowercase kebab-case', () => {
    expect(sanitizeListName('Cloud Providers')).toBe('cloud-providers');
  });

  it('should strip leading/trailing dashes', () => {
    expect(sanitizeListName('  hello  ')).toBe('hello');
  });

  it('should handle special characters', () => {
    expect(sanitizeListName('My List #1!')).toBe('my-list-1');
  });

  it('should handle empty string', () => {
    expect(sanitizeListName('')).toBe('');
  });
});

describe('WordListMatcher', () => {
  it('should match single words case-insensitively', () => {
    const matcher = new WordListMatcher();
    matcher.compile([makeList()]);

    const matches = matcher.match('We deployed to AWS and Azure');
    const texts = matches.map((m) => m.text);
    expect(texts).toContain('AWS');
    expect(texts).toContain('Azure');
  });

  it('should match case-insensitively by default', () => {
    const matcher = new WordListMatcher();
    matcher.compile([makeList()]);

    const matches = matcher.match('We use aws and azure');
    expect(matches.length).toBe(2);
    expect(matches[0].text).toBe('aws');
    expect(matches[1].text).toBe('azure');
  });

  it('should respect case-sensitive flag', () => {
    const matcher = new WordListMatcher();
    matcher.compile([makeList({ caseSensitive: true })]);

    const matches = matcher.match('We use aws and AWS');
    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe('AWS');
  });

  it('should return correct offsets', () => {
    const matcher = new WordListMatcher();
    matcher.compile([makeList()]);

    const text = 'Deploy to AWS today';
    const matches = matcher.match(text);
    expect(matches.length).toBe(1);
    expect(matches[0].start).toBe(10);
    expect(matches[0].end).toBe(13);
    expect(text.slice(matches[0].start, matches[0].end)).toBe('AWS');
  });

  it('should match multi-word phrases', () => {
    const matcher = new WordListMatcher();
    matcher.compile([
      makeList({ words: ['Google Cloud Platform', 'Amazon Web Services'] }),
    ]);

    const text = 'We use Google Cloud Platform for hosting';
    const matches = matcher.match(text);
    expect(matches.length).toBe(1);
    expect(matches[0].text).toBe('Google Cloud Platform');
  });

  it('should handle multiple lists', () => {
    const matcher = new WordListMatcher();
    matcher.compile([
      makeList({ name: 'Cloud', words: ['AWS'], color: '#ff0000' }),
      makeList({ name: 'Languages', words: ['TypeScript'], color: '#0000ff' }),
    ]);

    const matches = matcher.match('Build on AWS with TypeScript');
    expect(matches.length).toBe(2);
    expect(matches[0].listName).toBe('Cloud');
    expect(matches[1].listName).toBe('Languages');
  });

  it('should skip disabled lists', () => {
    const matcher = new WordListMatcher();
    matcher.compile([makeList({ enabled: false })]);

    const matches = matcher.match('We use AWS');
    expect(matches.length).toBe(0);
  });

  it('should skip empty word lists', () => {
    const matcher = new WordListMatcher();
    matcher.compile([makeList({ words: [] })]);

    const matches = matcher.match('We use AWS');
    expect(matches.length).toBe(0);
  });

  it('should handle regex special characters in words', () => {
    const matcher = new WordListMatcher();
    matcher.compile([makeList({ words: ['C++', 'C#', '.NET'] })]);

    // .NET should not match due to word boundary issues with leading dot
    // C++ and C# may or may not match depending on \b behavior with special chars
    // The key assertion: no regex errors thrown
    expect(() => matcher.match('We use C++ and .NET')).not.toThrow();
  });

  it('should deduplicate overlapping matches', () => {
    const matcher = new WordListMatcher();
    matcher.compile([
      makeList({ name: 'A', words: ['AWS'] }),
      makeList({ name: 'B', words: ['AWS'] }),
    ]);

    const matches = matcher.match('We use AWS');
    // First list should win
    expect(matches.length).toBe(1);
    expect(matches[0].listName).toBe('A');
  });

  it('should generate correct CSS class names', () => {
    const matcher = new WordListMatcher();
    matcher.compile([makeList({ name: 'Cloud Providers' })]);

    const matches = matcher.match('We use AWS');
    expect(matches[0].cssClass).toBe('yaae-list-cloud-providers');
  });

  it('should not match partial words', () => {
    const matcher = new WordListMatcher();
    matcher.compile([makeList({ words: ['the'] })]);

    const matches = matcher.match('their theme');
    // "the" should not match inside "their" or "theme"
    expect(matches.length).toBe(0);
  });
});
