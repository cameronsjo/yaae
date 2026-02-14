import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
  DEFAULT_POS_COLORS,
  POS_CATEGORIES,
} from '../src/types';

describe('Types', () => {
  it('should have default settings defined', () => {
    expect(DEFAULT_SETTINGS).toBeDefined();
    expect(typeof DEFAULT_SETTINGS).toBe('object');
  });

  it('should have prose highlight settings nested under default settings', () => {
    expect(DEFAULT_SETTINGS.proseHighlight).toBeDefined();
    expect(DEFAULT_SETTINGS.proseHighlight).toEqual(
      DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
    );
  });

  it('should have prose highlighting disabled by default', () => {
    expect(DEFAULT_PROSE_HIGHLIGHT_SETTINGS.enabled).toBe(false);
  });

  it('should have all POS categories enabled by default', () => {
    for (const cat of POS_CATEGORIES) {
      expect(
        DEFAULT_PROSE_HIGHLIGHT_SETTINGS.categories[cat].enabled,
      ).toBe(true);
    }
  });

  it('should have 5 POS categories', () => {
    expect(POS_CATEGORIES).toHaveLength(5);
    expect(POS_CATEGORIES).toContain('adjective');
    expect(POS_CATEGORIES).toContain('noun');
    expect(POS_CATEGORIES).toContain('adverb');
    expect(POS_CATEGORIES).toContain('verb');
    expect(POS_CATEGORIES).toContain('conjunction');
  });

  it('should have default colors for all POS categories', () => {
    for (const cat of POS_CATEGORIES) {
      expect(DEFAULT_POS_COLORS[cat]).toBeDefined();
      expect(DEFAULT_POS_COLORS[cat]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('should have Reading View disabled by default', () => {
    expect(DEFAULT_PROSE_HIGHLIGHT_SETTINGS.readingViewEnabled).toBe(false);
  });

  it('should have empty custom word lists by default', () => {
    expect(DEFAULT_PROSE_HIGHLIGHT_SETTINGS.customWordLists).toEqual([]);
  });
});
