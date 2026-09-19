/**
 * Style Settings knob resolution + baking (#28, the "knobs don't work" fix).
 *
 * The --yaae-print-* knobs are declared in styles.css :root and overridden by
 * Style Settings. Generated print CSS bakes the RESOLVED values in: var() is
 * illegal inside @page margin boxes, and baking uniformly keeps generation
 * pure and testable. Values are re-resolved on css-change so a knob edit
 * lands in the next render.
 */

/**
 * Knob table — mirrors the styles.css :root defaults. The two placebo
 * page-number position knobs (bottom/right — margin boxes don't position
 * that way) are gone; the two signature-block knobs the CSS consumed but
 * nothing declared are now first-class.
 */
export const PRINT_VAR_DEFAULTS: Record<string, string> = {
 // Code blocks
 "--yaae-print-code-border-color": "#ddd",
 "--yaae-print-code-border-radius": "4px",
 "--yaae-print-code-padding": "0.8em",
 "--yaae-print-code-bg": "#f8f8f8",
 "--yaae-print-code-font-size": "0.9em",
 // Links
 "--yaae-print-link-url-font-size": "0.8em",
 "--yaae-print-link-url-color": "#666",
 // Page numbers
 "--yaae-print-page-number-font-size": "9px",
 "--yaae-print-page-number-color": "#888",
 // Tables
 "--yaae-print-table-font-size": "0.85em",
 "--yaae-print-table-cell-padding": "4px 8px",
 // TOC
 "--yaae-print-toc-indent": "1.5em",
 "--yaae-print-toc-item-margin": "0.3em",
 "--yaae-print-toc-line-height": "1.4",
 // Headers / footers
 "--yaae-print-header-footer-font-size": "9px",
 "--yaae-print-header-footer-color": "#888",
 // Light theme surface
 "--yaae-print-light-bg": "#fff",
 "--yaae-print-light-text": "#000",
 // Dark theme surface
 "--yaae-print-dark-bg": "#1e1e1e",
 "--yaae-print-dark-text": "#d4d4d4",
 "--yaae-print-dark-heading-color": "#e0e0e0",
 "--yaae-print-dark-code-bg": "#2d2d2d",
 "--yaae-print-dark-table-border": "#444",
 // Classification banner
 "--yaae-print-banner-font-size": "10px",
 "--yaae-print-banner-letter-spacing": "0.1em",
 "--yaae-print-banner-padding": "2px 0",
 // Page breaks
 "--yaae-print-widows": "3",
 "--yaae-print-orphans": "3",
 // Signature block (previously consumed by the CSS but never declared)
 "--yaae-print-sig-margin-top": "3em",
 "--yaae-print-sig-font-size": "10pt",
};

export type PrintVars = Record<string, string>;

/**
 * Resolve every knob through the live cascade (Style Settings overrides
 * land on body), falling back to the table default when unset/empty.
 * `readVar` is injectable for tests; production passes a
 * getComputedStyle(document.body) reader.
 */
export function resolvePrintVars(readVar: (name: string) => string): PrintVars {
 const resolved: PrintVars = {};
 for (const [name, fallback] of Object.entries(PRINT_VAR_DEFAULTS)) {
  const value = readVar(name).trim();
  resolved[name] = value || fallback;
 }
 return resolved;
}

/** Resolve straight from the defaults table — the no-DOM path for tests. */
export function defaultPrintVars(): PrintVars {
 return { ...PRINT_VAR_DEFAULTS };
}

/**
 * Replace every `var(--yaae-print-…)` reference (bare or with a fallback,
 * e.g. `var(--x, 3em)`) with its resolved value. Unknown knobs keep their
 * inline fallback, or resolve to `inherit` as a loud-ish failure marker.
 * Limitation: fallbacks containing parentheses (nested functions) aren't
 * used by our CSS and aren't supported.
 */
export function bakePrintVars(css: string, vars: PrintVars): string {
 return css.replace(
  /var\(\s*(--yaae-print-[a-z0-9-]+)\s*(?:,\s*([^()]*))?\)/g,
  (_match, name: string, fallback: string | undefined) =>
   vars[name] ?? fallback?.trim() ?? "inherit",
 );
}
