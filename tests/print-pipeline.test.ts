import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PrintStyleManager,
  buildMarginBoxCss,
  buildFixedChromeCss,
  buildDocumentCss,
  buildBaseCss,
  deriveStateClasses,
  detectChromeMajor,
  supportsMarginBoxes,
  resolvePrintVars,
  bakePrintVars,
  defaultPrintVars,
  PRINT_VAR_DEFAULTS,
  buildWatermarkDataUri,
  WATERMARK_PRESETS,
} from '../src/document/print';
import type { PrintDocumentState } from '../src/document/print';
import { buildPrintDocumentState } from '../src/document/print/state';
import { activateStateCss } from '../src/document/print/activate';
import type { CustomClassification } from '../src/schemas';
import { validateMarkdown, extractFrontmatter } from '../src/schemas';
import { DEFAULT_DOCUMENT_SETTINGS } from '../src/document/settings';

const VARS = defaultPrintVars();

const DEFAULT_STATE: PrintDocumentState = {
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
  theme: 'light',
  fontFamily: 'sans',
  fontSize: DEFAULT_DOCUMENT_SETTINGS.fontSize,
  lineHeight: DEFAULT_DOCUMENT_SETTINGS.lineHeight,
  watermark: 'off',
  watermarkText: 'DRAFT',
  linksMode: 'expand',
  copyPasteSafe: true,
  compactTables: true,
};

function makeState(overrides: Partial<PrintDocumentState> = {}): PrintDocumentState {
  return { ...DEFAULT_STATE, ...overrides };
}

// ---------------------------------------------------------------------------
// Chrome version gate
// ---------------------------------------------------------------------------

