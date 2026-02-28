import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStrippedLinksProcessor } from '../src/document/stripped-links';
import { DEFAULT_DOCUMENT_SETTINGS, type DocumentSettings } from '../src/document/settings';

/** Helper to build a settings getter for tests */
function settingsGetter(overrides: Partial<DocumentSettings> = {}): () => DocumentSettings {
  const settings = { ...DEFAULT_DOCUMENT_SETTINGS, ...overrides };
  return () => settings;
}

// Minimal mock for MarkdownPostProcessorContext
function makeCtx() {
  return {
    getSectionInfo: vi.fn(),
    frontmatter: null,
    docId: '',
    sourcePath: '',
    addChild: vi.fn(),
  } as any;
}

/**
 * Lightweight mock DOM node. Supports querySelectorAll, replaceWith,
 * firstChild, and appendChild — enough for the stripped-links processor.
 */
class MockNode {
  tagName: string;
  children: MockNode[] = [];
  parent: MockNode | null = null;
  attrs: Record<string, string> = {};
  private _text: string | undefined;

  constructor(tag: string, text?: string) {
    this.tagName = tag.toUpperCase();
    this._text = text;
  }

  get textContent(): string {
    if (this.children.length === 0) return this._text ?? '';
    return this.children.map((c) => c.textContent).join('');
  }

  set textContent(val: string) {
    this.children = [];
    this._text = val;
  }

  get firstChild(): MockNode | null {
    return this.children[0] ?? null;
  }

  appendChild(child: MockNode): void {
    // Real DOM removes the child from its current parent on appendChild
    if (child.parent) {
      const idx = child.parent.children.indexOf(child);
      if (idx !== -1) child.parent.children.splice(idx, 1);
    }
    child.parent = this;
    this.children.push(child);
  }

  replaceWith(replacement: MockNode): void {
    if (!this.parent) return;
    const idx = this.parent.children.indexOf(this);
    if (idx !== -1) {
      replacement.parent = this.parent;
      this.parent.children[idx] = replacement;
    }
  }

  querySelectorAll(selector: string): MockNode[] {
    const tagMatch = selector.toUpperCase();
    const results: MockNode[] = [];
    const walk = (n: MockNode): void => {
      for (const child of n.children) {
        if (child.tagName === tagMatch) results.push(child);
        walk(child);
      }
    };
    walk(this);
    return results;
  }

  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }
}

/** Build: <div><p>{before}<a href={href}>{linkText}</a>{after}</p></div> */
function buildLinkEl(href: string, linkText: string, before = '', after = ''): MockNode {
  const el = new MockNode('div');
  const p = new MockNode('p');
  if (before) p.appendChild(new MockNode('#text', before));
  const a = new MockNode('a');
  if (href) a.setAttribute('href', href);
  a.appendChild(new MockNode('#text', linkText));
  p.appendChild(a);
  if (after) p.appendChild(new MockNode('#text', after));
  el.appendChild(p);
  return el;
}

describe('strippedLinksProcessor', () => {
  let origCreateElement: typeof document.createElement;

  beforeEach(() => {
    origCreateElement = (globalThis as any).document.createElement;
    (globalThis as any).document.createElement = (tag: string) => new MockNode(tag);
  });

  afterEach(() => {
    (globalThis as any).document.createElement = origCreateElement;
  });

  it('replaces <a> with <span> when links mode is stripped', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'stripped' }));
    const el = buildLinkEl('https://example.com', 'Example', 'See ', ' for details.');

    processor(el as any, makeCtx());

    expect(el.querySelectorAll('a').length).toBe(0);
    const spans = el.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('Example');
  });

  it('preserves surrounding text content', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'stripped' }));
    const el = buildLinkEl('#', 'link', 'Before ', ' after');

    processor(el as any, makeCtx());

    const p = el.children[0];
    expect(p.textContent).toBe('Before link after');
  });

  it('handles multiple links in a single element', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'stripped' }));
    const el = new MockNode('div');
    const p = new MockNode('p');
    const a1 = new MockNode('a');
    a1.setAttribute('href', '#');
    a1.appendChild(new MockNode('#text', 'first'));
    const a2 = new MockNode('a');
    a2.setAttribute('href', '#');
    a2.appendChild(new MockNode('#text', 'second'));
    p.appendChild(a1);
    p.appendChild(new MockNode('#text', ' and '));
    p.appendChild(a2);
    el.appendChild(p);

    processor(el as any, makeCtx());

    expect(el.querySelectorAll('a').length).toBe(0);
    expect(el.querySelectorAll('span').length).toBe(2);
    expect(p.textContent).toBe('first and second');
  });

  it('preserves nested elements inside links', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'stripped' }));
    const el = new MockNode('div');
    const p = new MockNode('p');
    const a = new MockNode('a');
    a.setAttribute('href', '#');
    const strong = new MockNode('strong');
    strong.appendChild(new MockNode('#text', 'bold'));
    a.appendChild(strong);
    a.appendChild(new MockNode('#text', ' text'));
    p.appendChild(a);
    el.appendChild(p);

    processor(el as any, makeCtx());

    const spans = el.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].querySelectorAll('strong').length).toBe(1);
    expect(spans[0].textContent).toBe('bold text');
  });

  it('handles empty links', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'stripped' }));
    const el = new MockNode('div');
    const p = new MockNode('p');
    p.appendChild(new MockNode('#text', 'text '));
    const a = new MockNode('a');
    a.setAttribute('href', '#');
    p.appendChild(a);
    p.appendChild(new MockNode('#text', ' more'));
    el.appendChild(p);

    processor(el as any, makeCtx());

    expect(el.querySelectorAll('a').length).toBe(0);
    const spans = el.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('');
  });

  it('handles links with no href', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'stripped' }));
    const el = new MockNode('div');
    const p = new MockNode('p');
    const a = new MockNode('a');
    a.appendChild(new MockNode('#text', 'no href link'));
    p.appendChild(a);
    el.appendChild(p);

    processor(el as any, makeCtx());

    expect(el.querySelectorAll('a').length).toBe(0);
    const spans = el.querySelectorAll('span');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('no href link');
  });

  // --- Guard: other link modes should not strip ---

  it('does nothing when links mode is expand', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'expand' }));
    const el = buildLinkEl('#', 'link');

    processor(el as any, makeCtx());

    expect(el.querySelectorAll('a').length).toBe(1);
    expect(el.querySelectorAll('span').length).toBe(0);
  });

  it('does nothing when links mode is styled', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'styled' }));
    const el = buildLinkEl('#', 'link');

    processor(el as any, makeCtx());

    expect(el.querySelectorAll('a').length).toBe(1);
  });

  it('does nothing when links mode is plain', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'plain' }));
    const el = buildLinkEl('#', 'link');

    processor(el as any, makeCtx());

    expect(el.querySelectorAll('a').length).toBe(1);
  });

  it('does nothing when element has no links', () => {
    const processor = createStrippedLinksProcessor(settingsGetter({ links: 'stripped' }));
    const el = new MockNode('div');
    const p = new MockNode('p');
    p.appendChild(new MockNode('#text', 'plain text only'));
    el.appendChild(p);

    processor(el as any, makeCtx());

    expect(p.textContent).toBe('plain text only');
  });
});
