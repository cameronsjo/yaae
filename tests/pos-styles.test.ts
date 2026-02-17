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

  it('should use default iA Writer colors', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    const css = dom.styleEl.textContent;

    expect(css).toContain('#b97a0a'); // adjective
    expect(css).toContain('#ce4924'); // noun
    expect(css).toContain('#c333a7'); // adverb
    expect(css).toContain('#177eB8'); // verb
    expect(css).toContain('#01934e'); // conjunction
  });

  it('should update CSS when colors change', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);

    const newSettings: ProseHighlightSettings = {
      ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
      categories: {
        ...DEFAULT_PROSE_HIGHLIGHT_SETTINGS.categories,
        adjective: { enabled: true, color: '#ff0000' },
      },
    };

    manager.update(newSettings);
    expect(dom.styleEl.textContent).toContain('#ff0000');
  });

  it('should include custom word list CSS rules', () => {
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

  it('should remove <style> element on destroy', () => {
    manager.init(DEFAULT_PROSE_HIGHLIGHT_SETTINGS);
    manager.destroy();
    expect(dom.styleEl.remove).toHaveBeenCalled();
  });
});
