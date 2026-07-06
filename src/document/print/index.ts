/**
 * PrintStyleManager — the one owner of YAAE's print pipeline (#28/#29).
 *
 * Replaces DynamicPdfPrintStyleManager + PageChromeManager with a facade
 * over three <style> elements:
 *
 *   | id                    | content                              | regenerated on            |
 *   |-----------------------|--------------------------------------|---------------------------|
 *   | yaae-print-base       | bundled static CSS, knobs baked      | init, css-change          |
 *   | yaae-print-document   | per-doc state-baked rules            | leaf/frontmatter/settings |
 *   | yaae-print-chrome     | banners/headers/footers/page numbers | same                      |
 *
 * There is no before-print hook in Obsidian's API, so the elements stay
 * continuously correct instead: the host (main.ts) calls refresh() on
 * css-change, active-leaf-change, metadata changes to the active file, and
 * settings edits. Generation is pure functions of PrintDocumentState +
 * resolved PrintVars; this class only owns DOM lifecycle.
 *
 * Body-class sync: the state's pdf-* classes are mirrored onto <body> as an
 * extensibility courtesy (tracked set — user classes are never touched).
 * Correctness never depends on them; document-styles bakes the same rules.
 */

import type { PrintDocumentState } from './state';
import { buildBaseCss } from './base-styles';
import { buildDocumentCss, deriveStateClasses } from './document-styles';
import { buildMarginBoxCss } from './chrome-margin-boxes';
import { buildFixedChromeCss } from './chrome-fixed';
import { resolvePrintVars, type PrintVars } from './vars';
import { detectChromeMajor, supportsMarginBoxes } from './chrome-version';

const BASE_STYLE_ID = 'yaae-print-base';
const DOCUMENT_STYLE_ID = 'yaae-print-document';
const CHROME_STYLE_ID = 'yaae-print-chrome';

export interface PrintStyleHost {
  /** Current render state (settings merged with active-doc overrides). */
  getState(): PrintDocumentState;
  /** Live cascade reader; overridable for tests. */
  readCssVar?(name: string): string;
  /** UA override for tests. */
  userAgent?: string;
}

export class PrintStyleManager {
  private baseEl: HTMLStyleElement | null = null;
  private documentEl: HTMLStyleElement | null = null;
  private chromeEl: HTMLStyleElement | null = null;
  private vars: PrintVars | null = null;
  private trackedBodyClasses: string[] = [];
  readonly chromeMajor: number;

  constructor(private host: PrintStyleHost) {
    this.chromeMajor = detectChromeMajor(
      host.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    );
  }

  get usesMarginBoxes(): boolean {
    return supportsMarginBoxes(this.chromeMajor);
  }

  init(): void {
    // Idempotent re-init: destroy any prior elements first so a partial
    // init failure or hot reload cannot leave orphans in <head>.
    if (this.baseEl || this.documentEl || this.chromeEl) this.destroy();
    this.baseEl = this.createStyleEl(BASE_STYLE_ID);
    this.documentEl = this.createStyleEl(DOCUMENT_STYLE_ID);
    this.chromeEl = this.createStyleEl(CHROME_STYLE_ID);
    this.refreshVars();
    this.refreshDocument();
    console.info(
      `[yaae] PrintStyleManager initialized. Chrome: ${this.chromeMajor}, ` +
        `chrome strategy: ${this.usesMarginBoxes ? '@page margin boxes' : 'position:fixed fallback'}` +
        (this.usesMarginBoxes
          ? ''
          : ' — page numbers are unavailable below Chrome 131'),
    );
  }

  /**
   * Full refresh — re-resolve knobs AND rebuild every element. Kept for
   * callers that don't know which axis changed; init() and css-change go
   * through refreshVars()+refreshDocument() directly.
   */
  refresh(): void {
    this.refreshVars();
    this.refreshDocument();
  }

  /**
   * Re-resolve knob values from the live cascade and rebuild the base
   * element. Base CSS depends ONLY on the knobs, so this runs just on init
   * and css-change — NOT on the per-keystroke settings path, where a
   * ~30-property getComputedStyle scan + re-bake of the whole bundle would
   * be pure waste (the values haven't moved).
   */
  refreshVars(): void {
    if (!this.baseEl) return;
    this.vars = resolvePrintVars(
      this.host.readCssVar ??
        ((name) => getComputedStyle(document.body).getPropertyValue(name)),
    );
    this.baseEl.textContent = buildBaseCss(this.vars);
  }

  /**
   * Rebuild the per-document + chrome elements from current state, reusing
   * the last-resolved knob values. This is the settings/leaf/metadata path —
   * font-size/line-height sliders fire it continuously while dragging, so it
   * stays off the getComputedStyle + base-rebuild cost.
   */
  refreshDocument(): void {
    if (!this.documentEl && !this.chromeEl) return;
    const vars = this.vars ?? resolvePrintVars(
      this.host.readCssVar ??
        ((name) => getComputedStyle(document.body).getPropertyValue(name)),
    );
    const state = this.host.getState();
    if (this.documentEl) {
      this.documentEl.textContent = buildDocumentCss(state, vars, this.usesMarginBoxes);
    }
    if (this.chromeEl) {
      this.chromeEl.textContent = this.usesMarginBoxes
        ? buildMarginBoxCss(state, vars)
        : buildFixedChromeCss(state, vars);
    }
    this.syncBodyClasses(deriveStateClasses(state));
    console.debug(
      `[yaae] Print document refreshed. Classification: ${state.classification}, theme: ${state.theme}`,
    );
  }

  /** Replace OUR tracked pdf-* classes on <body>; user classes untouched. */
  private syncBodyClasses(classes: string[]): void {
    for (const cls of this.trackedBodyClasses) document.body.classList.remove(cls);
    for (const cls of classes) document.body.classList.add(cls);
    this.trackedBodyClasses = classes;
  }

  private createStyleEl(id: string): HTMLStyleElement {
    const el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
    return el;
  }

  destroy(): void {
    this.syncBodyClasses([]);
    for (const el of [this.baseEl, this.documentEl, this.chromeEl]) el?.remove();
    this.baseEl = this.documentEl = this.chromeEl = null;
    console.debug('[yaae] PrintStyleManager destroyed.');
  }
}

export type { PrintDocumentState } from './state';
export { detectChromeMajor, supportsMarginBoxes, MARGIN_BOX_MIN_CHROME } from './chrome-version';
export { PRINT_VAR_DEFAULTS, resolvePrintVars, bakePrintVars, defaultPrintVars } from './vars';
export { buildBaseCss } from './base-styles';
export { buildDocumentCss, deriveStateClasses } from './document-styles';
export { buildMarginBoxCss } from './chrome-margin-boxes';
export { buildFixedChromeCss } from './chrome-fixed';
export { WATERMARK_PRESETS, buildWatermarkDataUri } from './watermark';
