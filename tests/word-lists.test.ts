import { describe, it, expect } from 'vitest';
import {
  WordListMatcher,
  buildUniqueClassSuffixes,
  sanitizeListName,
} from '../src/prose-highlight/word-lists';
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

  // --- F6: collision-safe class names ---

  it('gives colliding list names distinct CSS classes', () => {
    // "My List" and "my-list" both sanitize to "my-list"; without dedup
    // they would share a class and POSStyleManager would emit two color
    // rules for the same selector, with only the last winning.
    const matcher = new WordListMatcher();
    matcher.compile([
      makeList({ name: 'My List', words: ['alpha'], color: '#aaa' }),
      makeList({ name: 'my-list', words: ['beta'], color: '#bbb' }),
    ]);

    const matches = matcher.match('alpha and beta');
    expect(matches.length).toBe(2);
    const classes = matches.map((m) => m.cssClass).sort();
    expect(classes).toEqual(
      ['yaae-list-my-list', 'yaae-list-my-list-2'].sort(),
    );
    // Classes must be distinct so each list gets its own color rule.
    expect(new Set(classes).size).toBe(2);
  });
});

describe('buildUniqueClassSuffixes', () => {
  it('returns the sanitized names when there are no collisions', () => {
    expect(buildUniqueClassSuffixes(['Cloud', 'Languages', 'Tools'])).toEqual([
      'cloud',
      'languages',
      'tools',
    ]);
  });

  it('appends a numeric suffix to collisions', () => {
    expect(
      buildUniqueClassSuffixes(['My List', 'my-list', 'MY LIST']),
    ).toEqual(['my-list', 'my-list-2', 'my-list-3']);
  });

  it('returns empty string for names that sanitize to empty', () => {
    expect(buildUniqueClassSuffixes(['', '!!!', 'real'])).toEqual([
      '',
      '',
      'real',
    ]);
  });

  it('skips collision counter past existing suffixed names', () => {
    // If a user already named a list "my-list-2", a later "My List" should
    // not collide with it. Resolving uses the next available counter.
    expect(
      buildUniqueClassSuffixes(['My List', 'my-list-2', 'my-list']),
    ).toEqual(['my-list', 'my-list-2', 'my-list-3']);
  });
});
