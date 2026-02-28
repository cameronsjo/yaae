import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defangUrl, createDefangedLinksProcessor } from '../src/document/defanged-links';
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
 * Lightweight DOM node mock with enough fidelity for the defanged-links
 * processor: querySelectorAll, replaceWith, getAttribute, setAttribute,
 * and textContent traversal.
 */
interface MockNode {
  tagName: string;
  textContent: string;
  className: string;
  children: MockNode[];
  parent: MockNode | null;
  attrs: Record<string, string>;
  firstChild: MockNode | null;
  appendChild(child: MockNode): void;
  replaceWith(replacement: MockNode): void;
  querySelectorAll(selector: string): MockNode[];
  querySelector(selector: string): MockNode | null;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
}

function createMockNode(tag: string, text?: string): MockNode {
  const node: MockNode = {
    tagName: tag.toUpperCase(),
    className: '',
    children: [],
    parent: null,
    attrs: {},
    get textContent(): string {
      if (node.children.length === 0) return (node as any)._text ?? '';
      return node.children.map((c) => c.textContent).join('');
    },
    set textContent(val: string) {
      node.children.length = 0;
      node.firstChild = null;
      (node as any)._text = val;
    },
    get firstChild(): MockNode | null {
      return node.children[0] ?? null;
    },
    set firstChild(_v: MockNode | null) {
      // computed getter, setter is a no-op
    },
    appendChild(child: MockNode) {
      child.parent = node;
      node.children.push(child);
    },
    replaceWith(replacement: MockNode) {
      if (!node.parent) return;
      const idx = node.parent.children.indexOf(node);
      if (idx !== -1) {
        replacement.parent = node.parent;
        node.parent.children[idx] = replacement;
      }
    },
    querySelectorAll(selector: string): MockNode[] {
      // Support simple class selector `.foo` or tag selector `a`
      const results: MockNode[] = [];
      function walk(n: MockNode) {
        for (const child of n.children) {
          if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            if (child.className.split(/\s+/).includes(cls)) results.push(child);
          } else if (child.tagName === selector.toUpperCase()) {
            results.push(child);
          }
          walk(child);
        }
      }
      walk(node);
      return results;
    },
    querySelector(selector: string): MockNode | null {
      return node.querySelectorAll(selector)[0] ?? null;
    },
    setAttribute(name: string, value: string) {
      node.attrs[name] = value;
    },
    getAttribute(name: string): string | null {
      return node.attrs[name] ?? null;
    },
  };
  if (text !== undefined) {
    (node as any)._text = text;
  }
  return node;
}

/** Mock document.createElement to return our mock nodes */
function setupMockDocument() {
  const origCreateElement = (globalThis as any).document.createElement;
  (globalThis as any).document.createElement = (tag: string) => createMockNode(tag);
  return () => {
    (globalThis as any).document.createElement = origCreateElement;
  };
}

/** Build: <div><a href={href}>{linkText}</a></div> */
function buildLinkEl(href: string, linkText: string): MockNode {
  const el = createMockNode('div');
  const a = createMockNode('a');
  if (href) a.setAttribute('href', href);
  a.appendChild(createMockNode('#text', linkText));
  el.appendChild(a);
  return el;
}

// ---------------------------------------------------------------------------
// defangUrl -- pure function tests
// ---------------------------------------------------------------------------

describe('defangUrl', () => {
  it('replaces https:// with hxxps://', () => {
    expect(defangUrl('https://example.com')).toBe('hxxps://example[.]com');
  });

  it('replaces http:// with hxxp://', () => {
    expect(defangUrl('http://example.com')).toBe('hxxp://example[.]com');
  });

  it('replaces dots in domain only, not in path', () => {
    expect(defangUrl('https://example.com/path/file.txt')).toBe(
      'hxxps://example[.]com/path/file.txt',
    );
  });

  it('handles subdomains', () => {
    expect(defangUrl('https://www.sub.example.com')).toBe(
      'hxxps://www[.]sub[.]example[.]com',
    );
  });

  it('preserves port numbers', () => {
    expect(defangUrl('https://example.com:8080/api')).toBe(
      'hxxps://example[.]com:8080/api',
    );
  });

  it('preserves query strings', () => {
    expect(defangUrl('https://example.com/search?q=test&page=1')).toBe(
      'hxxps://example[.]com/search?q=test&page=1',
    );
  });

  it('preserves fragment identifiers', () => {
    expect(defangUrl('https://example.com/page#section')).toBe(
      'hxxps://example[.]com/page#section',
    );
  });

  it('handles query string without path', () => {
    expect(defangUrl('https://example.com?q=test')).toBe(
      'hxxps://example[.]com?q=test',
    );
  });

  it('handles fragment without path', () => {
    expect(defangUrl('https://example.com#top')).toBe(
      'hxxps://example[.]com#top',
    );
  });

  it('handles URL with dots in query string', () => {
    expect(defangUrl('https://example.com/api?host=other.site.com')).toBe(
      'hxxps://example[.]com/api?host=other.site.com',
    );
  });

  it('handles URL with dots in path', () => {
    expect(defangUrl('https://example.com/v1.0/api.json')).toBe(
      'hxxps://example[.]com/v1.0/api.json',
    );
  });

  it('is case-insensitive for protocol', () => {
    expect(defangUrl('HTTPS://Example.com')).toBe('hxxps://Example[.]com');
    expect(defangUrl('HTTP://Example.com')).toBe('hxxp://Example[.]com');
  });

  it('handles IP addresses', () => {
    expect(defangUrl('https://192.168.1.1/admin')).toBe(
      'hxxps://192[.]168[.]1[.]1/admin',
    );
  });

  it('handles URL without path', () => {
    expect(defangUrl('https://example.com')).toBe('hxxps://example[.]com');
  });
});

