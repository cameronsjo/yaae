import { describe, it, expect } from 'vitest';
import { isHeadingLine } from '../src/prose-highlight/highlighter-plugin';
import { buildSkipSelectors } from '../src/prose-highlight/reading-view';

/**
 * "Highlight inside headings" defaults to off (Artificer #40): heading text
 * is chrome, not prose. The editor path skips heading LINES; the reading-view
 * path skips heading ELEMENTS via the closest() selector.
 */

describe('isHeadingLine (editor path)', () => {
  it.each([
    '# H1',
    '## H2',
    '###### H6',
    '   ### indented up to 3 spaces',
    '> # blockquoted heading',
    '>> ## nested blockquote heading',
    '> ### spaced blockquote heading',
  ])('treats %j as a heading', (line) => expect(isHeadingLine(line)).toBe(true));

  it.each([
    ['####### seven hashes is not a heading', false],
    ['#nospace', false],
    ['    # four-space indent is a code block', false],
    ['plain prose', false],
    ['a # b — hash mid-line', false],
    ['', false],
    // Setext underline + title: an accepted editor-path gap (the check is
    // single-line; Reading View skips setext via the h1..h6 selector).
    ['Setext Title', false],
    ['========', false],
  ])('treats %j as non-heading', (line, expected) => {
    expect(isHeadingLine(line as string)).toBe(expected);
  });
});

describe('buildSkipSelectors (reading-view path)', () => {
  it('adds heading elements to the skip set by default', () => {
    const sel = buildSkipSelectors(false);
    expect(sel).toContain('h1, h2, h3, h4, h5, h6');
    // Base exclusions remain.
    expect(sel).toContain('code');
    expect(sel).toContain('.frontmatter');
  });

  it('drops heading elements when highlighting inside headings is enabled', () => {
    const sel = buildSkipSelectors(true);
    expect(sel).not.toContain('h1, h2');
    expect(sel).toContain('code');
  });
});
