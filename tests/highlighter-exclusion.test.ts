import { describe, it, expect } from 'vitest';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { markdown } from '@codemirror/lang-markdown';
import type { EditorView } from '@codemirror/view';
import {
  getExcludedRanges,
  mergeRanges,
  isExcluded,
  isExcludedNodeType,
} from '../src/prose-highlight/highlighter-plugin';

/**
 * A markdown document mixing prose, a fenced code block, and inline code.
 * Source-mode (Lezer) node names are reproducible here; HyperMD Live-Preview
 * names are Obsidian-internal and cannot be tested outside Obsidian.
 */
const DOC = [
  'This is beautiful prose with adjectives.', // line 1 — prose
  '',
  '```js',
  'const beautiful = 42;',
  'function quickly() {}',
  '```',
  '',
  'More prose with `inline code` words here.', // last line — inline code
].join('\n');

/**
 * getExcludedRanges only reads `view.state`, so a bare `{ state }` stub stands
 * in for a real (DOM-bound) EditorView in this headless test.
 */
function stateView(doc: string): EditorView {
  const state = EditorState.create({ doc, extensions: [markdown()] });
  // Force a complete parse so syntaxTree() inside getExcludedRanges is whole.
  // Fail loudly on an incomplete parse rather than silently asserting against
  // a partial tree (a slow CI host or a larger doc could otherwise hide a bug).
  if (!ensureSyntaxTree(state, doc.length, 5000)) {
    throw new Error('markdown parse did not complete within the test budget');
  }
  return { state } as unknown as EditorView;
}

describe('getExcludedRanges (real Lezer markdown tree)', () => {
  const view = stateView(DOC);
  const excluded = getExcludedRanges(view, 0, DOC.length);

  it('covers the full fenced-code block', () => {
    const fenceOpen = DOC.indexOf('```js');
    const fenceClose = DOC.lastIndexOf('```') + 3;
    // Every offset across the fenced block must be excluded.
    for (const probe of [
      fenceOpen,
      DOC.indexOf('const beautiful'),
      DOC.indexOf('function quickly'),
      fenceClose - 1,
    ]) {
      expect(isExcluded(probe, excluded)).toBe(true);
    }
  });

  it('covers the inline-code span', () => {
    expect(isExcluded(DOC.indexOf('inline code'), excluded)).toBe(true);
  });

  it('rejects a tag position inside code', () => {
    // "beautiful" / "quickly" inside the fence must be rejected.
    expect(isExcluded(DOC.indexOf('beautiful = 42'), excluded)).toBe(true);
  });

  it('keeps a prose position outside code', () => {
    // "beautiful" in the first prose line is NOT excluded.
    expect(isExcluded(DOC.indexOf('beautiful prose'), excluded)).toBe(false);
    expect(isExcluded(DOC.indexOf('adjectives'), excluded)).toBe(false);
  });
});

describe('isExcludedNodeType predicate', () => {
  it('excludes code/frontmatter/comment node families', () => {
    for (const name of [
      'FencedCode',
      'InlineCode',
      'hmd-codeblock',
      'CodeText',
      'formatting-code',
      'YAMLFrontMatter',
      'hmd-frontmatter',
      'CommentBlock',
    ]) {
      expect(isExcludedNodeType(name)).toBe(true);
    }
  });

  it('keeps structural prose nodes', () => {
    for (const name of [
      'Document',
      'Paragraph',
      'Emphasis',
      'StrongEmphasis',
      'Heading',
    ]) {
      expect(isExcludedNodeType(name)).toBe(false);
    }
  });
});

describe('mergeRanges', () => {
  it('merges overlapping and adjacent ranges, keeps disjoint', () => {
    expect(
      mergeRanges([
        { from: 0, to: 5 },
        { from: 3, to: 8 },
        { from: 8, to: 10 },
        { from: 15, to: 20 },
      ]),
    ).toEqual([
      { from: 0, to: 10 },
      { from: 15, to: 20 },
    ]);
  });

  it('returns [] for empty input', () => {
    expect(mergeRanges([])).toEqual([]);
  });
});

describe('isExcluded', () => {
  const ranges = [{ from: 10, to: 20 }];

  it('is inclusive of from, exclusive of to', () => {
    expect(isExcluded(10, ranges)).toBe(true);
    expect(isExcluded(19, ranges)).toBe(true);
    expect(isExcluded(20, ranges)).toBe(false);
  });

  it('rejects positions outside every range', () => {
    expect(isExcluded(5, ranges)).toBe(false);
    expect(isExcluded(25, ranges)).toBe(false);
  });
});
