import type { CustomClassification } from '../schemas/classification';
import { getClassificationMeta } from '../schemas/classification';
import type { DocumentSettings, FontPreset } from './settings';
import { DEFAULT_DOCUMENT_SETTINGS } from './settings';
import { escapeCssString, sanitizeColor, clampNumber, sanitizeFontFamily, sanitizeCssId } from './css-sanitize';

const DYNAMIC_PDF_STYLE_ID = 'yaae-dynamic-pdf-print-styles';
const PAGE_CHROME_STYLE_ID = 'yaae-page-chrome-print-styles';

const FONT_PRESETS: Set<FontPreset> = new Set<FontPreset>(['sans', 'serif', 'mono', 'system']);

/** Map named font presets to SVG-safe font-family values. */
const FONT_PRESET_SVG: Record<FontPreset, string> = {
  sans: 'sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'Consolas, Courier New, monospace',
  system: 'sans-serif',
};

/**
 * State for the page chrome — everything that appears in @page margin boxes.
 * Updated when the active document changes or settings change.
 */
export interface PageChromeState {
  classification: string | null;
  customClassifications: CustomClassification[];
  headerLeft: string;
  headerRight: string;
  footerLeft: string;
  footerRight: string;
  pageNumbers: boolean;
  signatureBlock: boolean;
  bannerPosition: 'top' | 'both';
  showClassificationBanner: boolean;
}

/** Shared base styles for banner margin boxes.
 * Static values — var() does not work inside @page margin boxes in Chrome. */
const BANNER_BASE = `
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;`;

/** Shared base styles for header/footer margin boxes.
 * Static values — var() does not work inside @page margin boxes in Chrome. */
const CHROME_TEXT_BASE = `
    font-size: 9px;
    color: #888;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;`;

/**
 * Generate and inject @page margin box rules for classification banners,
 * headers, footers, and page numbers. Replaces the position:fixed pseudo-
 * element approach with native CSS paged media (Chrome 131+).
 *
 * Margin box allocation:
 *   @top-left:     Header left
 *   @top-center:   Classification banner
 *   @top-right:    Header right
 *   @bottom-left:  Footer left
 *   @bottom-center: Classification banner (unless signature block)
 *   @bottom-right: Page numbers + footer right
 */
export class PageChromeManager {
  private styleEl: HTMLStyleElement | null = null;

  init(state: PageChromeState): void {
    this.styleEl = document.createElement('style');
    this.styleEl.id = PAGE_CHROME_STYLE_ID;
    document.head.appendChild(this.styleEl);
    this.update(state);
    console.debug('[yaae] PageChromeManager initialized.');
  }

  update(state: PageChromeState): void {
    if (!this.styleEl) return;

    const headerLeft = state.headerLeft.trim();
    const headerRight = state.headerRight.trim();
    const footerLeft = state.footerLeft.trim();
    const footerRight = state.footerRight.trim();

    // Always resolve classification for PDF @page margin boxes.
    // showClassificationBanner only controls the reading view post-processor banner.
    const meta = state.classification
      ? getClassificationMeta(state.classification, state.customClassifications)
      : null;

    const hasTopBanner = meta !== null;
    const hasBottomBanner = meta !== null && state.bannerPosition === 'both' && !state.signatureBlock;
    const hasAny = hasTopBanner || hasBottomBanner
      || headerLeft || headerRight || footerLeft || footerRight
      || state.pageNumbers;

    if (!hasAny) {
      this.styleEl.textContent = '';
      return;
    }

    const marginBoxes: string[] = [];

    // --- Classification banners ---
    if (meta) {
      const label = escapeCssString(meta.label);
      const color = sanitizeColor(meta.color, '#000');
      const bg = sanitizeColor(meta.background, '#fff');

      if (hasTopBanner) {
        marginBoxes.push(`    @top-center {
      content: "${label}";
      color: ${color};
      background: ${bg};
      border-bottom: 2px solid ${color};${BANNER_BASE}
    }`);
      }

      if (hasBottomBanner) {
        marginBoxes.push(`    @bottom-center {
      content: "${label}";
      color: ${color};
      background: ${bg};
      border-top: 2px solid ${color};${BANNER_BASE}
    }`);
      }
    }

    // --- Headers ---
    if (headerLeft) {
      marginBoxes.push(`    @top-left {
      content: "${escapeCssString(headerLeft)}";${CHROME_TEXT_BASE}
    }`);
    }

    if (headerRight) {
      marginBoxes.push(`    @top-right {
      content: "${escapeCssString(headerRight)}";${CHROME_TEXT_BASE}
    }`);
    }

    // --- Footers ---
    if (footerLeft) {
      marginBoxes.push(`    @bottom-left {
      content: "${escapeCssString(footerLeft)}";${CHROME_TEXT_BASE}
    }`);
    }

    // --- Bottom-right: page numbers + optional footer right ---
    const pageCounterExpr = '"Page " counter(page) " of " counter(pages)';
    if (state.pageNumbers && footerRight) {
      marginBoxes.push(`    @bottom-right {
      content: "${escapeCssString(footerRight)}  \\B7  " ${pageCounterExpr};${CHROME_TEXT_BASE}
    }`);
    } else if (state.pageNumbers) {
      marginBoxes.push(`    @bottom-right {
      content: ${pageCounterExpr};${CHROME_TEXT_BASE}
    }`);
    } else if (footerRight) {
      marginBoxes.push(`    @bottom-right {
      content: "${escapeCssString(footerRight)}";${CHROME_TEXT_BASE}
    }`);
    }

    const css = `@media print {
  @page {
    margin: 1in !important;
${marginBoxes.join('\n')}
  }
}`;

    this.styleEl.textContent = css;
  }

