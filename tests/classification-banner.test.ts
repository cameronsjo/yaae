import { describe, it, expect, vi } from 'vitest';
import { createClassificationBannerProcessor } from '../src/document/classification-banner';
import { CLASSIFICATION_TAXONOMY } from '../src/schemas';
import type { CustomClassification } from '../src/schemas';
import { DEFAULT_DOCUMENT_SETTINGS, type DocumentSettings } from '../src/document/settings';

/** Helper to build a settings getter for tests — enables the banner since default is off */
function settingsGetter(overrides: Partial<DocumentSettings> = {}): () => DocumentSettings {
  const settings = { ...DEFAULT_DOCUMENT_SETTINGS, showClassificationBanner: true, ...overrides };
  return () => settings;
}

// Minimal mock for MarkdownPostProcessorContext
function makeCtx(opts: {
  lineStart?: number;
  frontmatter?: Record<string, unknown> | null;
}) {
  return {
    getSectionInfo: (_el: HTMLElement) =>
      opts.lineStart !== undefined ? { lineStart: opts.lineStart, lineEnd: 10, text: '' } : null,
    frontmatter: opts.frontmatter ?? null,
    // Unused fields required by the type
    docId: '',
    sourcePath: '',
    addChild: vi.fn(),
  } as any;
}

function makeEl() {
  const children: HTMLElement[] = [];
  const el = {
    firstChild: null as HTMLElement | null,
    insertBefore: vi.fn((node: HTMLElement, ref: HTMLElement | null) => {
      children.unshift(node);
      el.firstChild = children[0];
    }),
  } as unknown as HTMLElement;
  return el;
}

describe('classificationBannerProcessor', () => {
  const processor = createClassificationBannerProcessor(settingsGetter());

  // --- Happy paths ---

  it('injects banner for valid classification at lineStart 0', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'internal' } });

    processor(el, ctx);

    expect(el.insertBefore).toHaveBeenCalledOnce();
    const banner = (el.insertBefore as any).mock.calls[0][0];
    expect(banner.className).toBe('yaae-classification-banner yaae-internal');
    expect(banner.textContent).toBe(CLASSIFICATION_TAXONOMY.internal.label);
  });

  it('applies correct styling for each classification level', () => {
    for (const level of ['public', 'internal', 'confidential', 'restricted'] as const) {
      const el = makeEl();
      const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: level } });

      processor(el, ctx);

      const banner = (el.insertBefore as any).mock.calls[0][0];
      const meta = CLASSIFICATION_TAXONOMY[level];
      expect(banner.className).toContain(`yaae-${level}`);
      expect(banner.textContent).toBe(meta.label);
      // Colors flow through CSS custom properties so styles.css can swap on body.theme-dark
      expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-color', meta.color);
      expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-bg', meta.background);
      // Built-ins now carry dark variants too
      if (meta.colorDark) {
        expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-color-dark', meta.colorDark);
      }
      if (meta.backgroundDark) {
        expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-bg-dark', meta.backgroundDark);
      }
    }
  });

  // --- Guard clauses (unhappy paths) ---

  it('does nothing when getSectionInfo returns null', () => {
    const el = makeEl();
    const ctx = makeCtx({ frontmatter: { classification: 'internal' } });
    // lineStart is undefined → getSectionInfo returns null

    processor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });

  it('does nothing when lineStart is not 0', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 5, frontmatter: { classification: 'internal' } });

    processor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });

  it('does nothing when frontmatter is null', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: null });

    processor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });

  it('does nothing when classification is missing from frontmatter', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { title: 'Test' } });

    processor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });

  it('does nothing for unknown classification value without custom list', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'top-secret' } });

    processor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });

  it('does nothing when showClassificationBanner is false', () => {
    const disabledProcessor = createClassificationBannerProcessor(
      settingsGetter({ showClassificationBanner: false }),
    );
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'internal' } });

    disabledProcessor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Custom classifications
// ---------------------------------------------------------------------------

