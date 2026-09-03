/**
 * Chrome strategy for Chrome >= 131: native @page margin boxes.
 *
 * Margin box allocation:
 *   @top-left:      Header left
 *   @top-center:    Classification banner
 *   @top-right:     Header right
 *   @bottom-left:   Footer left
 *   @bottom-center: Classification banner (unless signature block)
 *   @bottom-right:  Page numbers + footer right
 *
 * var() is illegal inside @page margin boxes, so every knob value is baked
 * from the resolved PrintVars (previously hardcoded 10px/#888 — themes and
 * Style Settings can now retint the chrome).
 */

import { escapeCssString, sanitizeColor } from "../css-sanitize";
import type { PrintDocumentState } from "./state";
import type { PrintVars } from "./vars";
import { resolveBanner, chromeTextBase, bannerTextBase } from "./chrome-shared";

/** Build the yaae-print-chrome CSS for the margin-box strategy. */
export function buildMarginBoxCss(
  state: PrintDocumentState,
  vars: PrintVars,
): string {
  const headerLeft = state.headerLeft.trim();
  const headerRight = state.headerRight.trim();
  const footerLeft = state.footerLeft.trim();
  const footerRight = state.footerRight.trim();

  // Always resolve classification for PDF @page margin boxes.
  // showClassificationBanner only controls the reading view banner.
  const { meta, hasTopBanner, hasBottomBanner } = resolveBanner(state);
  const hasAny =
    hasTopBanner ||
    hasBottomBanner ||
    headerLeft ||
    headerRight ||
    footerLeft ||
    footerRight ||
    state.pageNumbers;

  if (!hasAny) return "";

  const BANNER_BASE = bannerTextBase(vars);
  const CHROME_TEXT_BASE = chromeTextBase(vars);
  const marginBoxes: string[] = [];

  // --- Classification banners ---
  // For 'dark' theme use colorDark/backgroundDark (light fallback); for
  // 'auto' emit light here and a nested @media override below.
  const useDarkBase = state.theme === "dark";
  if (meta) {
    const label = escapeCssString(meta.label);
    const baseColor = useDarkBase ? (meta.colorDark ?? meta.color) : meta.color;
    const baseBg = useDarkBase
      ? (meta.backgroundDark ?? meta.background)
      : meta.background;
    const color = sanitizeColor(baseColor, "#000");
    const bg = sanitizeColor(baseBg, "#fff");

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
  const pageNumberBase = `
    font-size: ${vars["--yaae-print-page-number-font-size"]};
    color: ${vars["--yaae-print-page-number-color"]};
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;`;
  const pageCounterExpr = '"Page " counter(page) " of " counter(pages)';
  if (state.pageNumbers && footerRight) {
    marginBoxes.push(`    @bottom-right {
      content: "${escapeCssString(footerRight)}  \\B7  " ${pageCounterExpr};${pageNumberBase}
    }`);
  } else if (state.pageNumbers) {
    marginBoxes.push(`    @bottom-right {
      content: ${pageCounterExpr};${pageNumberBase}
    }`);
  } else if (footerRight) {
    marginBoxes.push(`    @bottom-right {
      content: "${escapeCssString(footerRight)}";${CHROME_TEXT_BASE}
    }`);
  }

  // 'auto' theme — nested (not `and`-combined) prefers-color-scheme media:
  // the combined form is silently ignored by Chromium's print engine.
  // Always emitted for 'auto' even without explicit dark colors (light
  // fallback) so 'auto' never silently degrades for custom classifications.
  let autoOverride = "";
  if (state.theme === "auto" && meta) {
    const altColor = sanitizeColor(meta.colorDark ?? meta.color, "#000");
    const altBg = sanitizeColor(meta.backgroundDark ?? meta.background, "#fff");
    const altLabel = escapeCssString(meta.label);
    const altBoxes: string[] = [];
    if (hasTopBanner) {
      altBoxes.push(`      @top-center {
        content: "${altLabel}";
        color: ${altColor};
        background: ${altBg};
        border-bottom: 2px solid ${altColor};${BANNER_BASE}
      }`);
    }
    if (hasBottomBanner) {
      altBoxes.push(`      @bottom-center {
        content: "${altLabel}";
        color: ${altColor};
        background: ${altBg};
        border-top: 2px solid ${altColor};${BANNER_BASE}
      }`);
    }
    if (altBoxes.length > 0) {
      autoOverride = `
  @media (prefers-color-scheme: dark) {
    @page {
${altBoxes.join("\n")}
    }
  }`;
    }
  }

  return `@media print {
  @page {
    margin: 1in !important;
${marginBoxes.join("\n")}
  }${autoOverride}
}`;
}
