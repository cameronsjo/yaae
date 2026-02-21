import { describe, it, expect, vi } from 'vitest';
import { createClassificationBannerProcessor } from '../src/document/classification-banner';
import { CLASSIFICATION_TAXONOMY } from '../src/schemas';
import type { CustomClassification } from '../src/schemas';

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
  const processor = createClassificationBannerProcessor();

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
      expect(banner.style.cssText).toContain(`background: ${meta.background}`);
      expect(banner.style.cssText).toContain(`color: ${meta.color}`);
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

  const processor = createClassificationBannerProcessor(customs);

  it('injects banner for custom classification', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'non-sensitive' } });

    processor(el, ctx);

    expect(el.insertBefore).toHaveBeenCalledOnce();
    const banner = (el.insertBefore as any).mock.calls[0][0];
    expect(banner.className).toBe('yaae-classification-banner yaae-non-sensitive');
    expect(banner.textContent).toBe('NON-SENSITIVE');
    expect(banner.style.cssText).toContain('color: #2d7d2d');
    expect(banner.style.cssText).toContain('background: #f0faf0');
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
});