describe('detectChromeMajor / supportsMarginBoxes', () => {
  it.each([
    ['Mozilla/5.0 Chrome/120.0.6099.291 Electron/28', 120, false],
    ['Mozilla/5.0 Chrome/128.0.6613.186 Electron/32.2.2', 128, false],
    ['Mozilla/5.0 Chrome/131.0.0.0', 131, true],
    ['Mozilla/5.0 Chrome/132.0.6834.210 Electron/34', 132, true],
  ])('%s → major %i, marginBoxes %s', (ua, major, boxes) => {
    expect(detectChromeMajor(ua)).toBe(major);
    expect(supportsMarginBoxes(major)).toBe(boxes);
  });

  it('returns 0 for a UA without Chrome', () => {
    expect(detectChromeMajor('Mozilla/5.0 Safari/605.1.15')).toBe(0);
    expect(supportsMarginBoxes(0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Knob resolution + baking (3e)
// ---------------------------------------------------------------------------

describe('resolvePrintVars', () => {
  it('prefers the cascade value and falls back to the table default', () => {
    const vars = resolvePrintVars((name) =>
      name === '--yaae-print-code-bg' ? ' #123456 ' : '',
    );
    expect(vars['--yaae-print-code-bg']).toBe('#123456');
    expect(vars['--yaae-print-code-border-color']).toBe('#ddd');
  });

  it('covers every declared knob', () => {
    const vars = resolvePrintVars(() => '');
    expect(Object.keys(vars).sort()).toEqual(Object.keys(PRINT_VAR_DEFAULTS).sort());
  });

  it('declares the signature-block knobs the CSS consumes', () => {
    expect(PRINT_VAR_DEFAULTS['--yaae-print-sig-margin-top']).toBe('3em');
    expect(PRINT_VAR_DEFAULTS['--yaae-print-sig-font-size']).toBe('10pt');
  });

  it('drops the placebo page-number position knobs', () => {
    expect(PRINT_VAR_DEFAULTS).not.toHaveProperty('--yaae-print-page-number-bottom');
    expect(PRINT_VAR_DEFAULTS).not.toHaveProperty('--yaae-print-page-number-right');
  });
});

describe('bakePrintVars', () => {
  it('replaces bare var() references', () => {
    expect(bakePrintVars('a { color: var(--yaae-print-link-url-color); }', VARS))
      .toBe('a { color: #666; }');
  });

  it('replaces two-arg var(--x, fallback) references', () => {
    expect(
      bakePrintVars('x { margin-top: var(--yaae-print-sig-margin-top, 3em); }', VARS),
    ).toBe('x { margin-top: 3em; }');
  });

  it('uses the inline fallback for unknown knobs', () => {
    expect(bakePrintVars('x { top: var(--yaae-print-unknown, 5px); }', VARS))
      .toBe('x { top: 5px; }');
  });

  it('leaves non-yaae var() references alone', () => {
    const css = 'x { font-family: var(--font-monospace); }';
    expect(bakePrintVars(css, VARS)).toBe(css);
  });
});

describe('buildBaseCss', () => {
  it('bakes every knob — zero var(--yaae-print-…) remains', () => {
    const css = buildBaseCss(VARS);
    expect(css).not.toContain('var(--yaae-print-');
    expect(css.length).toBeGreaterThan(500);
  });

  it('keeps the class-keyed extensibility rules', () => {
    const css = buildBaseCss(VARS);
    expect(css).toContain('.pdf-theme-dark');
    expect(css).toContain('.pdf-links-plain');
    expect(css).toContain('.pdf-signature-block');
  });

  it('reflects a Style Settings override in the baked output', () => {
    const vars = resolvePrintVars((name) =>
      name === '--yaae-print-table-font-size' ? '0.7em' : '',
    );
    expect(buildBaseCss(vars)).toContain('font-size: 0.7em');
  });
});

// ---------------------------------------------------------------------------
// Margin-box chrome strategy (ported PageChromeManager matrix)
// ---------------------------------------------------------------------------

describe('buildMarginBoxCss', () => {
  it('is empty when no chrome is configured', () => {
    expect(buildMarginBoxCss(makeState(), VARS)).toBe('');
  });

  it('generates @top-center for built-in classification', () => {
    const css = buildMarginBoxCss(makeState({ classification: 'confidential' }), VARS);
    expect(css).toContain('@top-center');
    expect(css).toContain('"CONFIDENTIAL"');
    expect(css).toContain('#c41e1e');
    expect(css).toContain('#fff5f5');
  });

  it('generates @bottom-center when bannerPosition is both', () => {
    const css = buildMarginBoxCss(
      makeState({ classification: 'internal', bannerPosition: 'both' }), VARS);
    expect(css).toContain('@top-center');
    expect(css).toContain('@bottom-center');
    expect(css).toContain('INTERNAL');
  });

  it('omits @bottom-center when bannerPosition is top', () => {
    const css = buildMarginBoxCss(
      makeState({ classification: 'internal', bannerPosition: 'top' }), VARS);
    expect(css).toContain('@top-center');
    expect(css).not.toContain('@bottom-center');
  });

  it('omits @bottom-center when signatureBlock is true', () => {
    const css = buildMarginBoxCss(
      makeState({ classification: 'confidential', signatureBlock: true }), VARS);
    expect(css).toContain('@top-center');
    expect(css).not.toContain('@bottom-center');
  });

  it('resolves custom classifications', () => {
    const customs: CustomClassification[] = [
      { id: 'secret', label: 'TOP SECRET', color: '#800080', background: '#f0e0f0' },
    ];
    const css = buildMarginBoxCss(
      makeState({ classification: 'secret', customClassifications: customs }), VARS);
    expect(css).toContain('"TOP SECRET"');
    expect(css).toContain('#800080');
  });

  it('places headers, footers, and page numbers in their margin boxes', () => {
    const css = buildMarginBoxCss(
      makeState({
        headerLeft: 'Acme Corp', headerRight: 'Engineering',
        footerLeft: 'SENSITIVE', footerRight: 'v2.0', pageNumbers: true,
      }), VARS);
    expect(css).toContain('@top-left');
    expect(css).toContain('"Acme Corp"');
    expect(css).toContain('@top-right');
    expect(css).toContain('"Engineering"');
    expect(css).toContain('@bottom-left');
    expect(css).toContain('"SENSITIVE"');
    expect(css).toContain('@bottom-right');
    expect(css).toContain('"v2.0');
    expect(css).toContain('counter(page)');
    expect(css).toContain('counter(pages)');
    expect(css).toContain('margin: 1in');
  });

  it('styles chrome text from resolved knobs, not hardcoded values', () => {
    const vars = resolvePrintVars((name) => {
      if (name === '--yaae-print-header-footer-color') return '#123abc';
      if (name === '--yaae-print-banner-font-size') return '14px';
      return '';
    });
    const css = buildMarginBoxCss(
      makeState({ classification: 'internal', headerLeft: 'Acme' }), vars);
    expect(css).toContain('color: #123abc');
    expect(css).toContain('font-size: 14px');
    expect(css).not.toContain('var(--yaae-print-');
  });

  it('escapes text values for CSS safety', () => {
    const css = buildMarginBoxCss(
      makeState({ headerLeft: 'Version "1.0"\nInjection' }), VARS);
    expect(css).toContain('Version \\"1.0\\"');
    expect(css).not.toContain('\nInjection');
  });

  it('sanitizes classification colors', () => {
    const customs: CustomClassification[] = [
      { id: 'bad', label: 'BAD', color: 'red; injection', background: 'rgb(0,0,0)' },
    ];
    const css = buildMarginBoxCss(
      makeState({ classification: 'bad', customClassifications: customs }), VARS);
    expect(css).toContain('color: #000');
    expect(css).toContain('background: #fff');
    expect(css).not.toContain('injection');
  });

  it('still shows the PDF banner when showClassificationBanner is false', () => {
    const css = buildMarginBoxCss(
      makeState({ classification: 'confidential', showClassificationBanner: false }), VARS);
    expect(css).toContain('@top-center');
  });

  it('trims whitespace-only header/footer fields', () => {
    expect(buildMarginBoxCss(makeState({ headerLeft: '   ' }), VARS)).toBe('');
  });

  it('omits the banner for an unrecognized classification', () => {
    expect(buildMarginBoxCss(makeState({ classification: 'nonexistent' }), VARS)).toBe('');
  });

  it('auto theme nests prefers-color-scheme inside @media print', () => {
    const css = buildMarginBoxCss(
      makeState({ classification: 'confidential', theme: 'auto' }), VARS);
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).not.toContain('@media print and (prefers-color-scheme: dark)');
    const printIdx = css.indexOf('@media print');
    const darkIdx = css.indexOf('@media (prefers-color-scheme: dark)');
    expect(darkIdx).toBeGreaterThan(printIdx);
  });

  it('light theme emits no prefers-color-scheme override', () => {
    const css = buildMarginBoxCss(
      makeState({ classification: 'confidential', theme: 'light' }), VARS);
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('dark theme bakes dark colors statically with no @media override', () => {
    const customs: CustomClassification[] = [
      { id: 'x', label: 'X', color: '#111111', background: '#eeeeee', colorDark: '#dddddd', backgroundDark: '#222222' },
    ];
    const css = buildMarginBoxCss(
      makeState({ classification: 'x', customClassifications: customs, theme: 'dark' }), VARS);
    expect(css).toContain('#dddddd');
    expect(css).toContain('#222222');
    expect(css).not.toContain('prefers-color-scheme');
  });

  it('dark theme falls back to light colors when dark variants are absent', () => {
    const customs: CustomClassification[] = [
      { id: 'x', label: 'X', color: '#111111', background: '#eeeeee' },
    ];
    const css = buildMarginBoxCss(
      makeState({ classification: 'x', customClassifications: customs, theme: 'dark' }), VARS);
    expect(css).toContain('#111111');
  });

  it('auto theme emits the dark override even without explicit dark colors', () => {
    const customs: CustomClassification[] = [
      { id: 'x', label: 'X', color: '#111111', background: '#eeeeee' },
    ];
    const css = buildMarginBoxCss(
      makeState({ classification: 'x', customClassifications: customs, theme: 'auto' }), VARS);
    expect(css).toContain('prefers-color-scheme');
  });
});

// ---------------------------------------------------------------------------
// Fixed-position chrome strategy (Chrome < 131)
// ---------------------------------------------------------------------------

describe('buildFixedChromeCss', () => {
  it('renders banners as fixed body pseudo-elements', () => {
    const css = buildFixedChromeCss(makeState({ classification: 'confidential' }), VARS);
    expect(css).toContain('body::before');
    expect(css).toContain('position: fixed');
    expect(css).toContain('"CONFIDENTIAL"');
    expect(css).toContain('body::after'); // bannerPosition both
  });

  it('never emits counter(page) — page numbers degrade below 131', () => {
    const css = buildFixedChromeCss(makeState({ pageNumbers: true }), VARS);
    expect(css).not.toContain('counter(page)');
  });

  it('keeps the universal @page margin', () => {
    const css = buildFixedChromeCss(makeState({ classification: 'internal' }), VARS);
    expect(css).toContain('margin: 1in');
    expect(css).not.toContain('@top-center'); // no margin boxes in this strategy
  });

  it('headers use the view pseudo-elements, footers the sizer', () => {
    const css = buildFixedChromeCss(
      makeState({ headerLeft: 'L', headerRight: 'R', footerLeft: 'FL', footerRight: 'FR' }),
      VARS,
    );
    expect(css).toContain('.markdown-preview-view::before');
    expect(css).toContain('.markdown-preview-view::after');
    expect(css).toContain('.markdown-preview-sizer::before');
    expect(css).toContain('.markdown-preview-sizer::after');
  });

  it('signature block suppresses footer-right (sizer::after collision) and the bottom banner', () => {
    const css = buildFixedChromeCss(
      makeState({ classification: 'internal', footerRight: 'FR', signatureBlock: true }),
      VARS,
    );
    expect(css).not.toContain('.markdown-preview-sizer::after');
    expect(css).not.toContain('body::after');
  });

  it('escapes and sanitizes like the margin-box strategy', () => {
    const css = buildFixedChromeCss(makeState({ headerLeft: 'V "1"\nX' }), VARS);
    expect(css).toContain('V \\"1\\"');
    expect(css).not.toContain('\nX');
  });
});

// ---------------------------------------------------------------------------
// Document styles (state-baked)
// ---------------------------------------------------------------------------

describe('buildDocumentCss', () => {
  it('renders the active watermark as a full-page overlay on Chrome >= 131 (#25)', () => {
    const css = buildDocumentCss(makeState({ watermark: 'loud' }), VARS, true);
    expect(css).toContain('full-page overlay');
    const overlay = css.slice(css.indexOf('full-page overlay'));
    expect(overlay).toContain('html::before');
    expect(overlay).toContain('position: fixed');
    expect(overlay).toContain('inset: 0');
  });

  it('renders the active watermark on the content box on Chrome < 131', () => {
    const css = buildDocumentCss(makeState({ watermark: 'loud' }), VARS, false);
    expect(css).toContain('content-box, Chrome < 131');
    expect(css).not.toContain('html::before'); // no fixed overlay to collide with the fixed chrome
    expect(css).toContain('.print .markdown-preview-view.markdown-preview-view');
  });

  it('emits exactly one watermark layer for the active level (no double-dose)', () => {
    const overlayCss = buildDocumentCss(makeState({ watermark: 'loud' }), VARS, true);
    const contentCss = buildDocumentCss(makeState({ watermark: 'loud' }), VARS, false);
    // Each strategy emits one tiled layer; the courtesy .pdf-watermark-* class
    // rules are gone, so the synced body class can't add a second layer.
    expect(overlayCss).not.toContain('.pdf-watermark-');
    expect(contentCss).not.toContain('.pdf-watermark-');
    expect(overlayCss.match(/background-image:/g) ?? []).toHaveLength(1);
    expect(contentCss.match(/background-image:/g) ?? []).toHaveLength(1);
  });

  it('emits no watermark layer when off', () => {
    const css = buildDocumentCss(makeState(), VARS, true);
    expect(css).not.toContain('html::before');
    expect(css).not.toContain('watermark');
  });

  it('does not sync a pdf-watermark-* body class (would double the layer)', () => {
    expect(deriveStateClasses(makeState({ watermark: 'loud' }))).not.toContain('pdf-watermark-loud');
  });

  it('embeds the watermark text in the SVG data URI', () => {
    const css = buildDocumentCss(
      makeState({ watermark: 'loud', watermarkText: 'SECRET' }), VARS, true);
    expect(css).toContain(encodeURIComponent('SECRET'));
  });

  it('emits font-size rule only when off-default', () => {
    expect(buildDocumentCss(makeState(), VARS)).not.toContain('font-size: 11pt');
    expect(buildDocumentCss(makeState({ fontSize: 14 }), VARS)).toContain('font-size: 14pt');
  });

  it('emits font-family rule for a custom (non-preset) font', () => {
    const css = buildDocumentCss(makeState({ fontFamily: 'Inter' }), VARS);
    expect(css).toContain('font-family:');
    expect(css).toContain('Inter');
  });

  it('dark theme emits a specificity-bumped surface override', () => {
    const css = buildDocumentCss(makeState({ theme: 'dark' }), VARS);
    expect(css).toContain('.print .markdown-preview-view.markdown-preview-view');
    expect(css).toContain('#1e1e1e');
    expect(css).toContain('#d4d4d4');
  });

  it('auto theme nests the dark surface in prefers-color-scheme', () => {
    const css = buildDocumentCss(makeState({ theme: 'auto' }), VARS);
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).not.toContain('@media print and (prefers-color-scheme');
  });

  it('activates links-mode rules without classes (state-baked)', () => {
    const css = buildDocumentCss(makeState({ linksMode: 'plain' }), VARS);
    expect(css).toContain('.print .markdown-preview-view a');
    expect(css).toContain('text-decoration: none !important');
  });

  it('activates the signature block without classes', () => {
    const css = buildDocumentCss(makeState({ signatureBlock: true }), VARS);
    expect(css).toContain('.markdown-preview-sizer::after');
    expect(css).toContain('Prepared by:');
  });

  it('leaves zero unbaked yaae knob references', () => {
    const css = buildDocumentCss(
      makeState({ theme: 'dark', linksMode: 'plain', signatureBlock: true, watermark: 'loud' }),
      VARS,
    );
    expect(css).not.toContain('var(--yaae-print-');
  });

  it('never leaks the @media screen signature antidote into the print element', () => {
    // signature-block.css ships an @media screen rule that hides the print
    // pseudo-element in the live view; activation must not sweep it into the
    // permanently-mounted print-document element.
    const css = buildDocumentCss(makeState({ signatureBlock: true }), VARS);
    expect(css).not.toContain('@media screen');
  });

  it('a newline in a custom fontFamily cannot break out of its rule', () => {
    const css = buildDocumentCss(
      makeState({ fontFamily: 'Arial\n} body::before { display: none' }),
      VARS,
    );
    // The newline is escaped to \a and the payload stays inside the quoted
    // font-family value — it never becomes a real `} body::before {` rule.
    expect(css).not.toContain('\n} body::before');
    expect(css).toMatch(/font-family: "Arial\\a } body::before/);
  });
});

describe('deriveStateClasses', () => {
  it('maps state to the pdf-* class set (watermark excluded — rendered directly)', () => {
    expect(
      deriveStateClasses(makeState({
        theme: 'dark', linksMode: 'plain', signatureBlock: true, watermark: 'loud',
      })).sort(),
    ).toEqual([
      'pdf-compact-tables', 'pdf-copy-safe', 'pdf-font-sans', 'pdf-links-plain',
      'pdf-signature-block', 'pdf-theme-dark',
    ]);
  });

  it('omits classes for defaults that mean "off"', () => {
    const classes = deriveStateClasses(
      makeState({ copyPasteSafe: false, compactTables: false, fontFamily: 'Custom Font' }),
    );
    expect(classes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// State-class activation transform
// ---------------------------------------------------------------------------

describe('activateStateCss', () => {
  const css = `@media print {
  .pdf-copy-safe { font-variant-ligatures: none; }
  .pdf-links-plain a { color: inherit; }
  .pdf-theme-dark h1 { color: #eee; }
  a.external-link::after { content: " url"; }
  @media (prefers-color-scheme: dark) {
    .pdf-theme-auto code { background: #222; }
  }
}`;

  it('rewrites active class rules to view-targeted selectors', () => {
    const out = activateStateCss(css, new Set(['pdf-copy-safe', 'pdf-links-plain']));
    expect(out).toContain('.print .markdown-preview-view {');
    expect(out).toContain('.print .markdown-preview-view a {');
  });

  it('drops rules keyed on inactive classes', () => {
    const out = activateStateCss(css, new Set(['pdf-copy-safe']));
    expect(out).not.toContain('a {');
    expect(out).not.toContain('#eee');
  });

  it('skips classless rules (already live in base)', () => {
    const out = activateStateCss(css, new Set(['pdf-copy-safe']));
    expect(out).not.toContain('external-link');
  });

  it('preserves nested at-rule wrappers', () => {
    const out = activateStateCss(css, new Set(['pdf-theme-auto']));
    expect(out).toContain('@media print {');
    expect(out).toContain('@media (prefers-color-scheme: dark) {');
    expect(out).toContain('code {');
  });
});

// ---------------------------------------------------------------------------
// State builder (presence-gated overrides)
// ---------------------------------------------------------------------------

describe('buildPrintDocumentState', () => {
  const fm = (yaml: string) => {
    const content = `---\n${yaml}\n---\n\nBody`;
    return {
      raw: extractFrontmatter(content),
      validated: validateMarkdown(content).data,
    };
  };

  it('uses settings defaults without a document', () => {
    const state = buildPrintDocumentState(DEFAULT_DOCUMENT_SETTINGS);
    expect(state.classification).toBe('internal');
    expect(state.fontSize).toBe(11);
    expect(state.theme).toBe('light');
  });

  it('schema defaults never shadow settings (placebo guard)', () => {
    const settings = { ...DEFAULT_DOCUMENT_SETTINGS, fontSize: 14, theme: 'dark' as const };
    // Doc sets neither fontSize nor theme — schema fills defaults (11, light),
    // which must NOT override the settings.
    const state = buildPrintDocumentState(settings, fm('title: T\ncreated: 2024-01-01\nexport:\n  pdf:\n    toc: true'));
    expect(state.fontSize).toBe(14);
    expect(state.theme).toBe('dark');
  });

  it('explicit frontmatter overrides settings', () => {
    const state = buildPrintDocumentState(
      DEFAULT_DOCUMENT_SETTINGS,
      fm('title: T\ncreated: 2024-01-01\nclassification: confidential\nexport:\n  pdf:\n    theme: dark\n    fontSize: 9\n    signatureBlock: true'),
    );
    expect(state.classification).toBe('confidential');
    expect(state.theme).toBe('dark');
    expect(state.fontSize).toBe(9);
    expect(state.signatureBlock).toBe(true);
  });

  it('explicit draft status engages the default draft watermark', () => {
    const state = buildPrintDocumentState(
      DEFAULT_DOCUMENT_SETTINGS,
      fm('title: T\ncreated: 2024-01-01\nstatus: draft'),
    );
    expect(state.watermark).toBe(DEFAULT_DOCUMENT_SETTINGS.defaultWatermarkForDrafts);
  });

  it('schema-defaulted draft status does NOT watermark (raw-gated)', () => {
    // status defaults to 'draft' in the schema; without an explicit status
    // key no watermark engages.
    const state = buildPrintDocumentState(DEFAULT_DOCUMENT_SETTINGS, fm('title: T\ncreated: 2024-01-01'));
    expect(state.watermark).toBe('off');
  });

  it('explicit watermark beats the draft default', () => {
    const state = buildPrintDocumentState(
      DEFAULT_DOCUMENT_SETTINGS,
      fm('title: T\ncreated: 2024-01-01\nstatus: draft\nexport:\n  pdf:\n    watermark: screaming'),
    );
    expect(state.watermark).toBe('screaming');
  });

  it('links mode migration goes through resolveLinksMode', () => {
    const state = buildPrintDocumentState(
      DEFAULT_DOCUMENT_SETTINGS,
      fm('title: T\ncreated: 2024-01-01\nexport:\n  pdf:\n    plainLinks: true'),
    );
    expect(state.linksMode).toBe('plain');
  });

  it('invalid documents contribute no overrides', () => {
    const doc = {
      raw: { export: { pdf: { theme: 'dark' } } } as Record<string, unknown>,
      validated: undefined,
    };
    const state = buildPrintDocumentState(DEFAULT_DOCUMENT_SETTINGS, doc);
    expect(state.theme).toBe(DEFAULT_DOCUMENT_SETTINGS.theme);
  });

  it('schema-defaulted classification does NOT shadow the settings default', () => {
    // The schema defaults classification to 'internal'. A note without an
    // explicit classification key must keep the settings default.
    const settings = { ...DEFAULT_DOCUMENT_SETTINGS, defaultClassification: 'public' };
    const state = buildPrintDocumentState(settings, fm('title: T\ncreated: 2024-01-01'));
    expect(state.classification).toBe('public');
  });

  it('explicit classification frontmatter still overrides', () => {
    const settings = { ...DEFAULT_DOCUMENT_SETTINGS, defaultClassification: 'public' };
    const state = buildPrintDocumentState(
      settings, fm('title: T\ncreated: 2024-01-01\nclassification: confidential'));
    expect(state.classification).toBe('confidential');
  });
});

// ---------------------------------------------------------------------------
// Watermark data URI (ported verbatim semantics)
// ---------------------------------------------------------------------------

describe('buildWatermarkDataUri', () => {
  it('returns a data URI string', () => {
    const uri = buildWatermarkDataUri('loud', 'DRAFT');
    expect(uri).toMatch(/^url\("data:image\/svg\+xml,/);
  });

  it('escapes XML special characters in text and font', () => {
    const uri = decodeURIComponent(buildWatermarkDataUri('loud', `<&>"'`, `Font's <X>`));
    expect(uri).toContain('&lt;&amp;&gt;&quot;&apos;');
    expect(uri).toContain('Font&apos;s &lt;X&gt;');
  });

  it('produces different opacity per level with consistent tile size', () => {
    const opacities = Object.keys(WATERMARK_PRESETS).map((level) => {
      const uri = decodeURIComponent(
        buildWatermarkDataUri(level as keyof typeof WATERMARK_PRESETS, 'X'),
      );
      return uri.match(/rgba\(0,0,0,([\d.]+)\)/)?.[1];
    });
    expect(new Set(opacities).size).toBe(opacities.length);
  });
});

// ---------------------------------------------------------------------------
// Facade lifecycle
// ---------------------------------------------------------------------------

describe('PrintStyleManager', () => {
  function fakeClassList() {
    const set = new Set<string>();
    return {
      add: (c: string) => set.add(c),
      remove: (c: string) => set.delete(c),
      contains: (c: string) => set.has(c),
      values: () => [...set],
    };
  }

  let styleEls: Array<{ id: string; textContent: string; remove: ReturnType<typeof vi.fn> }>;
  let bodyClasses: ReturnType<typeof fakeClassList>;

  beforeEach(() => {
    styleEls = [];
    bodyClasses = fakeClassList();
    (globalThis as any).document = {
      createElement: vi.fn(() => {
        const el = { id: '', textContent: '', remove: vi.fn() };
        return el;
      }),
      head: { appendChild: vi.fn((el: any) => styleEls.push(el)) },
      body: { classList: bodyClasses },
    };
  });

  afterEach(() => {
    delete (globalThis as any).document;
  });

  function makeManager(overrides: Partial<PrintDocumentState> = {}, ua = 'Chrome/132.0') {
    return new PrintStyleManager({
      getState: () => makeState(overrides),
      readCssVar: () => '',
      userAgent: ua,
    });
  }

  it('init creates the three style elements and renders them', () => {
    const mgr = makeManager({ classification: 'internal', pageNumbers: true });
    mgr.init();
    expect(styleEls.map((e) => e.id)).toEqual([
      'yaae-print-base', 'yaae-print-document', 'yaae-print-chrome',
    ]);
    expect(styleEls[0].textContent).toContain('@media print');
    expect(styleEls[2].textContent).toContain('@top-center');
  });

  it('selects the fixed strategy below Chrome 131', () => {
    const mgr = makeManager({ classification: 'internal' }, 'Chrome/120.0');
    expect(mgr.usesMarginBoxes).toBe(false);
    mgr.init();
    expect(styleEls[2].textContent).toContain('position: fixed');
    expect(styleEls[2].textContent).not.toContain('counter(page)');
  });

  it('refresh re-renders from current state', () => {
    let theme: PrintDocumentState['theme'] = 'light';
    const mgr = new PrintStyleManager({
      getState: () => makeState({ theme }),
      readCssVar: () => '',
      userAgent: 'Chrome/132.0',
    });
    mgr.init();
    expect(styleEls[1].textContent).not.toContain('#1e1e1e');
    theme = 'dark';
    mgr.refresh();
    expect(styleEls[1].textContent).toContain('#1e1e1e');
  });

  it('syncs tracked pdf-* body classes, replacing on change', () => {
    let linksMode: PrintDocumentState['linksMode'] = 'plain';
    const mgr = new PrintStyleManager({
      getState: () => makeState({ linksMode }),
      readCssVar: () => '',
      userAgent: 'Chrome/132.0',
    });
    mgr.init();
    expect(bodyClasses.contains('pdf-links-plain')).toBe(true);
    linksMode = 'stripped';
    mgr.refresh();
    expect(bodyClasses.contains('pdf-links-plain')).toBe(false);
    expect(bodyClasses.contains('pdf-links-stripped')).toBe(true);
  });

  it('refreshDocument rebuilds document + chrome but not base', () => {
    let theme: PrintDocumentState['theme'] = 'light';
    let knob = '';
    const mgr = new PrintStyleManager({
      getState: () => makeState({ theme }),
      readCssVar: (name) => (name === '--yaae-print-code-bg' ? knob : ''),
      userAgent: 'Chrome/132.0',
    });
    mgr.init();
    const baseAfterInit = styleEls[0].textContent;

    // Change a knob AND a document setting, then refresh only the document:
    // base must stay frozen (knob not re-read), document must update.
    knob = '#abcdef';
    theme = 'dark';
    mgr.refreshDocument();
    expect(styleEls[0].textContent).toBe(baseAfterInit); // base untouched
    expect(styleEls[0].textContent).not.toContain('#abcdef');
    expect(styleEls[1].textContent).toContain('#1e1e1e'); // document updated

    // refreshVars picks the knob up.
    mgr.refreshVars();
    expect(styleEls[0].textContent).toContain('#abcdef');
  });

  it('re-init removes prior elements first (idempotent)', () => {
    const mgr = makeManager();
    mgr.init();
    const first = [...styleEls];
    mgr.init();
    for (const el of first) expect(el.remove).toHaveBeenCalled();
    expect(styleEls).toHaveLength(6);
  });

  it('destroy removes elements and clears tracked classes', () => {
    const mgr = makeManager({ linksMode: 'plain' });
    mgr.init();
    mgr.destroy();
    for (const el of styleEls) expect(el.remove).toHaveBeenCalledOnce();
    expect(bodyClasses.contains('pdf-links-plain')).toBe(false);
  });
});
