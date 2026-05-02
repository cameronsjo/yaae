import { describe, it, expect, vi } from 'vitest';
import {
  buildSpans,
  createReadingViewPostProcessor,
} from '../src/prose-highlight/reading-view';
import { WordListMatcher } from '../src/prose-highlight/word-lists';
import type { POSTag } from '../src/prose-highlight/tagger';
import type { WordListMatch } from '../src/prose-highlight/word-lists';
import {
  DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
  type ProseHighlightSettings,
  type CustomWordList,
} from '../src/types';

function settings(partial: Partial<ProseHighlightSettings> = {}): ProseHighlightSettings {
  return {
    ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
    enabled: true,
    readingViewEnabled: true,
    ...partial,
  };
}

function makeList(overrides: Partial<CustomWordList> = {}): CustomWordList {
  return {
    name: 'list',
    words: ['foo'],
    color: '#fff',
    enabled: true,
    caseSensitive: false,
    ...overrides,
  };
}

// Minimal stub for the post-processor's HTMLElement / TreeWalker contract.
// We only care that text nodes are processed; tests for F5 spy on the
// matcher to confirm compile-rate, and tests for F7 hit buildSpans directly.
function makePlugin(s: ProseHighlightSettings) {
  return { settings: { proseHighlight: s } } as never;
}

function makeBlockEl(text: string): HTMLElement {
  // jsdom is not enabled — fabricate the minimum shape the post-processor
  // touches: TreeWalker + Text nodes. We construct a tiny DOM-compatible
  // graph manually so the post-processor doesn't crash.
  const textNode = {
    textContent: text,
    parentElement: null,
    parentNode: { replaceChild: vi.fn() },
  };
  const walker = {
    _nodes: [textNode],
    _i: -1,
    currentNode: null as unknown,
    nextNode() {
      this._i++;
      if (this._i >= this._nodes.length) return null;
      this.currentNode = this._nodes[this._i];
      return this.currentNode;
    },
  };
  // Stash on globalThis.document for the duration of the call.
  (globalThis as Record<string, unknown>).document = {
    createTreeWalker: () => walker,
    createDocumentFragment: () => ({ appendChild: vi.fn() }),
    createElement: () => ({ className: '', textContent: '' }),
    createTextNode: (t: string) => ({ textContent: t }),
  };
  // NodeFilter is referenced by the post-processor; stub the constants it
  // uses so the call site doesn't throw in node-environment tests.
  (globalThis as Record<string, unknown>).NodeFilter = {
    SHOW_TEXT: 4,
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2,
    FILTER_SKIP: 3,
  };
  // The post-processor only uses `el` to scope the walker, never reads it.
  return {} as HTMLElement;
}

describe('reading-view post-processor (F5: regex compile rate)', () => {
  it('compiles word lists once per render, not per text node', () => {
    const compileSpy = vi.spyOn(
      WordListMatcher.prototype,
      'compile',
    );

    const lists: CustomWordList[] = [makeList({ words: ['foo'] })];
    const plugin = makePlugin(settings({ customWordLists: lists }));
    const processor = createReadingViewPostProcessor(plugin);

    // Three calls = three render cycles for three blocks. The settings
    // array reference is the same across all three, so compile must run
    // exactly once total.
    processor(makeBlockEl('foo bar'), {} as never);
    processor(makeBlockEl('foo baz'), {} as never);
    processor(makeBlockEl('foo qux'), {} as never);

    expect(compileSpy).toHaveBeenCalledTimes(1);
    compileSpy.mockRestore();
  });

  it('recompiles when the settings array reference changes', () => {
    const compileSpy = vi.spyOn(
      WordListMatcher.prototype,
      'compile',
    );

    const lists1: CustomWordList[] = [makeList({ words: ['foo'] })];
    const settings1 = settings({ customWordLists: lists1 });
    const plugin = { settings: { proseHighlight: settings1 } } as never;
    const processor = createReadingViewPostProcessor(plugin);

    processor(makeBlockEl('foo bar'), {} as never);
    expect(compileSpy).toHaveBeenCalledTimes(1);

    // Swap to a new lists array (simulates settings save).
    const lists2: CustomWordList[] = [makeList({ words: ['baz'] })];
    plugin.settings.proseHighlight = settings({ customWordLists: lists2 });

    processor(makeBlockEl('foo bar'), {} as never);
    expect(compileSpy).toHaveBeenCalledTimes(2);

    compileSpy.mockRestore();
  });
});

describe('buildSpans (F7: per-character overlap)', () => {
  function posSettings() {
    return {
      categories: {
        adjective: { enabled: true },
        noun: { enabled: true },
        adverb: { enabled: true },
        verb: { enabled: true },
        conjunction: { enabled: true },
      },
    };
  }

  it('suppresses a POS tag when a list match covers any of its positions', () => {
    // List match "oo" at [6, 8) lives inside POS tag "good" at [5, 9).
    // Old code only checked tag.start (5), which was NOT covered, so both
    // spans were emitted and the rendered fragment was corrupt.
    const posTags: POSTag[] = [
      { text: 'good', pos: 'adjective', start: 5, end: 9 },
    ];
    const listMatches: WordListMatch[] = [
      {
        text: 'oo',
        listName: 'mid-overlap',
        cssClass: 'yaae-list-mid-overlap',
        start: 6,
        end: 8,
      },
    ];

    const spans = buildSpans(posTags, listMatches, posSettings());
    // Only the list match survives.
    expect(spans).toHaveLength(1);
    expect(spans[0].cssClass).toBe('yaae-list-mid-overlap');
    expect(spans[0].start).toBe(6);
    expect(spans[0].end).toBe(8);
  });

  it('keeps non-overlapping POS tags', () => {
    const posTags: POSTag[] = [
      { text: 'good', pos: 'adjective', start: 0, end: 4 },
      { text: 'cat', pos: 'noun', start: 5, end: 8 },
    ];
    const listMatches: WordListMatch[] = [
      {
        text: 'cat',
        listName: 'animals',
        cssClass: 'yaae-list-animals',
        start: 5,
        end: 8,
      },
    ];

    const spans = buildSpans(posTags, listMatches, posSettings());
    // POS "good" survives; POS "cat" is suppressed; list "cat" wins.
    expect(spans).toHaveLength(2);
    const classes = spans.map((s) => s.cssClass);
    expect(classes).toContain('yaae-pos-adjective');
    expect(classes).toContain('yaae-list-animals');
    expect(classes).not.toContain('yaae-pos-noun');
  });

  it('drops POS tags whose start is outside but body overlaps a list match', () => {
    // Tag spans [10, 20). List spans [15, 17), entirely inside.
    const posTags: POSTag[] = [
      { text: 'wonderful', pos: 'adjective', start: 10, end: 20 },
    ];
    const listMatches: WordListMatch[] = [
      {
        text: 'der',
        listName: 'mid',
        cssClass: 'yaae-list-mid',
        start: 15,
        end: 18,
      },
    ];

    const spans = buildSpans(posTags, listMatches, posSettings());
    expect(spans).toHaveLength(1);
    expect(spans[0].cssClass).toBe('yaae-list-mid');
  });
});
