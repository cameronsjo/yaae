import type { CustomClassification } from '../schemas/classification';
import type { DocumentSettings } from './settings';

const STYLE_ID = 'yaae-custom-classification-print-styles';
const HEADER_FOOTER_STYLE_ID = 'yaae-header-footer-print-styles';

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
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 0;
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
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 2px 0;
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
 */
const HEADER_FOOTER_BASE = `
    font-size: 9px;
    color: #888;
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
