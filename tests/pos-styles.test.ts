import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POSStyleManager } from '../src/prose-highlight/pos-styles';
import { DEFAULT_PROSE_HIGHLIGHT_SETTINGS, DEFAULT_POS_COLORS } from '../src/types';
import type { ProseHighlightSettings } from '../src/types';

/**
 * POSStyleManager owns custom word list <style> injection AND a one-shot
 * migration that writes legacy POS colors to body.style.setProperty().
 * POS color defaults themselves live in styles.css (--yaae-pos-*-color-{light,dark}).
 */
function setupDOM() {
  const styleEl = {
    id: '',
    textContent: '',
    remove: vi.fn(),
  };

  const headAppendChild = vi.fn();
  const bodySetProperty = vi.fn();
  (globalThis as any).document = {
    createElement: vi.fn(() => styleEl),
    head: {
      appendChild: headAppendChild,
    },
    body: {
      style: {
        setProperty: bodySetProperty,
      },
    },
  };

  return { styleEl, headAppendChild, bodySetProperty };
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

  // --- Style element lifecycle ---

  it('should create a <style> element on init', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    expect(document.createElement).toHaveBeenCalledWith('style');
    expect(dom.headAppendChild).toHaveBeenCalled();
  });

  it('should not emit .yaae-pos-* class selectors (static in styles.css)', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    const css = dom.styleEl.textContent;

    expect(css).not.toContain('.yaae-pos-adjective');
    expect(css).not.toContain('.yaae-pos-noun');
  });

  it('should not emit POS variable rules into <style> (defaults live in styles.css)', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    const css = dom.styleEl.textContent;

    expect(css).not.toContain('--yaae-pos-adjective-color');
    expect(css).not.toContain('body {');
  });

  it('should emit empty <style> textContent when no custom word lists exist', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    expect(dom.styleEl.textContent).toBe('');
  });

  it('should remove <style> element on destroy', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    manager.destroy();
    expect(dom.styleEl.remove).toHaveBeenCalled();
  });

  // --- Migration (legacy POS color → body.style --yaae-pos-*-color-light) ---

  it('should not migrate when POS colors match defaults', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    expect(dom.bodySetProperty).not.toHaveBeenCalled();
  });

  it('should migrate non-default POS color to --yaae-pos-*-color-light on body', () => {
    const customized: ProseHighlightSettings = {
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      categories: {
        ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS.categories,
        adjective: { enabled: true, color: '#ff0000' },
      },
    };
    manager.init(customized);
    expect(dom.bodySetProperty).toHaveBeenCalledWith('--yaae-pos-adjective-color-light', '#ff0000');
  });

  it('should migrate multiple non-default POS colors', () => {
    const customized: ProseHighlightSettings = {
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      categories: {
        adjective: { enabled: true, color: '#ff0000' },
        noun: { enabled: true, color: '#00ff00' },
        adverb: { enabled: true, color: DEFAULT_POS_COLORS.adverb },
        verb: { enabled: true, color: DEFAULT_POS_COLORS.verb },
        conjunction: { enabled: true, color: DEFAULT_POS_COLORS.conjunction },
      },
    };
    manager.init(customized);
    expect(dom.bodySetProperty).toHaveBeenCalledWith('--yaae-pos-adjective-color-light', '#ff0000');
    expect(dom.bodySetProperty).toHaveBeenCalledWith('--yaae-pos-noun-color-light', '#00ff00');
    expect(dom.bodySetProperty).toHaveBeenCalledTimes(2);
  });

  // --- Custom word list rules ---

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

    expect(css).not.toContain('.yaae-list-old');
    expect(css).toContain('.yaae-list-new');
    expect(css).toContain('#222');
  });

  // --- Unhappy paths ---

  it('update() before init() should be a no-op', () => {
    manager.update(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
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

  it('update() after destroy() should be a no-op', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    manager.destroy();
    expect(() => manager.update(DEFAULT_PROSE_HIGHLIGHT_SETTINGS)).not.toThrow();
  });
});
