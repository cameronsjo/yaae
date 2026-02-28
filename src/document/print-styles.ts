import type { CustomClassification } from '../schemas/classification';
import type { DocumentSettings, FontPreset } from './settings';

const STYLE_ID = 'yaae-custom-classification-print-styles';
const HEADER_FOOTER_STYLE_ID = 'yaae-header-footer-print-styles';
const DYNAMIC_PDF_STYLE_ID = 'yaae-dynamic-pdf-print-styles';

const FONT_PRESETS: Set<string> = new Set<string>(['sans', 'serif', 'mono', 'system']);

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

    if (customClassifications.length === 0) {
      this.styleEl.textContent = '';
      return;
    }

    const rules: string[] = ['@media print {'];

    // Shared base styles for top banners
    const topSelectors = customClassifications
      .filter((c) => c.id)
      .map((c) => `.pdf-${c.id} .markdown-preview-view::before`);

    if (topSelectors.length > 0) {
      rules.push(buildBannerRule(topSelectors, 'top'));
    }

    // Shared base styles for bottom banners
    const bottomSelectors = customClassifications
      .filter((c) => c.id)
      .map((c) => `.pdf-${c.id}:not(.pdf-signature-block) .markdown-preview-sizer::after`);

    if (bottomSelectors.length > 0) {
      rules.push(buildBannerRule(bottomSelectors, 'bottom'));
    }

    // Per-classification color rules
    for (const c of customClassifications) {
      if (!c.id) continue;

      // Only double-quotes need escaping — labels come from our settings UI,
      // not arbitrary user input, so backslash escaping is unnecessary
      const escapedLabel = c.label.replace(/"/g, '\\"');

      // Top + bottom shared colors
      rules.push(`  .pdf-${c.id} .markdown-preview-view::before,
  .pdf-${c.id}:not(.pdf-signature-block) .markdown-preview-sizer::after {
    content: "${escapedLabel}";
    color: ${c.color};
    background: ${c.background};
    border-bottom: 2px solid ${c.color};
  }`);

      // Bottom banner: swap border to top
      rules.push(`  .pdf-${c.id}:not(.pdf-signature-block) .markdown-preview-sizer::after {
    border-bottom: none;
    border-top: 2px solid ${c.color};
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

    const {
      defaultHeaderLeft,
      defaultHeaderRight,
      defaultFooterLeft,
      defaultFooterRight,
    } = settings;

    const hasAny = defaultHeaderLeft || defaultHeaderRight || defaultFooterLeft || defaultFooterRight;

    if (!hasAny) {
      this.styleEl.textContent = '';
      return;
    }

    const rules: string[] = ['@media print {'];

    if (defaultHeaderLeft) {
      const escaped = defaultHeaderLeft.replace(/"/g, '\\"');
      rules.push(`  .print::before {
    content: "${escaped}";
    position: fixed;
    top: 6px;
    left: 16px;${HEADER_FOOTER_BASE}
  }`);
    }

    if (defaultHeaderRight) {
      const escaped = defaultHeaderRight.replace(/"/g, '\\"');
      rules.push(`  .markdown-preview-view::after {
    content: "${escaped}";
    position: fixed;
    top: 6px;
    right: 16px;${HEADER_FOOTER_BASE}
  }`);
    }

    if (defaultFooterLeft) {
      const escaped = defaultFooterLeft.replace(/"/g, '\\"');
      rules.push(`  .markdown-preview-sizer::before {
    content: "${escaped}";
    position: fixed;
    bottom: 6px;
    left: 16px;${HEADER_FOOTER_BASE}
  }`);
    }

    if (defaultFooterRight) {
      const escaped = defaultFooterRight.replace(/"/g, '\\"');
      rules.push(`  .print::after {
    content: "${escaped}";
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

/**
 * Build a tiling SVG data URI for the watermark overlay.
 * The text is URL-encoded so special characters (quotes, ampersands) are safe.
 */
export function buildWatermarkDataUri(level: WatermarkPresetLevel, text: string): string {
  const p = WATERMARK_PRESETS[level];
  const half = p.tileSize / 2;
  const encoded = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${p.tileSize}' height='${p.tileSize}'>`
    + `<text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' `
    + `font-family='sans-serif' font-size='${p.fontSize}' font-weight='${p.fontWeight}' `
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

    const hasCustomFontSize = settings.fontSize !== 11;
    const isCustomFont = !FONT_PRESETS.has(settings.fontFamily);
    const hasCustomWatermarkText = settings.watermarkText !== 'DRAFT';
    const hasCustomLineHeight = settings.lineHeight !== undefined && settings.lineHeight !== 1.6;

    if (!hasCustomFontSize && !isCustomFont && !hasCustomWatermarkText && !hasCustomLineHeight) {
      this.styleEl.textContent = '';
      return;
    }

    const rules: string[] = ['@media print {'];

    if (hasCustomFontSize) {
      rules.push(`  .markdown-preview-view {
    font-size: ${settings.fontSize}pt !important;
  }`);
    }

    if (isCustomFont) {
      const escaped = settings.fontFamily.replace(/"/g, '\\"');
      rules.push(`  .markdown-preview-view {
    font-family: ${escaped} !important;
  }`);
    }

    if (hasCustomWatermarkText) {
      const text = settings.watermarkText;
      for (const [level, _preset] of Object.entries(WATERMARK_PRESETS)) {
        const uri = buildWatermarkDataUri(level as WatermarkPresetLevel, text);
        const size = WATERMARK_PRESETS[level as WatermarkPresetLevel].tileSize;
        rules.push(`  .pdf-watermark-${level} .print > div::before {
    background-image: ${uri};
    background-size: ${size}px ${size}px;
  }`);
      }
    }

    if (hasCustomLineHeight) {
      rules.push(`  body {
    --print-line-height: ${settings.lineHeight};
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
