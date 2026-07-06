/**
 * Per-document print CSS — pure function of PrintDocumentState.
 *
 * Everything here is STATE-BAKED: it renders the active document's
 * appearance without relying on `.pdf-*` classes reaching the print DOM
 * (the classes stay as an extensibility layer in the base element and via
 * body-class sync). Regenerated on active-leaf-change, frontmatter changes
 * to the active file, and settings changes.
 */

import type { PrintDocumentState } from './state';
import { activateStateCss } from './activate';
import { BUNDLED_PRINT_CSS } from './base-styles';
import { bakePrintVars, type PrintVars } from './vars';
import {
  WATERMARK_PRESETS,
  FONT_PRESET_SVG,
  buildWatermarkDataUri,
} from './watermark';
import type { FontPreset } from '../settings';
import { DEFAULT_DOCUMENT_SETTINGS } from '../settings';
import { clampNumber, sanitizeFontFamily } from '../css-sanitize';

const FONT_PRESETS: Set<FontPreset> = new Set<FontPreset>(['sans', 'serif', 'mono', 'system']);

/**
 * Specificity-bumped view target for surface rules: must beat the
 * styles.css light-surface enforcement (`.print .markdown-preview-view *`,
 * 0-2-0/0-2-1) regardless of element order in <head>.
 */
const SURFACE = '.print .markdown-preview-view.markdown-preview-view';

/** The `.pdf-*` classes this state activates (also used for body sync). */
export function deriveStateClasses(state: PrintDocumentState): string[] {
  const classes: string[] = [];
  if (state.theme === 'dark') classes.push('pdf-theme-dark');
  if (state.theme === 'auto') classes.push('pdf-theme-auto');
  if (FONT_PRESETS.has(state.fontFamily as FontPreset)) {
    classes.push(`pdf-font-${state.fontFamily}`);
  }
  if (state.linksMode !== 'expand') classes.push(`pdf-links-${state.linksMode}`);
  if (state.copyPasteSafe) classes.push('pdf-copy-safe');
  if (state.compactTables) classes.push('pdf-compact-tables');
  if (state.signatureBlock) classes.push('pdf-signature-block');
  // Watermark is rendered directly by buildDocumentCss (a single
  // strategy-selected layer), NOT via a body class + courtesy rule — syncing
  // pdf-watermark-* to body would double-paint with that layer. Deliberately
  // omitted here.
  return classes;
}

/**
 * Build the yaae-print-document element's CSS.
 *
 * `usesMarginBoxes` selects the watermark strategy: on Chrome >= 131 a
 * full-page fixed overlay (fixes #25); below that, a content-box background
 * (status quo — a fixed max-z overlay would paint over the position:fixed
 * classification banner/headers of the <131 chrome fallback).
 */
export function buildDocumentCss(
  state: PrintDocumentState,
  vars: PrintVars,
  usesMarginBoxes = true,
): string {
  const sections: string[] = [];

  // 1. State-baked activation of the class-keyed bundled rules (theme
  //    accents, links mode, copy-safe, compact tables, signature block,
  //    font presets) — same source CSS as the base element.
  const active = new Set(deriveStateClasses(state));
  const bundle = BUNDLED_PRINT_CSS.map(([, css]) => css).join('\n');
  const activated = activateStateCss(bundle, active);
  if (activated) sections.push(`/* --- state-activated rules --- */\n${activated}`);

  // 2. Body surface for dark/auto themes. The light default lives in
  //    styles.css; these overrides out-rank its enforcement rules.
  if (state.theme === 'dark') {
    sections.push(`/* --- dark surface --- */
@media print {
  ${SURFACE} {
    background-color: var(--yaae-print-dark-bg) !important;
  }
  ${SURFACE},
  ${SURFACE} * {
    color: var(--yaae-print-dark-text) !important;
  }
}`);
  } else if (state.theme === 'auto') {
    // NESTED media (not `and`-combined): Chromium's print engine silently
    // drops `@media print and (prefers-color-scheme: dark)`.
    sections.push(`/* --- auto surface --- */
@media print {
  @media (prefers-color-scheme: dark) {
    ${SURFACE} {
      background-color: var(--yaae-print-dark-bg) !important;
    }
    ${SURFACE},
    ${SURFACE} * {
      color: var(--yaae-print-dark-text) !important;
    }
  }
}`);
  }

  // 3. Font size / custom family / line-height (previously the dynamic
  //    manager; still emitted only when off-default).
  const fontSize = clampNumber(state.fontSize, 6, 72, DEFAULT_DOCUMENT_SETTINGS.fontSize);
  const lineHeight = clampNumber(state.lineHeight, 1, 3, DEFAULT_DOCUMENT_SETTINGS.lineHeight);
  const typographyRules: string[] = [];
  if (fontSize !== DEFAULT_DOCUMENT_SETTINGS.fontSize) {
    typographyRules.push(`  .markdown-preview-view {
    font-size: ${fontSize}pt !important;
  }`);
  }
  if (!FONT_PRESETS.has(state.fontFamily as FontPreset)) {
    typographyRules.push(`  .markdown-preview-view {
    font-family: ${sanitizeFontFamily(state.fontFamily)} !important;
  }`);
  }
  if (lineHeight !== DEFAULT_DOCUMENT_SETTINGS.lineHeight) {
    typographyRules.push(`  :root {
    --print-line-height: ${lineHeight};
  }`);
  }
  if (typographyRules.length > 0) {
    sections.push(`/* --- typography overrides --- */
@media print {
${typographyRules.join('\n')}
}`);
  }

  // 4. Watermark — a single layer for the active level (never two, or the
  //    opacity ramp doubles). Strategy-gated:
  //    - Chrome >= 131 (margin boxes): a full-page fixed overlay on
  //      html::before. background-image on the content box only tiles to
  //      content height, so a short final page shows a bare bottom (#25);
  //      a position:fixed layer repeats full-page on every page. It's
  //      geometrically clear of the @page margin boxes (which live in the
  //      page *margin*, not the page area).
  //    - Chrome < 131 (position:fixed chrome fallback): the content-box
  //      background (status quo). A max-z fixed overlay would paint over the
  //      fixed banner/header/footer pseudo-elements that strategy uses, so
  //      the #25 tail gap is accepted on old Chrome (which already loses
  //      page numbers there).
  if (state.watermark !== 'off') {
    const svgFont = Object.hasOwn(FONT_PRESET_SVG, state.fontFamily)
      ? FONT_PRESET_SVG[state.fontFamily as FontPreset]
      : state.fontFamily;
    const uri = buildWatermarkDataUri(state.watermark, state.watermarkText, svgFont);
    const size = WATERMARK_PRESETS[state.watermark].tileSize;
    const tile = `background-image: ${uri};
    background-repeat: repeat;
    background-size: ${size}px ${size}px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;`;

    if (usesMarginBoxes) {
      sections.push(`/* --- watermark (full-page overlay, #25) --- */
@media print {
  html::before {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 2147483000;
    pointer-events: none;
    ${tile}
  }
}`);
    } else {
      sections.push(`/* --- watermark (content-box, Chrome < 131) --- */
@media print {
  ${SURFACE} {
    ${tile}
  }
}`);
    }
  }

  return bakePrintVars(sections.join('\n\n'), vars);
}
