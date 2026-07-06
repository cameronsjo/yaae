import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POSStyleManager } from '../src/prose-highlight/pos-styles';
import { DEFAULT_PROSE_HIGHLIGHT_SETTINGS } from '../src/types';
import type { ProseHighlightSettings } from '../src/types';

/**
 * POSStyleManager owns custom word-list <style> injection only. POS color
 * defaults live in styles.css (--yaae-pos-*-color-{light,dark}); the legacy
 * inline-style migration was removed (Artificer #39 — it wrote a volatile
 * body.style that evaporated on restart while latching the flag).
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

/** Deep clone DEFAULT_PROSE_HIGHLIGHT_SETTINGS so per-test mutations don't
 * poison later tests via shared state. */
function freshDefaults(): ProseHighlightSettings {
  return {
    ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
    categories: {
      adjective: { ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS.categories.adjective },
      noun: { ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS.categories.noun },
      adverb: { ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS.categories.adverb },
      verb: { ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS.categories.verb },
      conjunction: { ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS.categories.conjunction },
    },
    customWordLists: [...DEFAULT_PROSE_HIGHLIGHT_SETTINGS.customWordLists],
  };
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
    manager.init(freshDefaults());
    expect(document.createElement).toHaveBeenCalledWith('style');
    expect(dom.headAppendChild).toHaveBeenCalled();
  });

  it('should not emit .yaae-pos-* class selectors (static in styles.css)', () => {
    manager.init(freshDefaults());
    const css = dom.styleEl.textContent;

    expect(css).not.toContain('.yaae-pos-adjective');
    expect(css).not.toContain('.yaae-pos-noun');
  });

  it('should not emit POS variable rules into <style> (defaults live in styles.css)', () => {
    manager.init(freshDefaults());
    const css = dom.styleEl.textContent;

    expect(css).not.toContain('--yaae-pos-adjective-color');
    expect(css).not.toContain('body {');
  });

  it('should emit empty <style> textContent when no custom word lists exist', () => {
    manager.init(freshDefaults());
    expect(dom.styleEl.textContent).toBe('');
  });

  it('should remove <style> element on destroy', () => {
    manager.init(freshDefaults());
    manager.destroy();
    expect(dom.styleEl.remove).toHaveBeenCalled();
  });

  // --- Migration removed (#39): init must never write inline body styles ---

  it('never stamps inline body styles, even for a non-default legacy color', () => {
    const customized: ProseHighlightSettings = {
      ...freshDefaults(),
      categories: {
        ...freshDefaults().categories,
        adjective: { enabled: true, color: '#ff0000' },
      },
    };
    manager.init(customized);
    expect(dom.bodySetProperty).not.toHaveBeenCalled();
  });

  it('does not persist a migration latch (init returns void)', () => {
    const settings = freshDefaults();
    expect(manager.init(settings)).toBeUndefined();
    expect(settings.posColorsMigrated).toBeUndefined();
  });

  // --- Custom word list rules ---

  it('should include custom word list CSS rules as direct class selectors', () => {
    const settings: ProseHighlightSettings = {
      ...freshDefaults(),
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
      ...freshDefaults(),
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
      ...freshDefaults(),
      customWordLists: [
        { name: 'Old', words: ['x'], color: '#111', enabled: true, caseSensitive: false },
      ],
    });

    manager.update({
      ...freshDefaults(),
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
    manager.update(freshDefaults());
    expect(dom.styleEl.textContent).toBe('');
  });

  it('destroy() before init() should not throw', () => {
    expect(() => manager.destroy()).not.toThrow();
  });

  it('destroy() called twice should not throw', () => {
    manager.init(freshDefaults());
    manager.destroy();
    expect(() => manager.destroy()).not.toThrow();
  });

  it('should skip word lists with empty name', () => {
    const settings: ProseHighlightSettings = {
      ...freshDefaults(),
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
      ...freshDefaults(),
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
    manager.init(freshDefaults());
    manager.destroy();
    expect(() => manager.update(freshDefaults())).not.toThrow();
  });

  // --- F5: Idempotent init (no orphan <style> on double-init) ---

  it('init() called twice removes the first <style> element before creating the second', () => {
    manager.init(freshDefaults());
    const firstEl = dom.styleEl;
    const firstRemove = firstEl.remove;

    // Second init must destroy the prior element so it does not orphan
    manager.init(freshDefaults());

    expect(firstRemove).toHaveBeenCalled();
    // setupDOM() reuses the same mock for createElement; called once per init()
    expect(document.createElement).toHaveBeenCalledTimes(2);
  });

  // --- F6: collision-safe class names ---

  it('emits distinct color rules for word lists whose names collide', () => {
    // "My List" and "my-list" both sanitize to "my-list". Without dedup,
    // POSStyleManager would emit two rules for the same selector, and the
    // second list's color would silently overwrite the first's.
    const settings: ProseHighlightSettings = {
      ...freshDefaults(),
      customWordLists: [
        { name: 'My List', words: ['x'], color: '#aaaaaa', enabled: true, caseSensitive: false },
        { name: 'my-list', words: ['y'], color: '#bbbbbb', enabled: true, caseSensitive: false },
      ],
    };

    manager.init(settings);
    const css = dom.styleEl.textContent;

    // Both colors must be present, attached to distinct selectors.
    expect(css).toContain('.yaae-list-my-list { color: #aaaaaa; }');
    expect(css).toContain('.yaae-list-my-list-2 { color: #bbbbbb; }');
  });
});
