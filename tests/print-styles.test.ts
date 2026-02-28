import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ClassificationPrintStyleManager,
  HeaderFooterPrintStyleManager,
  DynamicPdfPrintStyleManager,
  buildWatermarkDataUri,
  WATERMARK_PRESETS,
} from '../src/document/print-styles';
import type { CustomClassification } from '../src/schemas';
import { DEFAULT_DOCUMENT_SETTINGS, type DocumentSettings } from '../src/document/settings';

// Mock document.head and createElement for Node.js environment
function setupDOM() {
  const styleEl = {
    id: '',
    textContent: '',
    remove: vi.fn(),
  };

  const headAppendChild = vi.fn();

  (globalThis as any).document = {
    createElement: vi.fn(() => {
      // Return a fresh object each time so multiple managers don't share
      return { id: '', textContent: '', remove: vi.fn() };
    }),
    head: {
      appendChild: headAppendChild,
    },
  };

  return { headAppendChild };
}

// Helper to get the style element from the last appendChild call
function getLastStyleEl(headAppendChild: ReturnType<typeof vi.fn>) {
  const calls = headAppendChild.mock.calls;
  return calls[calls.length - 1][0] as { id: string; textContent: string; remove: ReturnType<typeof vi.fn> };
}

// ---------------------------------------------------------------------------
// ClassificationPrintStyleManager
// ---------------------------------------------------------------------------

