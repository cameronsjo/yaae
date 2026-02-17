import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POSStyleManager } from '../src/prose-highlight/pos-styles';
import { DEFAULT_PROSE_HIGHLIGHT_SETTINGS } from '../src/types';
import type { ProseHighlightSettings } from '../src/types';

// Mock document.head and createElement for Node.js environment
function setupDOM() {
  const styleEl = {
    id: '',
    textContent: '',
    remove: vi.fn(),
  };

  const headAppendChild = vi.fn();
  (globalThis as any).document = {
    createElement: vi.fn(() => styleEl),
    head: {
      appendChild: headAppendChild,
    },
  };

  return { styleEl, headAppendChild };
}

describe('POSStyleManager', () => {
  let manager: POSStyleManager;
  let dom: ReturnType<typeof setupDOM>;

  beforeEach(() => {
    dom = setupDOM();
    manager = new POSStyleManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  // --- Happy paths ---

  it('should create a <style> element on init', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    expect(document.createElement).toHaveBeenCalledWith('style');
    expect(dom.headAppendChild).toHaveBeenCalled();
  });

  it('should set CSS custom properties for all POS categories', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    const css = dom.styleEl.textContent;

    expect(css).toContain('--yaae-pos-adjective-color');
    expect(css).toContain('--yaae-pos-noun-color');
    expect(css).toContain('--yaae-pos-adverb-color');
    expect(css).toContain('--yaae-pos-verb-color');
    expect(css).toContain('--yaae-pos-conjunction-color');
  });

  it('should wrap POS variables in a body {} block', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    const css = dom.styleEl.textContent;

    expect(css).toMatch(/^body \{.*--yaae-pos-.*\}$/m);
  });

  it('should not emit .yaae-pos-* class selectors (static in styles.css)', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    const css = dom.styleEl.textContent;

    expect(css).not.toContain('.yaae-pos-adjective');
    expect(css).not.toContain('.yaae-pos-noun');
  });

  it('should use default iA Writer colors', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    const css = dom.styleEl.textContent;

    expect(css).toContain('#b97a0a'); // adjective
    expect(css).toContain('#ce4924'); // noun
    expect(css).toContain('#c333a7'); // adverb
    expect(css).toContain('#177eB8'); // verb
    expect(css).toContain('#01934e'); // conjunction
  });

  it('should update CSS variables when colors change', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);

    const newSettings: ProseHighlightSettings = {
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      categories: {
        ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS.categories,
        adjective: { enabled: true, color: '#ff0000' },
      },
    };

    manager.update(newSettings);
    const css = dom.styleEl.textContent;

    expect(css).toContain('--yaae-pos-adjective-color: #ff0000;');
    // Other categories unchanged
    expect(css).toContain('--yaae-pos-noun-color: #ce4924;');
  });

  it('should include custom word list CSS rules as direct class selectors', () => {
    const settings: ProseHighlightSettings = {
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      customWordLists: [
        {
          name: 'Cloud Providers',
          words: ['AWS'],
          color: '#ff6600',
          enabled: true,
          caseSensitive: false,
        },
      ],
    };

    manager.init(settings);
    const css = dom.styleEl.textContent;

    expect(css).toContain('.yaae-list-cloud-providers');
    expect(css).toContain('#ff6600');
  });

  it('should handle multiple word lists', () => {
    const settings: ProseHighlightSettings = {
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      customWordLists: [
        { name: 'List A', words: ['foo'], color: '#aaa', enabled: true, caseSensitive: false },
        { name: 'List B', words: ['bar'], color: '#bbb', enabled: true, caseSensitive: false },
      ],
    };

    manager.init(settings);
    const css = dom.styleEl.textContent;

    expect(css).toContain('.yaae-list-list-a');
    expect(css).toContain('.yaae-list-list-b');
    expect(css).toContain('#aaa');
    expect(css).toContain('#bbb');
  });

  it('should remove <style> element on destroy', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    manager.destroy();
    expect(dom.styleEl.remove).toHaveBeenCalled();
  });

  it('update() should replace old list rules with new ones', () => {
    manager.init({
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      customWordLists: [
        { name: 'Old', words: ['x'], color: '#111', enabled: true, caseSensitive: false },
      ],
    });

    manager.update({
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      customWordLists: [
        { name: 'New', words: ['y'], color: '#222', enabled: true, caseSensitive: false },
      ],
    });
    const css = dom.styleEl.textContent;

    // POS variables still present
    expect(css).toContain('--yaae-pos-adjective-color');
    // Old list gone, new list present
    expect(css).not.toContain('.yaae-list-old');
    expect(css).toContain('.yaae-list-new');
    expect(css).toContain('#222');
  });

  // --- Unhappy paths ---

  it('update() before init() should be a no-op', () => {
    // No init called — styleEl is null
    manager.update(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    // Should not throw, style element should be untouched
    expect(dom.styleEl.textContent).toBe('');
  });


  it('destroy() before init() should not throw', () => {
    expect(() => manager.destroy()).not.toThrow();
  });

  it('destroy() called twice should not throw', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    manager.destroy();
    expect(() => manager.destroy()).not.toThrow();
  });

  it('should skip word lists with empty name', () => {
    const settings: ProseHighlightSettings = {
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      customWordLists: [
        { name: '', words: ['x'], color: '#abc', enabled: true, caseSensitive: false },
      ],
    };

    manager.init(settings);
    const css = dom.styleEl.textContent;

    expect(css).not.toContain('.yaae-list-');
    expect(css).not.toContain('#abc');
  });

  it('should skip word lists whose name sanitizes to empty', () => {
    const settings: ProseHighlightSettings = {
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      customWordLists: [
        { name: '!!!', words: ['x'], color: '#abc', enabled: true, caseSensitive: false },
      ],
    };

    manager.init(settings);
    const css = dom.styleEl.textContent;

    expect(css).not.toContain('.yaae-list-');
    expect(css).not.toContain('#abc');
  });

  it('should still emit POS variables when word lists are empty', () => {
    const settings: ProseHighlightSettings = {
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      customWordLists: [],
    };

    manager.init(settings);
    const css = dom.styleEl.textContent;

    expect(css).toContain('--yaae-pos-adjective-color');
    expect(css).not.toContain('.yaae-list-');
  });

  it('update() after destroy() should be a no-op', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    manager.destroy();
    // Should not throw even though styleEl is now null
    expect(() => manager.update(DEFAULT_PROSE_HIGHLIGHT_SETTINGS)).not.toThrow();
  });
});
