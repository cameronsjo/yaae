import type { CustomClassification } from '../schemas/classification';
import type { DocumentSettings, FontPreset } from './settings';

const STYLE_ID = 'yaae-custom-classification-print-styles';
const HEADER_FOOTER_STYLE_ID = 'yaae-header-footer-print-styles';
const DYNAMIC_PDF_STYLE_ID = 'yaae-dynamic-pdf-print-styles';

const FONT_PRESETS: Set<string> = new Set<string>(['sans', 'serif', 'mono', 'system']);

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
      rules.push(`  ${topSelectors.join(',\n  ')} {
    position: fixed;
    top: 0;
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
  }`);
    }

    // Shared base styles for bottom banners
    const bottomSelectors = customClassifications
      .filter((c) => c.id)
      .map((c) => `.pdf-${c.id} .markdown-preview-sizer::after`);

    if (bottomSelectors.length > 0) {
      rules.push(`  ${bottomSelectors.join(',\n  ')} {
    position: fixed;
    bottom: 0;
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
  }`);
    }

    // Per-classification color rules
    for (const c of customClassifications) {
      if (!c.id) continue;

      const escapedLabel = c.label.replace(/"/g, '\\"');

      // Top + bottom shared colors
      rules.push(`  .pdf-${c.id} .markdown-preview-view::before,
  .pdf-${c.id} .markdown-preview-sizer::after {
    content: "${escapedLabel}";
    color: ${c.color};
    background: ${c.background};
    border-bottom: 2px solid ${c.color};
  }`);

      // Bottom banner: swap border to top
      rules.push(`  .pdf-${c.id} .markdown-preview-sizer::after {
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
 * Dynamic print styles for fontSize and custom (non-preset) font-family.
 * Injects a font-size rule and a raw font-family rule when the user
 * specifies a non-preset string.
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

    if (!hasCustomFontSize && !isCustomFont) {
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
