import type { CustomClassification } from '../schemas/classification';
import type { DocumentSettings, FontPreset } from './settings';
import { DEFAULT_DOCUMENT_SETTINGS } from './settings';
import { escapeCssString, sanitizeColor, clampNumber, sanitizeFontFamily, sanitizeCssId } from './css-sanitize';

const STYLE_ID = 'yaae-custom-classification-print-styles';
const HEADER_FOOTER_STYLE_ID = 'yaae-header-footer-print-styles';
const DYNAMIC_PDF_STYLE_ID = 'yaae-dynamic-pdf-print-styles';

const FONT_PRESETS: Set<FontPreset> = new Set<FontPreset>(['sans', 'serif', 'mono', 'system']);

/** Map named font presets to SVG-safe font-family values. */
const FONT_PRESET_SVG: Record<FontPreset, string> = {
  sans: 'sans-serif',
  serif: 'Georgia, Times New Roman, serif',
  mono: 'Consolas, Courier New, monospace',
  system: 'sans-serif',
};

/**
 * Build a shared banner CSS rule for either top or bottom position.
 * Only the `position` property (top/bottom) differs between the two.
 */
function buildBannerRule(selectors: string[], position: 'top' | 'bottom'): string {
  return `  ${selectors.join(',\n  ')} {
    position: fixed;
    ${position}: 0;
    left: 0;
    right: 0;
    display: block;
    text-align: center;
    font-size: var(--yaae-print-banner-font-size, 10px);
    font-weight: 700;
    letter-spacing: var(--yaae-print-banner-letter-spacing, 0.1em);
    text-transform: uppercase;
    padding: var(--yaae-print-banner-padding, 2px 0);
    z-index: 9999;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }`;
}

/**
 * Generate and inject dynamic @media print CSS rules for custom
 * classification banners. This complements the static classification.css
 * in @yaae/print-styles, which only covers the 4 built-in levels.
 */
export class ClassificationPrintStyleManager {
  private styleEl: HTMLStyleElement | null = null;

  init(customClassifications: CustomClassification[]): void {
    this.styleEl = document.createElement('style');
    this.styleEl.id = STYLE_ID;
    document.head.appendChild(this.styleEl);
    this.update(customClassifications);
  }

  update(customClassifications: CustomClassification[]): void {
    if (!this.styleEl) return;

    // Filter to entries with valid CSS-safe IDs
    const valid = customClassifications.filter((c) => sanitizeCssId(c.id));

    if (valid.length === 0) {
      this.styleEl.textContent = '';
      return;
    }

    const rules: string[] = ['@media print {'];

    // Shared base styles for top banners
    const topSelectors = valid
      .map((c) => `.pdf-${c.id} .markdown-preview-view::before`);

    if (topSelectors.length > 0) {
      rules.push(buildBannerRule(topSelectors, 'top'));
    }

    // Shared base styles for bottom banners
    const bottomSelectors = valid
      .map((c) => `.pdf-${c.id}:not(.pdf-signature-block) .markdown-preview-sizer::after`);

    if (bottomSelectors.length > 0) {
      rules.push(buildBannerRule(bottomSelectors, 'bottom'));
    }

    // Per-classification color rules
    for (const c of valid) {
      const label = escapeCssString(c.label);
      const color = sanitizeColor(c.color, '#000');
      const bg = sanitizeColor(c.background, '#fff');

      // Top + bottom shared colors
      rules.push(`  .pdf-${c.id} .markdown-preview-view::before,
  .pdf-${c.id}:not(.pdf-signature-block) .markdown-preview-sizer::after {
    content: "${label}";
    color: ${color};
    background: ${bg};
    border-bottom: 2px solid ${color};
  }`);

      // Bottom banner: swap border to top
      rules.push(`  .pdf-${c.id}:not(.pdf-signature-block) .markdown-preview-sizer::after {
    border-bottom: none;
    border-top: 2px solid ${color};
  }`);
    }

    rules.push('}');
    this.styleEl.textContent = rules.join('\n');
  }

