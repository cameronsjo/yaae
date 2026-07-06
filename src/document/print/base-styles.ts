/**
 * Base print CSS: the bundled static files with knob values baked in.
 * Regenerated on load and on css-change (Style Settings edits).
 *
 * The class-keyed rules (.pdf-theme-dark, .pdf-links-*, …) ride along as the
 * extensibility layer — they activate when body/view classes reach the print
 * DOM (3a gate). Correctness for the ACTIVE document does not depend on
 * them: document-styles.ts bakes the same behavior from state.
 */

import typography from '../print-css/typography.css?raw';
import appearance from '../print-css/appearance.css?raw';
import code from '../print-css/code.css?raw';
import copySafe from '../print-css/copy-safe.css?raw';
import images from '../print-css/images.css?raw';
import links from '../print-css/links.css?raw';
import pageBreak from '../print-css/page-break.css?raw';
import signatureBlock from '../print-css/signature-block.css?raw';
import tables from '../print-css/tables.css?raw';
import toc from '../print-css/toc.css?raw';

import { bakePrintVars, type PrintVars } from './vars';

/** Bundle order is not load-bearing; keep it alphabetical-ish and stable. */
export const BUNDLED_PRINT_CSS: ReadonlyArray<readonly [string, string]> = [
  ['typography', typography],
  ['appearance', appearance],
  ['code', code],
  ['copy-safe', copySafe],
  ['images', images],
  ['links', links],
  ['page-break', pageBreak],
  ['signature-block', signatureBlock],
  ['tables', tables],
  ['toc', toc],
];

/** Concatenate the bundled files and bake resolved knob values in. */
export function buildBaseCss(vars: PrintVars): string {
  const joined = BUNDLED_PRINT_CSS.map(
    ([name, css]) => `/* --- ${name} --- */\n${css.trim()}`,
  ).join('\n\n');
  return bakePrintVars(joined, vars);
}
