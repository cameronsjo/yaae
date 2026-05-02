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

/** Deep clone DEFAULT_PROSE_HIGHLIGHT_SETTINGS — the migration mutates the
 * input to set posColorsMigrated, so passing the module-level constant
 * directly poisons subsequent tests via shared state. */
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

  // --- Migration (legacy POS color → body.style --yaae-pos-*-color-light) ---

  it('should not migrate when POS colors match defaults', () => {
    manager.init(freshDefaults());
    expect(dom.bodySetProperty).not.toHaveBeenCalled();
  });

  it('should migrate non-default POS color to --yaae-pos-*-color-light on body', () => {
    const customized: ProseHighlightSettings = {
      ...freshDefaults(),
      categories: {
        ...freshDefaults().categories,
        adjective: { enabled: true, color: '#ff0000' },
      },
    };
    manager.init(customized);
    expect(dom.bodySetProperty).toHaveBeenCalledWith('--yaae-pos-adjective-color-light', '#ff0000');
  });

  it('should migrate multiple non-default POS colors', () => {
    const customized: ProseHighlightSettings = {
      ...freshDefaults(),
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

  // --- F1: Migration latch (posColorsMigrated flag) ---

  it('migration is one-shot: second init with the flag set does NOT re-stamp inline styles', () => {
    const customized: ProseHighlightSettings = {
      ...freshDefaults(),
      categories: {
        ...freshDefaults().categories,
        adjective: { enabled: true, color: '#ff0000' },
      },
    };

    // First init runs migration and flips the latch
    manager.init(customized);
    expect(dom.bodySetProperty).toHaveBeenCalledTimes(1);
    expect(customized.posColorsMigrated).toBe(true);

    // Second init must NOT re-stamp — would clobber Style Settings overrides
    dom.bodySetProperty.mockClear();
    manager.destroy();
    manager.init(customized);
    expect(dom.bodySetProperty).not.toHaveBeenCalled();
  });

  it('skips migration entirely when posColorsMigrated flag is already set', () => {
    const previouslyMigrated: ProseHighlightSettings = {
      ...freshDefaults(),
      categories: {
        ...freshDefaults().categories,
        adjective: { enabled: true, color: '#deadbeef' },
      },
      posColorsMigrated: true,
    };

    manager.init(previouslyMigrated);
    expect(dom.bodySetProperty).not.toHaveBeenCalled();
  });

  it('init() returns true when migration ran, false on subsequent runs', () => {
    const customized: ProseHighlightSettings = {
      ...freshDefaults(),
      categories: {
        ...freshDefaults().categories,
        adjective: { enabled: true, color: '#ff0000' },
      },
    };

    expect(manager.init(customized)).toBe(true);
    manager.destroy();
    expect(manager.init(customized)).toBe(false);
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
});