  destroy(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }
}

/**
 * Per-level watermark presets: opacity, fontSize, fontWeight, tileSize, rotation.
 * Intensity increases from whisper → screaming.
 */
export const WATERMARK_PRESETS = {
  whisper:   { opacity: 0.04, fontSize: 48,  fontWeight: 500, tileSize: 400, rotation: -30 },
  'heads-up': { opacity: 0.08, fontSize: 80,  fontWeight: 700, tileSize: 300, rotation: -35 },
  loud:      { opacity: 0.14, fontSize: 110, fontWeight: 800, tileSize: 220, rotation: -40 },
  screaming: { opacity: 0.22, fontSize: 140, fontWeight: 900, tileSize: 150, rotation: -45 },
} as const;

type WatermarkPresetLevel = keyof typeof WATERMARK_PRESETS;

/** Escape all XML-special characters for safe embedding in SVG attributes and text. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Build a tiling SVG data URI for the watermark overlay.
 * The text is URL-encoded so special characters (quotes, ampersands) are safe.
 */
export function buildWatermarkDataUri(level: WatermarkPresetLevel, text: string, fontFamily = 'sans-serif'): string {
  const p = WATERMARK_PRESETS[level];
  const half = p.tileSize / 2;
  const encoded = escapeXml(text);
  const escapedFont = escapeXml(fontFamily);

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${p.tileSize}' height='${p.tileSize}'>`
    + `<text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' `
    + `font-family='${escapedFont}' font-size='${p.fontSize}' font-weight='${p.fontWeight}' `
    + `fill='rgba(0,0,0,${p.opacity})' `
    + `transform='rotate(${p.rotation},${half},${half})'>`
    + `${encoded}</text></svg>`;

  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/**
 * Dynamic print styles for fontSize, custom font-family, watermark text,
 * and line-height overrides. Injects rules that require JS logic
 * (SVG data URI generation, runtime value computation).
 */
export class DynamicPdfPrintStyleManager {
  private styleEl: HTMLStyleElement | null = null;

  init(settings: DocumentSettings): void {
    this.styleEl = document.createElement('style');
    this.styleEl.id = DYNAMIC_PDF_STYLE_ID;
    document.head.appendChild(this.styleEl);
    this.update(settings);
    console.debug('[yaae] DynamicPdfPrintStyleManager initialized.');
  }

  update(settings: DocumentSettings): void {
    if (!this.styleEl) return;

    const fontSize = clampNumber(settings.fontSize, 6, 72, DEFAULT_DOCUMENT_SETTINGS.fontSize);
    const lineHeight = clampNumber(settings.lineHeight, 1, 3, DEFAULT_DOCUMENT_SETTINGS.lineHeight);
    const isCustomFont = !FONT_PRESETS.has(settings.fontFamily as FontPreset);
    const hasCustomFontSize = fontSize !== DEFAULT_DOCUMENT_SETTINGS.fontSize;
    const hasCustomWatermarkText = settings.watermarkText !== DEFAULT_DOCUMENT_SETTINGS.watermarkText;
    const hasCustomLineHeight = lineHeight !== DEFAULT_DOCUMENT_SETTINGS.lineHeight;
    const hasNonDefaultFont = settings.fontFamily !== 'sans' && settings.fontFamily !== 'system';

    // No early return — watermark rules must always be emitted since
    // CSS snippets don't reach Obsidian's PDF export pipeline.

    const rules: string[] = ['@media print {'];

    if (hasCustomFontSize) {
      rules.push(`  .markdown-preview-view {
    font-size: ${fontSize}pt !important;
  }`);
    }

    if (isCustomFont) {
      rules.push(`  .markdown-preview-view {
    font-family: ${sanitizeFontFamily(settings.fontFamily)} !important;
  }`);
    }

    // Always generate watermark SVGs — CSS snippets don't reach PDF export.
    // Apply background-image directly to the cssclass element (Obsidian
    // preserves background-image on the view container during PDF export).
    {
      const text = settings.watermarkText;
      const svgFont = Object.hasOwn(FONT_PRESET_SVG, settings.fontFamily)
        ? FONT_PRESET_SVG[settings.fontFamily as FontPreset]
        : settings.fontFamily;
      for (const [level, _preset] of Object.entries(WATERMARK_PRESETS)) {
        const uri = buildWatermarkDataUri(level as WatermarkPresetLevel, text, svgFont);
        const size = WATERMARK_PRESETS[level as WatermarkPresetLevel].tileSize;
        rules.push(`  .pdf-watermark-${level} {
    background-image: ${uri};
    background-repeat: repeat;
    background-size: ${size}px ${size}px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }`);
      }
    }

    if (hasCustomLineHeight) {
      rules.push(`  :root {
    --print-line-height: ${lineHeight};
  }`);
    }

    rules.push('}');
    this.styleEl.textContent = rules.join('\n');
    console.debug(
      `[yaae] Dynamic PDF print styles updated. fontSize: ${settings.fontSize}pt, fontFamily: ${settings.fontFamily}`,
    );
  }

  destroy(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }
}