describe('classificationBannerProcessor — custom classifications', () => {
  const customs: CustomClassification[] = [
    { id: 'non-sensitive', label: 'NON-SENSITIVE', color: '#2d7d2d', background: '#f0faf0' },
    { id: 'sensitive', label: 'SENSITIVE', color: '#b8860b', background: '#fff8e7' },
    { id: 'highly-sensitive', label: 'HIGHLY SENSITIVE', color: '#c41e1e', background: '#fff5f5' },
    { id: 'highly-sensitive-restricted', label: 'HIGHLY SENSITIVE — RESTRICTED', color: '#8b0000', background: '#ffe0e0' },
  ];

  const processor = createClassificationBannerProcessor(settingsGetter({
    customClassifications: customs,
  }));

  it('injects banner for custom classification', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'non-sensitive' } });

    processor(el, ctx);

    expect(el.insertBefore).toHaveBeenCalledOnce();
    const banner = (el.insertBefore as any).mock.calls[0][0];
    expect(banner.className).toBe('yaae-classification-banner yaae-non-sensitive');
    expect(banner.textContent).toBe('NON-SENSITIVE');
    expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-color', '#2d7d2d');
    expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-bg', '#f0faf0');
  });

  it('injects banner for all custom levels', () => {
    for (const custom of customs) {
      const el = makeEl();
      const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: custom.id } });

      processor(el, ctx);

      expect(el.insertBefore).toHaveBeenCalledOnce();
      const banner = (el.insertBefore as any).mock.calls[0][0];
      expect(banner.textContent).toBe(custom.label);
    }
  });

  it('still supports built-in classifications alongside custom ones', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'internal' } });

    processor(el, ctx);

    expect(el.insertBefore).toHaveBeenCalledOnce();
    const banner = (el.insertBefore as any).mock.calls[0][0];
    expect(banner.textContent).toBe(CLASSIFICATION_TAXONOMY.internal.label);
  });

  it('propagates dark-theme overrides from custom classification', () => {
    const customWithDark: CustomClassification = {
      id: 'tinted',
      label: 'TINTED',
      color: '#444444',
      background: '#eeeeee',
      colorDark: '#cccccc',
      backgroundDark: '#222222',
    };
    const darkProcessor = createClassificationBannerProcessor(settingsGetter({
      customClassifications: [customWithDark],
    }));

    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'tinted' } });

    darkProcessor(el, ctx);

    const banner = (el.insertBefore as any).mock.calls[0][0];
    expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-color', '#444444');
    expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-bg', '#eeeeee');
    expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-color-dark', '#cccccc');
    expect(banner.style.setProperty).toHaveBeenCalledWith('--yaae-banner-bg-dark', '#222222');
  });

  it('omits dark variant setProperty calls when colorDark/backgroundDark absent', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'non-sensitive' } });

    processor(el, ctx);

    const banner = (el.insertBefore as any).mock.calls[0][0];
    const setPropCalls = (banner.style.setProperty as any).mock.calls.map((c: unknown[]) => c[0]);
    expect(setPropCalls).not.toContain('--yaae-banner-color-dark');
    expect(setPropCalls).not.toContain('--yaae-banner-bg-dark');
  });
});

// ---------------------------------------------------------------------------
// Regression coverage: classification-correctness fixes
// ---------------------------------------------------------------------------

describe('classificationBannerProcessor — F1: custom property survival', () => {
  // Defends against the `cssText +=` regression: when layout was assigned
  // via cssText round-trip, Chromium could clobber the four
  // --yaae-banner-* declarations set immediately before. Verify all four
  // setProperty calls remain on the banner element after layout is applied.
  const customWithDark: CustomClassification = {
    id: 'tinted',
    label: 'TINTED',
    color: '#444444',
    background: '#eeeeee',
    colorDark: '#cccccc',
    backgroundDark: '#222222',
  };
  const processor = createClassificationBannerProcessor(settingsGetter({
    customClassifications: [customWithDark],
  }));

  it('preserves all four --yaae-banner-* custom properties through layout assignment', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'tinted' } });

    processor(el, ctx);

    const banner = (el.insertBefore as any).mock.calls[0][0];
    const setPropCalls = (banner.style.setProperty as any).mock.calls;
    const setPropMap = new Map<string, string>();
    for (const [prop, value] of setPropCalls) {
      setPropMap.set(prop, value);
    }

    // All four custom properties must still be declared on the element
    // after the layout block runs.
    expect(setPropMap.get('--yaae-banner-color')).toBe('#444444');
    expect(setPropMap.get('--yaae-banner-bg')).toBe('#eeeeee');
    expect(setPropMap.get('--yaae-banner-color-dark')).toBe('#cccccc');
    expect(setPropMap.get('--yaae-banner-bg-dark')).toBe('#222222');

    // Layout properties also flow through setProperty (no cssText += round-trip)
    expect(setPropMap.has('text-align')).toBe(true);
    expect(setPropMap.has('padding')).toBe(true);
  });
});

describe('classificationBannerProcessor — F2/F3: class-name and whitespace handling', () => {
  it('builds usable class string when classification has surrounding whitespace', () => {
    // F3: whitespace classification mismatch. Banner should resolve and use
    // the trimmed level, not the raw frontmatter value with spaces.
    const processor = createClassificationBannerProcessor(settingsGetter());
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: '  internal  ' } });

    processor(el, ctx);

    expect(el.insertBefore).toHaveBeenCalledOnce();
    const banner = (el.insertBefore as any).mock.calls[0][0];
    // Class fragment is sanitized — no leading/trailing spaces leaked into the className
    expect(banner.className).toBe('yaae-classification-banner yaae-internal');
    // setProperty values still match the resolved built-in
    const setPropCalls = (banner.style.setProperty as any).mock.calls;
    const setPropMap = new Map<string, string>(setPropCalls.map((c: unknown[]) => [c[0] as string, c[1] as string]));
    expect(setPropMap.get('--yaae-banner-color')).toBe(CLASSIFICATION_TAXONOMY.internal.color);
  });

  it('sanitizes custom classification IDs that contain spaces', () => {
    // F2: ensure stray spaces in a custom classification ID don't split into
    // multiple class tokens or cause a selector-injection style breakout.
    // The custom classification "internal extra" is invalid by sanitizeCssId
    // rules — the banner should still render but skip the classFragment.
    const malformed: CustomClassification = {
      id: 'internal extra',
      label: 'MALFORMED',
      color: '#444444',
      background: '#eeeeee',
    };
    const processor = createClassificationBannerProcessor(settingsGetter({
      customClassifications: [malformed],
    }));
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'internal extra' } });

    processor(el, ctx);

    expect(el.insertBefore).toHaveBeenCalledOnce();
    const banner = (el.insertBefore as any).mock.calls[0][0];
    // No second yaae-* class fragment leaked through
    expect(banner.className).toBe('yaae-classification-banner');
    expect(banner.textContent).toBe('MALFORMED');
  });
});
