import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classificationBannerProcessor } from '../src/document/classification-banner';
import { CLASSIFICATION_TAXONOMY } from '../src/schemas';

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
  // --- Happy paths ---

  it('injects banner for valid classification at lineStart 0', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'internal' } });

    classificationBannerProcessor(el, ctx);

    expect(el.insertBefore).toHaveBeenCalledOnce();
    const banner = (el.insertBefore as any).mock.calls[0][0];
    expect(banner.className).toBe('yaae-classification-banner yaae-internal');
    expect(banner.textContent).toBe(CLASSIFICATION_TAXONOMY.internal.label);
  });

  it('applies correct styling for each classification level', () => {
    for (const level of ['public', 'internal', 'confidential', 'restricted'] as const) {
      const el = makeEl();
      const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: level } });

      classificationBannerProcessor(el, ctx);

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

    classificationBannerProcessor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });

  it('does nothing when lineStart is not 0', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 5, frontmatter: { classification: 'internal' } });

    classificationBannerProcessor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });

  it('does nothing when frontmatter is null', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: null });

    classificationBannerProcessor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });

  it('does nothing when classification is missing from frontmatter', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { title: 'Test' } });

    classificationBannerProcessor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });

  it('does nothing for invalid classification value', () => {
    const el = makeEl();
    const ctx = makeCtx({ lineStart: 0, frontmatter: { classification: 'top-secret' } });

    classificationBannerProcessor(el, ctx);

    expect(el.insertBefore).not.toHaveBeenCalled();
  });
});
