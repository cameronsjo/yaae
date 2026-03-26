import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DynamicPdfPrintStyleManager,
  PageChromeManager,
  buildWatermarkDataUri,
  WATERMARK_PRESETS,
} from '../src/document/print-styles';
import type { PageChromeState } from '../src/document/print-styles';
import type { CustomClassification } from '../src/schemas';
import { DEFAULT_DOCUMENT_SETTINGS, type DocumentSettings } from '../src/document/settings';

// Mock document.head and createElement for Node.js environment
function setupDOM() {
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
// PageChromeManager
// ---------------------------------------------------------------------------

const DEFAULT_CHROME: PageChromeState = {
  classification: null,
  customClassifications: [],
  headerLeft: '',
  headerRight: '',
  footerLeft: '',
  footerRight: '',
  pageNumbers: false,
  signatureBlock: false,
  bannerPosition: 'both',
  showClassificationBanner: true,
};

function makeChrome(overrides: Partial<PageChromeState> = {}): PageChromeState {
  return { ...DEFAULT_CHROME, ...overrides };
}

describe('PageChromeManager', () => {
  let manager: PageChromeManager;
  let dom: ReturnType<typeof setupDOM>;

  beforeEach(() => {
    dom = setupDOM();
    manager = new PageChromeManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('creates a style element on init', () => {
    manager.init(makeChrome());
    expect(dom.headAppendChild).toHaveBeenCalledOnce();
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.id).toBe('yaae-page-chrome-print-styles');
  });

  it('generates empty styles when no chrome is configured', () => {
    manager.init(makeChrome());
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toBe('');
  });

  it('generates @top-center for built-in classification', () => {
    manager.init(makeChrome({ classification: 'confidential' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('@top-center');
    expect(css).toContain('"CONFIDENTIAL"');
    expect(css).toContain('#c41e1e');
    expect(css).toContain('#fff5f5');
  });

  it('generates @bottom-center when bannerPosition is both', () => {
    manager.init(makeChrome({ classification: 'internal', bannerPosition: 'both' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('@top-center');
    expect(css).toContain('@bottom-center');
    expect(css).toContain('INTERNAL');
  });

  it('omits @bottom-center when bannerPosition is top', () => {
    manager.init(makeChrome({ classification: 'internal', bannerPosition: 'top' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('@top-center');
    expect(css).not.toContain('@bottom-center');
  });

  it('omits @bottom-center when signatureBlock is true', () => {
    manager.init(makeChrome({ classification: 'confidential', bannerPosition: 'both', signatureBlock: true }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('@top-center');
    expect(css).not.toContain('@bottom-center');
  });

  it('resolves custom classification via getClassificationMeta', () => {
    const customs: CustomClassification[] = [
      { id: 'secret', label: 'TOP SECRET', color: '#800080', background: '#f0e0f0' },
    ];
    manager.init(makeChrome({ classification: 'secret', customClassifications: customs }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('"TOP SECRET"');
    expect(css).toContain('#800080');
  });

  it('generates header text in correct margin boxes', () => {
    manager.init(makeChrome({ headerLeft: 'Acme Corp', headerRight: 'Engineering' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('@top-left');
    expect(css).toContain('"Acme Corp"');
    expect(css).toContain('@top-right');
    expect(css).toContain('"Engineering"');
  });

  it('generates footer text in correct margin boxes', () => {
    manager.init(makeChrome({ footerLeft: 'SENSITIVE' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('@bottom-left');
    expect(css).toContain('"SENSITIVE"');
  });

  it('generates Page X of Y when pageNumbers enabled', () => {
    manager.init(makeChrome({ pageNumbers: true }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('@bottom-right');
    expect(css).toContain('counter(page)');
    expect(css).toContain('counter(pages)');
  });

  it('combines footer right and page numbers in @bottom-right', () => {
    manager.init(makeChrome({ footerRight: 'v2.0', pageNumbers: true }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('@bottom-right');
    expect(css).toContain('"v2.0');
    expect(css).toContain('counter(page)');
  });

  it('sets @page margin to 1in', () => {
    manager.init(makeChrome({ pageNumbers: true }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('margin: 1in');
  });

  it('escapes text values for CSS safety', () => {
    manager.init(makeChrome({ headerLeft: 'Version "1.0"\nInjection' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('Version \\"1.0\\"');
    expect(css).toContain('\\a ');
    expect(css).not.toContain('\nInjection');
  });

  it('sanitizes classification colors', () => {
    const customs: CustomClassification[] = [
      { id: 'bad', label: 'BAD', color: 'red; injection', background: 'rgb(0,0,0)' },
    ];
    manager.init(makeChrome({ classification: 'bad', customClassifications: customs }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('color: #000');
    expect(css).toContain('background: #fff');
    expect(css).not.toContain('injection');
  });

  it('omits banner when showClassificationBanner is false', () => {
    manager.init(makeChrome({ classification: 'confidential', showClassificationBanner: false }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toBe('');
  });

  it('trims whitespace-only header/footer fields', () => {
    manager.init(makeChrome({ headerLeft: '   ' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toBe('');
  });

  it('updates styles dynamically', () => {
    manager.init(makeChrome());
    const el = getLastStyleEl(dom.headAppendChild);
    expect(el.textContent).toBe('');

    manager.update(makeChrome({ classification: 'public' }));
    expect(el.textContent).toContain('@top-center');
    expect(el.textContent).toContain('PUBLIC');
  });

  it('removes style element on destroy', () => {
    manager.init(makeChrome());
    const el = getLastStyleEl(dom.headAppendChild);
    manager.destroy();
    expect(el.remove).toHaveBeenCalledOnce();
  });

  it('omits banner when classification ID is unrecognized', () => {
    manager.init(makeChrome({ classification: 'nonexistent-level' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toBe('');
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

  it('uses custom font-family when provided', () => {
    const uri = buildWatermarkDataUri('whisper', 'DRAFT', 'Georgia, Times New Roman, serif');
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain("font-family='Georgia, Times New Roman, serif'");
  });

  it('escapes single quotes in font-family', () => {
    const uri = buildWatermarkDataUri('whisper', 'DRAFT', "O'Brien Serif");
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain("font-family='O&apos;Brien Serif'");
  });

  it('escapes XML-special characters in font-family', () => {
    const uri = buildWatermarkDataUri('whisper', 'DRAFT', 'Fira & Code');
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain("font-family='Fira &amp; Code'");
    expect(decoded).not.toContain("font-family='Fira & Code'");
  });

  it('defaults to sans-serif when no font-family provided', () => {
    const uri = buildWatermarkDataUri('whisper', 'DRAFT');
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain("font-family='sans-serif'");
  });

  it('produces valid SVG with empty string fontFamily', () => {
    const uri = buildWatermarkDataUri('whisper', 'DRAFT', '');
    expect(uri).toMatch(/^url\("data:image\/svg\+xml,/);
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain("font-family=''");
  });

  it('escapes single quotes in watermark text', () => {
    const uri = buildWatermarkDataUri('loud', "DON'T COPY");
    const decoded = decodeURIComponent(uri);
    expect(decoded).toContain('DON&apos;T COPY');
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

  it('always generates watermark rules even with defaults', () => {
    manager.init(makeSettings());
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('.pdf-watermark-whisper');
    expect(css).toContain('.pdf-watermark-heads-up');
    expect(css).toContain('.pdf-watermark-loud');
    expect(css).toContain('.pdf-watermark-screaming');
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

  it('emits watermark rules with DRAFT text when using default', () => {
    manager.init(makeSettings({ watermarkText: 'DRAFT' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('.pdf-watermark-');
    expect(css).toContain('DRAFT');
  });

  it('emits watermark overrides for non-default font preset', () => {
    manager.init(makeSettings({ fontFamily: 'serif' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('.pdf-watermark-whisper');
    expect(css).toContain('Georgia');
  });

  it('emits watermark rules for system font preset', () => {
    manager.init(makeSettings({ fontFamily: 'system' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('.pdf-watermark-whisper');
  });

  it('emits line-height override when lineHeight differs from default', () => {
    manager.init(makeSettings({ lineHeight: 1.8 }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('--print-line-height: 1.8');
  });

  it('does not emit line-height when at default 1.5', () => {
    manager.init(makeSettings({ lineHeight: 1.5 }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).not.toContain('--print-line-height');
  });

  it('updates styles dynamically', () => {
    manager.init(makeSettings());
    const el = getLastStyleEl(dom.headAppendChild);

    manager.update(makeSettings({ fontSize: 16 }));
    expect(el.textContent).toContain('16pt');
  });

  it('removes style element on destroy', () => {
    manager.init(makeSettings());
    const el = getLastStyleEl(dom.headAppendChild);
    manager.destroy();
    expect(el.remove).toHaveBeenCalledOnce();
  });

  // Security regression tests
  it('quotes custom font-family to prevent CSS injection', () => {
    manager.init(makeSettings({ fontFamily: 'Arial; } * { color: red } .x {' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('"Arial; } * { color: red } .x {"');
  });

  it('clamps fontSize even if passed as string via tampered JSON', () => {
    const settings = makeSettings() as Record<string, unknown>;
    settings.fontSize = '200';
    manager.init(settings as DocumentSettings);
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('72pt');
  });

  it('targets :root for line-height override', () => {
    manager.init(makeSettings({ lineHeight: 1.8 }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain(':root');
    expect(css).not.toMatch(/\bbody\b/);
  });

  // Coverage gap tests
  it('non-default font preset preserves DRAFT watermark text', () => {
    manager.init(makeSettings({ fontFamily: 'mono' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('.pdf-watermark-whisper');
    expect(css).toContain('DRAFT');
    expect(css).toContain('Consolas');
  });

  it('custom font string embeds raw font in watermark SVG', () => {
    manager.init(makeSettings({ fontFamily: 'Fira Code' }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('.pdf-watermark-whisper');
    expect(css).toContain('Fira%20Code');
  });

  it('generates all rule types when all flags are non-default', () => {
    manager.init(makeSettings({
      fontSize: 14,
      fontFamily: 'Inter',
      watermarkText: 'SECRET',
      lineHeight: 1.8,
    }));
    const css = getLastStyleEl(dom.headAppendChild).textContent!;
    expect(css).toContain('14pt');
    expect(css).toContain('font-family:');
    expect(css).toContain('.pdf-watermark-');
    expect(css).toContain('--print-line-height: 1.8');
  });
});
