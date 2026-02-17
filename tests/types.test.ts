import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_PROSE_HIGHLIGHT_SETTINGS,
  DEFAULT_POS_COLORS,
  POS_CATEGORIES,
} from '../src/types';
import { DEFAULT_DOCUMENT_SETTINGS } from '../src/document/settings';

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

describe('DocumentSettings defaults', () => {
  it('should have document settings nested under default settings', () => {
    expect(DEFAULT_SETTINGS.document).toBeDefined();
    expect(DEFAULT_SETTINGS.document).toEqual(DEFAULT_DOCUMENT_SETTINGS);
  });

  it('should default classification to internal', () => {
    expect(DEFAULT_DOCUMENT_SETTINGS.defaultClassification).toBe('internal');
  });

  it('should default watermark for drafts to heads-up', () => {
    expect(DEFAULT_DOCUMENT_SETTINGS.defaultWatermarkForDrafts).toBe('heads-up');
  });

  it('should default tocDepth to 3', () => {
    expect(DEFAULT_DOCUMENT_SETTINGS.tocDepth).toBe(3);
  });

  it('should enable validate on save by default', () => {
    expect(DEFAULT_DOCUMENT_SETTINGS.validateOnSave).toBe(true);
  });

  it('should enable classification banner by default', () => {
    expect(DEFAULT_DOCUMENT_SETTINGS.showClassificationBanner).toBe(true);
  });

  it('should default banner position to top', () => {
    expect(DEFAULT_DOCUMENT_SETTINGS.bannerPosition).toBe('top');
  });

  it('should have empty header/footer defaults', () => {
    expect(DEFAULT_DOCUMENT_SETTINGS.defaultHeaderLeft).toBe('');
    expect(DEFAULT_DOCUMENT_SETTINGS.defaultHeaderRight).toBe('');
    expect(DEFAULT_DOCUMENT_SETTINGS.defaultFooterLeft).toBe('');
    expect(DEFAULT_DOCUMENT_SETTINGS.defaultFooterRight).toBe('');
  });

  it('should enable expand links and page numbers by default', () => {
    expect(DEFAULT_DOCUMENT_SETTINGS.expandLinks).toBe(true);
    expect(DEFAULT_DOCUMENT_SETTINGS.pageNumbers).toBe(true);
  });

  it('should disable auto TOC by default', () => {
    expect(DEFAULT_DOCUMENT_SETTINGS.autoToc).toBe(false);
  });
});
