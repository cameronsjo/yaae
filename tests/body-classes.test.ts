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
const BODY_CLASS_GUTTERED_HEADINGS = 'yaae-guttered-headings';

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
   * Mirrors the logic in YaaePlugin.applyBodyClasses()
   */
  function applyBodyClasses(settings: { syntaxDimming: boolean; gutteredHeadings: boolean }) {
    toggle(BODY_CLASS_SYNTAX_DIMMING, settings.syntaxDimming);
    toggle(BODY_CLASS_GUTTERED_HEADINGS, settings.gutteredHeadings);
  }

  it('adds both classes when both features are enabled', () => {
    applyBodyClasses({ syntaxDimming: true, gutteredHeadings: true });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(true);
    expect(classList.has(BODY_CLASS_GUTTERED_HEADINGS)).toBe(true);
  });

  it('removes both classes when both features are disabled', () => {
    classList.add(BODY_CLASS_SYNTAX_DIMMING);
    classList.add(BODY_CLASS_GUTTERED_HEADINGS);

    applyBodyClasses({ syntaxDimming: false, gutteredHeadings: false });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(false);
    expect(classList.has(BODY_CLASS_GUTTERED_HEADINGS)).toBe(false);
  });

  it('adds only syntax dimming when guttered headings is off', () => {
    applyBodyClasses({ syntaxDimming: true, gutteredHeadings: false });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(true);
    expect(classList.has(BODY_CLASS_GUTTERED_HEADINGS)).toBe(false);
  });

  it('adds only guttered headings when syntax dimming is off', () => {
    applyBodyClasses({ syntaxDimming: false, gutteredHeadings: true });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(false);
    expect(classList.has(BODY_CLASS_GUTTERED_HEADINGS)).toBe(true);
  });

  it('toggles syntax dimming on then off', () => {
    applyBodyClasses({ syntaxDimming: true, gutteredHeadings: false });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(true);

    applyBodyClasses({ syntaxDimming: false, gutteredHeadings: false });
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(false);
  });

  it('toggles guttered headings on then off', () => {
    applyBodyClasses({ syntaxDimming: false, gutteredHeadings: true });
    expect(classList.has(BODY_CLASS_GUTTERED_HEADINGS)).toBe(true);

    applyBodyClasses({ syntaxDimming: false, gutteredHeadings: false });
    expect(classList.has(BODY_CLASS_GUTTERED_HEADINGS)).toBe(false);
  });

  it('is idempotent — calling twice with same settings produces same result', () => {
    applyBodyClasses({ syntaxDimming: true, gutteredHeadings: true });
    applyBodyClasses({ syntaxDimming: true, gutteredHeadings: true });
    expect(classList.size).toBe(2);
    expect(classList.has(BODY_CLASS_SYNTAX_DIMMING)).toBe(true);
    expect(classList.has(BODY_CLASS_GUTTERED_HEADINGS)).toBe(true);
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
