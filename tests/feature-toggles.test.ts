import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/types';
import type { FocusMode } from '../src/types';

/**
 * Tests for feature toggle default values and settings shape.
 *
 * Ensures that DEFAULT_SETTINGS matches README claims about
 * which features are on/off by default.
 */

describe('default settings — readability features', () => {
  it('syntax dimming defaults to enabled', () => {
    expect(DEFAULT_SETTINGS.syntaxDimming).toBe(true);
  });

  it('guttered headings defaults to enabled', () => {
    expect(DEFAULT_SETTINGS.gutteredHeadings).toBe(true);
  });

  it('focus mode defaults to off', () => {
    expect(DEFAULT_SETTINGS.focusMode).toBe('off');
  });

  it('typewriter scroll defaults to disabled', () => {
    expect(DEFAULT_SETTINGS.typewriterScroll).toBe(false);
  });
});

describe('default settings — prose highlighting', () => {
  it('prose highlighting defaults to disabled', () => {
    expect(DEFAULT_SETTINGS.proseHighlight.enabled).toBe(false);
  });

  it('reading view highlighting defaults to disabled', () => {
    expect(DEFAULT_SETTINGS.proseHighlight.readingViewEnabled).toBe(false);
  });

  it('all POS categories default to enabled', () => {
    for (const [cat, settings] of Object.entries(DEFAULT_SETTINGS.proseHighlight.categories)) {
      expect(settings.enabled, `${cat} should default to enabled`).toBe(true);
    }
  });

  it('custom word lists default to empty', () => {
    expect(DEFAULT_SETTINGS.proseHighlight.customWordLists).toEqual([]);
  });
});

describe('settings shape completeness', () => {
  it('YaaeSettings has all top-level keys', () => {
    const keys = Object.keys(DEFAULT_SETTINGS);
    expect(keys).toContain('proseHighlight');
    expect(keys).toContain('syntaxDimming');
    expect(keys).toContain('gutteredHeadings');
    expect(keys).toContain('focusMode');
    expect(keys).toContain('typewriterScroll');
    expect(keys).toContain('document');
  });

  it('focusMode only accepts valid values', () => {
    const validModes: FocusMode[] = ['off', 'sentence', 'paragraph'];
    expect(validModes).toContain(DEFAULT_SETTINGS.focusMode);
  });
});