describe('ClassificationPrintStyleManager', () => {
  let manager: ClassificationPrintStyleManager;
  let dom: ReturnType<typeof setupDOM>;

  beforeEach(() => {
    dom = setupDOM();
    manager = new ClassificationPrintStyleManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('creates a style element on init', () => {
    manager.init([]);
    expect(dom.headAppendChild).toHaveBeenCalled();
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.id).toBe('yaae-custom-classification-print-styles');
  });

  it('generates empty styles for empty custom list', () => {
    manager.init([]);
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.textContent).toBe('');
  });

  it('generates @media print rules for custom classifications', () => {
    const customs: CustomClassification[] = [
      { id: 'non-sensitive', label: 'NON-SENSITIVE', color: '#2d7d2d', background: '#f0faf0' },
    ];
    manager.init(customs);
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('@media print');
    expect(css).toContain('.pdf-non-sensitive');
    expect(css).toContain('"NON-SENSITIVE"');
    expect(css).toContain('#2d7d2d');
    expect(css).toContain('#f0faf0');
  });

  it('generates rules for multiple custom classifications', () => {
    const customs: CustomClassification[] = [
      { id: 'non-sensitive', label: 'NON-SENSITIVE', color: '#2d7d2d', background: '#f0faf0' },
      { id: 'sensitive', label: 'SENSITIVE', color: '#b8860b', background: '#fff8e7' },
      { id: 'highly-sensitive', label: 'HIGHLY SENSITIVE', color: '#c41e1e', background: '#fff5f5' },
    ];
    manager.init(customs);
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('.pdf-non-sensitive');
    expect(css).toContain('.pdf-sensitive');
    expect(css).toContain('.pdf-highly-sensitive');
  });

  it('includes both top and bottom banner selectors', () => {
    const customs: CustomClassification[] = [
      { id: 'test-level', label: 'TEST', color: '#000', background: '#fff' },
    ];
    manager.init(customs);
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('.pdf-test-level .markdown-preview-view::before');
    expect(css).toContain('.pdf-test-level:not(.pdf-signature-block) .markdown-preview-sizer::after');
  });

  it('updates styles dynamically', () => {
    manager.init([]);
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.textContent).toBe('');

    manager.update([
      { id: 'new-level', label: 'NEW', color: '#ff0000', background: '#fff0f0' },
    ]);
    expect(el.textContent).toContain('.pdf-new-level');
  });

  it('skips entries with empty id', () => {
    const customs: CustomClassification[] = [
      { id: '', label: 'EMPTY', color: '#000', background: '#fff' },
      { id: 'valid', label: 'VALID', color: '#000', background: '#fff' },
    ];
    manager.init(customs);
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).not.toContain('"EMPTY"');
    expect(css).toContain('.pdf-valid');
  });

  it('escapes double quotes in labels', () => {
    const customs: CustomClassification[] = [
      { id: 'quoted', label: 'LEVEL "A"', color: '#000', background: '#fff' },
    ];
    manager.init(customs);
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('LEVEL \\"A\\"');
  });

  it('removes style element on destroy', () => {
    manager.init([]);
    const el = getLastStyleEl(dom.headAppendChild);
    manager.destroy();
    expect(el.remove).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// HeaderFooterPrintStyleManager
// ---------------------------------------------------------------------------

describe('HeaderFooterPrintStyleManager', () => {
  let manager: HeaderFooterPrintStyleManager;
  let dom: ReturnType<typeof setupDOM>;

  function makeSettings(overrides: Partial<DocumentSettings> = {}): DocumentSettings {
    return { ...DEFAULT_DOCUMENT_SETTINGS, ...overrides };
  }

  beforeEach(() => {
    dom = setupDOM();
    manager = new HeaderFooterPrintStyleManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('creates a style element on init', () => {
    manager.init(makeSettings());
    expect(dom.headAppendChild).toHaveBeenCalled();
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.id).toBe('yaae-header-footer-print-styles');
  });

  it('generates empty styles when all header/footer fields are empty', () => {
    manager.init(makeSettings());
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.textContent).toBe('');
  });

  it('generates header-left rule', () => {
    manager.init(makeSettings({ defaultHeaderLeft: 'Acme Corp' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('@media print');
    expect(css).toContain('"Acme Corp"');
    expect(css).toContain('.print::before');
    expect(css).toContain('position: fixed');
    expect(css).toContain('top:');
    expect(css).toContain('left:');
  });

  it('generates header-right rule', () => {
    manager.init(makeSettings({ defaultHeaderRight: 'Engineering' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('"Engineering"');
    expect(css).toContain('.markdown-preview-view::after');
    expect(css).toContain('right:');
  });

  it('generates footer-left rule', () => {
    manager.init(makeSettings({ defaultFooterLeft: 'Confidential' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('"Confidential"');
    expect(css).toContain('.markdown-preview-sizer::before');
    expect(css).toContain('bottom:');
  });

  it('generates footer-right rule', () => {
    manager.init(makeSettings({ defaultFooterRight: 'v2.0' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('"v2.0"');
    expect(css).toContain('.print::after');
    expect(css).toContain('bottom:');
    expect(css).toContain('right:');
  });

  it('generates all four positions when all are set', () => {
    manager.init(makeSettings({
      defaultHeaderLeft: 'HL',
      defaultHeaderRight: 'HR',
      defaultFooterLeft: 'FL',
      defaultFooterRight: 'FR',
    }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('"HL"');
    expect(css).toContain('"HR"');
    expect(css).toContain('"FL"');
    expect(css).toContain('"FR"');
    expect(css).toContain('.print::before');
    expect(css).toContain('.markdown-preview-view::after');
    expect(css).toContain('.markdown-preview-sizer::before');
    expect(css).toContain('.print::after');
  });

  it('escapes double quotes in text', () => {
    manager.init(makeSettings({ defaultHeaderLeft: 'Version "1.0"' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;

    expect(css).toContain('Version \\"1.0\\"');
  });

  it('updates styles dynamically', () => {
    manager.init(makeSettings());
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.textContent).toBe('');

    manager.update(makeSettings({ defaultHeaderLeft: 'Updated Corp' }));
    expect(el.textContent).toContain('"Updated Corp"');
  });

  it('clears styles when all text is removed', () => {
    manager.init(makeSettings({ defaultHeaderLeft: 'Corp' }));
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.textContent).toContain('"Corp"');

    manager.update(makeSettings());
    expect(el.textContent).toBe('');
  });

  it('removes style element on destroy', () => {
    manager.init(makeSettings());
    const el = getLastStyleEl(dom.headAppendChild);
    manager.destroy();
    expect(el.remove).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// buildWatermarkDataUri
// ---------------------------------------------------------------------------

describe('buildWatermarkDataUri', () => {
  it('returns a data URI string', () => {
    const uri = buildWatermarkDataUri('whisper', 'DRAFT');
    expect(uri).toMatch(/^url\("data:image\/svg\+xml,/);
    expect(uri).toContain('DRAFT');
  });

  it('uses preset parameters for each level', () => {
    for (const level of Object.keys(WATERMARK_PRESETS) as (keyof typeof WATERMARK_PRESETS)[]) {
      const uri = buildWatermarkDataUri(level, 'TEST');
      const preset = WATERMARK_PRESETS[level];
      // The URI should contain the font-size from the preset
      expect(uri).toContain(`font-size%3D'${preset.fontSize}'`);
    }
  });

  it('escapes XML special characters in text', () => {
    const uri = buildWatermarkDataUri('loud', 'A & B <C> "D"');
    // Should not contain unescaped special chars
    expect(uri).not.toContain('&');
    expect(uri).not.toContain('<C>');
    // Should contain encoded versions
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain('&amp;');
    expect(decoded).toContain('&lt;');
    expect(decoded).toContain('&gt;');
    expect(decoded).toContain('&quot;');
  });

  it('produces different tile sizes per level', () => {
    const whisperUri = buildWatermarkDataUri('whisper', 'X');
    const screamingUri = buildWatermarkDataUri('screaming', 'X');
    // Whisper should have larger tile (400) than screaming (150)
    expect(whisperUri).toContain("width%3D'400'");
    expect(screamingUri).toContain("width%3D'150'");
  });
});

// ---------------------------------------------------------------------------
// DynamicPdfPrintStyleManager
// ---------------------------------------------------------------------------

describe('DynamicPdfPrintStyleManager', () => {
  let manager: DynamicPdfPrintStyleManager;
  let dom: ReturnType<typeof setupDOM>;

  function makeSettings(overrides: Partial<DocumentSettings> = {}): DocumentSettings {
    return { ...DEFAULT_DOCUMENT_SETTINGS, ...overrides };
  }

  beforeEach(() => {
    dom = setupDOM();
    manager = new DynamicPdfPrintStyleManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('creates a style element on init', () => {
    manager.init(makeSettings());
    expect(dom.headAppendChild).toHaveBeenCalled();
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.id).toBe('yaae-dynamic-pdf-print-styles');
  });

  it('generates empty styles with all defaults', () => {
    manager.init(makeSettings());
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.textContent).toBe('');
  });

  it('emits font-size rule when fontSize differs from default', () => {
    manager.init(makeSettings({ fontSize: 14 }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('14pt');
    expect(css).toContain('@media print');
  });

  it('emits font-family rule for custom font string', () => {
    manager.init(makeSettings({ fontFamily: 'Inter, sans-serif' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('Inter, sans-serif');
  });

  it('emits watermark overrides when watermarkText differs from DRAFT', () => {
    manager.init(makeSettings({ watermarkText: 'CONFIDENTIAL' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('.pdf-watermark-whisper');
    expect(css).toContain('.pdf-watermark-heads-up');
    expect(css).toContain('.pdf-watermark-loud');
    expect(css).toContain('.pdf-watermark-screaming');
    expect(css).toContain('CONFIDENTIAL');
  });

  it('does not emit watermark overrides when text is DRAFT (default)', () => {
    manager.init(makeSettings({ watermarkText: 'DRAFT' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).not.toContain('.pdf-watermark-');
  });

  it('emits line-height override when lineHeight differs from default', () => {
    manager.init(makeSettings({ lineHeight: 1.8 }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('--print-line-height: 1.8');
  });

  it('does not emit line-height when at default 1.6', () => {
    manager.init(makeSettings({ lineHeight: 1.6 }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).not.toContain('--print-line-height');
  });

  it('updates styles dynamically', () => {
    manager.init(makeSettings());
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.textContent).toBe('');

    manager.update(makeSettings({ fontSize: 16 }));
    expect(el.textContent).toContain('16pt');
  });

  it('removes style element on destroy', () => {
    manager.init(makeSettings());
    const el = getLastStyleEl(dom.headAppendChild);
    manager.destroy();
    expect(el.remove).toHaveBeenCalledOnce();
  });
});
