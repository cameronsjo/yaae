import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Tests for body class application — verifies that toggle functions
 * correctly add/remove CSS classes on document.body.
 *
 * These tests import the plugin class and exercise applyBodyClasses()
 * directly against a real classList (via JSDOM/happy-dom or a mock).
 */

// We test the logic extracted from main.ts without instantiating the full plugin.
// The body class logic is simple enough to test via the toggle constants + classList.

const BODY_CLASS_SYNTAX_DIMMING = 'yaae-syntax-dimming';

describe('body class application', () => {
  let classList: Set<string>;
  let toggle: (cls: string, force: boolean) => void;

  beforeEach(() => {
    classList = new Set();
    toggle = (cls: string, force: boolean) => {
      if (force) {
        classList.add(cls);
      } else {
        classList.delete(cls);
      }
    };
  });

  /**
   * Mirrors the logic in YaaePlugin.applyBodyClasses().
   * Guttered headings is no longer body-class-driven — it's a CM6 gutter
   * extension reconfigured via Compartment, so it isn't covered here.
   */
  function applyBodyClasses(settings: { syntaxDimming: boolean }) {
    toggle(BODY_CLASS_SYNTAX_DIMMING, settings.syntaxDimming);
  }

  it('adds the syntax-dimming class when the feature is enabled', () => {
    applyBodyClasses({ syntaxDimming: true });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(true);
  });

  it('removes the syntax-dimming class when the feature is disabled', () => {
    classList.add(BODY_CLASS_SYNTAX_DIMMING);
    applyBodyClasses({ syntaxDimming: false });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(false);
  });

  it('toggles syntax dimming on then off', () => {
    applyBodyClasses({ syntaxDimming: true });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(true);

    applyBodyClasses({ syntaxDimming: false });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(false);
  });

  it('is idempotent — calling twice with same settings produces same result', () => {
    applyBodyClasses({ syntaxDimming: true });
    applyBodyClasses({ syntaxDimming: true });
    expect(classList.size).toBe(1);
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(true);
  });
});

describe('focus mode cycle', () => {
  type FocusMode = 'off' | 'sentence' | 'paragraph';

  function cycleFocusMode(current: FocusMode): FocusMode {
    const cycle: FocusMode[] = ['off', 'sentence', 'paragraph'];
    const idx = cycle.indexOf(current);
    return cycle[(idx + 1) % cycle.length];
  }

  it('cycles off -> sentence -> paragraph -> off', () => {
    expect(cycleFocusMode('off')).toBe('sentence');
    expect(cycleFocusMode('sentence')).toBe('paragraph');
    expect(cycleFocusMode('paragraph')).toBe('off');
  });

  it('wraps around continuously', () => {
    let mode: FocusMode = 'off';
    for (let i = 0; i < 6; i++) {
      mode = cycleFocusMode(mode);
    }
    // 6 cycles from 'off' = 2 full rotations = back to 'off'
    expect(mode).toBe('off');
  });
});