  destroy(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }
}

/**
 * Base styles shared by all header/footer pseudo-elements.
 * Uses CSS custom properties so values can be overridden via Style Settings.
 */
const HEADER_FOOTER_BASE = `
    font-size: var(--yaae-print-header-footer-font-size, 9px);
    color: var(--yaae-print-header-footer-color, #888);
    z-index: 9998;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;`;

/**
 * Generate and inject dynamic @media print CSS rules for page headers
 * and footers. Uses fixed-positioned pseudo-elements that repeat on
 * every printed page.
 *
 * Pseudo-element allocation (avoiding conflicts with existing features):
 *   - Header left:  .print::before     (fixed top-left)
 *   - Header right: .markdown-preview-view::after (fixed top-right)
 *   - Footer left:  .markdown-preview-sizer::before (fixed bottom-left)
 *   - Footer right: .print::after      (fixed bottom-right)
 */
export class HeaderFooterPrintStyleManager {
  private styleEl: HTMLStyleElement | null = null;

  init(settings: DocumentSettings): void {
    this.styleEl = document.createElement('style');
    this.styleEl.id = HEADER_FOOTER_STYLE_ID;
    document.head.appendChild(this.styleEl);
    this.update(settings);
  }

  update(settings: DocumentSettings): void {
    if (!this.styleEl) return;

    const headerLeft = settings.defaultHeaderLeft.trim();
    const headerRight = settings.defaultHeaderRight.trim();
    const footerLeft = settings.defaultFooterLeft.trim();
    const footerRight = settings.defaultFooterRight.trim();

    if (!headerLeft && !headerRight && !footerLeft && !footerRight) {
      this.styleEl.textContent = '';
      return;
    }

    const rules: string[] = ['@media print {'];

    if (headerLeft) {
      rules.push(`  .print::before {
    content: "${escapeCssString(headerLeft)}";
    position: fixed;
    top: 6px;
    left: 16px;${HEADER_FOOTER_BASE}
  }`);
    }

    if (headerRight) {
      rules.push(`  .markdown-preview-view::after {
    content: "${escapeCssString(headerRight)}";
    position: fixed;
    top: 6px;
    right: 16px;${HEADER_FOOTER_BASE}
  }`);
    }

    if (footerLeft) {
      rules.push(`  .markdown-preview-sizer::before {
    content: "${escapeCssString(footerLeft)}";
    position: fixed;
    bottom: 6px;
    left: 16px;${HEADER_FOOTER_BASE}
  }`);
    }

    if (footerRight) {
      rules.push(`  .print::after {
    content: "${escapeCssString(footerRight)}";
    position: fixed;
    bottom: 6px;
    right: 16px;${HEADER_FOOTER_BASE}
  }`);
    }

    rules.push('}');
    this.styleEl.textContent = rules.join('\n');
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

    if (!hasCustomFontSize && !isCustomFont && !hasCustomWatermarkText && !hasCustomLineHeight && !hasNonDefaultFont) {
      this.styleEl.textContent = '';
      return;
    }

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

    // Regenerate watermark SVGs when text or font differs from static defaults
    if (hasCustomWatermarkText || hasNonDefaultFont) {
      const text = settings.watermarkText;
      const svgFont = FONT_PRESET_SVG[settings.fontFamily as FontPreset] ?? settings.fontFamily;
      for (const [level, _preset] of Object.entries(WATERMARK_PRESETS)) {
        const uri = buildWatermarkDataUri(level as WatermarkPresetLevel, text, svgFont);
        const size = WATERMARK_PRESETS[level as WatermarkPresetLevel].tileSize;
        rules.push(`  .pdf-watermark-${level} .print > div::before {
    background-image: ${uri};
    background-size: ${size}px ${size}px;
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