// ---------------------------------------------------------------------------
// createDefangedLinksProcessor -- DOM tests
// ---------------------------------------------------------------------------

describe('defangedLinksProcessor', () => {
  let restoreDocument: () => void;

  beforeEach(() => {
    restoreDocument = setupMockDocument();
  });

  afterEach(() => {
    restoreDocument();
  });

  it('defangs links when mode is defanged', () => {
    const processor = createDefangedLinksProcessor(
      settingsGetter({ links: 'defanged' }),
    );

    const el = buildLinkEl(
      'https://malware.example.com/payload',
      'https://malware.example.com/payload',
    );

    processor(el as any, makeCtx());

    // Anchor should be replaced with a span
    const spans = el.querySelectorAll('.yaae-defanged-link');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('hxxps://malware[.]example[.]com/payload');
    expect(el.querySelectorAll('a').length).toBe(0);
  });

  it('does nothing when mode is not defanged', () => {
    for (const mode of ['expand', 'styled', 'plain', 'stripped'] as const) {
      const processor = createDefangedLinksProcessor(settingsGetter({ links: mode }));
      const el = buildLinkEl('https://example.com', 'Example');

      processor(el as any, makeCtx());

      expect(el.querySelectorAll('a').length).toBe(1);
      expect(el.querySelectorAll('.yaae-defanged-link').length).toBe(0);
    }
  });

  it('skips anchors without href', () => {
    const processor = createDefangedLinksProcessor(
      settingsGetter({ links: 'defanged' }),
    );

    const el = createMockNode('div');
    const a = createMockNode('a');
    a.appendChild(createMockNode('#text', 'No href'));
    el.appendChild(a);

    processor(el as any, makeCtx());

    // Anchor should remain unchanged (no href)
    expect(el.querySelectorAll('a').length).toBe(1);
    expect(el.querySelectorAll('.yaae-defanged-link').length).toBe(0);
  });

  it('skips non-http links', () => {
    const processor = createDefangedLinksProcessor(
      settingsGetter({ links: 'defanged' }),
    );

    const el = buildLinkEl('mailto:user@example.com', 'user@example.com');

    processor(el as any, makeCtx());

    expect(el.querySelectorAll('a').length).toBe(1);
    expect(el.querySelectorAll('.yaae-defanged-link').length).toBe(0);
  });

  it('defangs multiple links in one section', () => {
    const processor = createDefangedLinksProcessor(
      settingsGetter({ links: 'defanged' }),
    );

    const el = createMockNode('div');
    const a1 = createMockNode('a');
    a1.setAttribute('href', 'https://evil.com');
    a1.appendChild(createMockNode('#text', 'https://evil.com'));
    const a2 = createMockNode('a');
    a2.setAttribute('href', 'http://bad.site.org/phish');
    a2.appendChild(createMockNode('#text', 'http://bad.site.org/phish'));
    el.appendChild(a1);
    el.appendChild(a2);

    processor(el as any, makeCtx());

    const spans = el.querySelectorAll('.yaae-defanged-link');
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe('hxxps://evil[.]com');
    expect(spans[1].textContent).toBe('hxxp://bad[.]site[.]org/phish');
  });

  it('preserves link text when it does not match the URL', () => {
    const processor = createDefangedLinksProcessor(
      settingsGetter({ links: 'defanged' }),
    );

    const el = buildLinkEl('https://example.com', 'Click here');

    processor(el as any, makeCtx());

    const spans = el.querySelectorAll('.yaae-defanged-link');
    expect(spans.length).toBe(1);
    // Text remains "Click here" since it doesn't contain the URL
    expect(spans[0].textContent).toBe('Click here');
  });

  it('handles element with no links', () => {
    const processor = createDefangedLinksProcessor(
      settingsGetter({ links: 'defanged' }),
    );

    const el = createMockNode('div');
    el.appendChild(createMockNode('#text', 'plain text only'));

    processor(el as any, makeCtx());

    expect(el.textContent).toBe('plain text only');
    expect(el.querySelectorAll('.yaae-defanged-link').length).toBe(0);
  });
});
