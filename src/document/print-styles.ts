import type { CustomClassification } from '../schemas/classification';

const STYLE_ID = 'yaae-custom-classification-print-styles';

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
