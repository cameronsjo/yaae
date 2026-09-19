/**
 * Chrome strategy for Chrome < 131: position:fixed pseudo-elements.
 *
 * @page margin boxes (and counter(page)) don't exist below Chrome 131, so
 * banners, headers, and footers render as fixed pseudo-elements that repeat
 * on every printed page. Slot allocation (pending 3a validation —
 * body::before/::after replace the likely-dead `.print` anchors):
 *
 *   classification top    → body::before        (fixed, top)
 *   classification bottom → body::after         (fixed, bottom)
 *   headers L/R           → .markdown-preview-view::before / ::after
 *   footers L/R           → .markdown-preview-sizer::before / ::after
 *
 * Collisions carried over from the margin-box strategy's semantics:
 *   - signature block owns .markdown-preview-sizer::after (base CSS), so
 *     footer-right is suppressed when a signature block is active;
 *   - the bottom banner is suppressed by a signature block (as before).
 *
 * PAGE NUMBERS DEGRADE TO NOTHING here — counter(page) has no fixed-position
 * equivalent. The degradation is loud: console.info at init and a notice in
 *  the settings tab, both naming the detected Chrome version.
 *
 * @page { margin: 1in } works on every Chrome and reserves space the fixed
 * elements render into.
 */

import { escapeCssString, sanitizeColor } from "../css-sanitize";
import type { PrintDocumentState } from "./state";
import type { PrintVars } from "./vars";
import { resolveBanner, chromeTextBase, bannerTextBase } from "./chrome-shared";

/** Build the yaae-print-chrome CSS for the fixed-position fallback strategy. */
export function buildFixedChromeCss(
  state: PrintDocumentState,
  vars: PrintVars,
): string {
  const headerLeft = state.headerLeft.trim();
  const headerRight = state.headerRight.trim();
  const footerLeft = state.footerLeft.trim();
  const footerRight = state.footerRight.trim();

  const { meta, hasTopBanner, hasBottomBanner } = resolveBanner(state);
  // Signature block owns .markdown-preview-sizer::after in the base CSS.
  const footerRightSlotFree = !state.signatureBlock;

  const rules: string[] = [];
  const chromeText = `\n    position: fixed;${chromeTextBase(vars)}`;

  if (meta) {
    const useDark = state.theme === "dark";
    const color = sanitizeColor(
      useDark ? (meta.colorDark ?? meta.color) : meta.color,
      "#000",
    );
    const bg = sanitizeColor(
      useDark ? (meta.backgroundDark ?? meta.background) : meta.background,
      "#fff",
    );
    const label = escapeCssString(meta.label);
    const bannerBase = `
    position: fixed;
    left: 0;
    right: 0;
    text-align: center;
    padding: ${vars["--yaae-print-banner-padding"]};${bannerTextBase(vars)}`;

    if (hasTopBanner) {
      rules.push(`  body::before {
    content: "${label}";
    top: 0;
    color: ${color};
    background: ${bg};
    border-bottom: 2px solid ${color};${bannerBase}
  }`);
    }
    if (hasBottomBanner) {
      rules.push(`  body::after {
    content: "${label}";
    bottom: 0;
    color: ${color};
    background: ${bg};
    border-top: 2px solid ${color};${bannerBase}
  }`);
    }
  }

  if (headerLeft) {
    rules.push(`  .markdown-preview-view::before {
    content: "${escapeCssString(headerLeft)}";
    top: 0;
    left: 0;${chromeText}
  }`);
  }
  if (headerRight) {
    rules.push(`  .markdown-preview-view::after {
    content: "${escapeCssString(headerRight)}";
    top: 0;
    right: 0;${chromeText}
  }`);
  }
  if (footerLeft) {
    rules.push(`  .markdown-preview-sizer::before {
    content: "${escapeCssString(footerLeft)}";
    bottom: 0;
    left: 0;${chromeText}
  }`);
  }
  if (footerRight && footerRightSlotFree) {
    rules.push(`  .markdown-preview-sizer::after {
    content: "${escapeCssString(footerRight)}";
    bottom: 0;
    right: 0;${chromeText}
  }`);
  }

  // Page margins work on every Chrome; the fixed elements render into them.
  // No counter(page) here — page numbers are unavailable below Chrome 131.
  return `@media print {
  @page {
    margin: 1in !important;
  }
${rules.join("\n")}
}`;
}
