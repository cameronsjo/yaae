/**
 * State-baked activation of class-keyed print rules.
 *
 * The bundled CSS keys behavior on `.pdf-*` classes (theme, links mode,
 * copy-safe, compact tables, signature block, font presets). Whether those
 * classes reach the print DOM is unproven (3a gate) — so for the ACTIVE
 * document we rewrite the matching rules into class-free selectors and
 * inject them directly. One source of truth: the same bundled CSS drives
 * both the class-keyed extensibility layer and the state-baked rules.
 *
 * Rewrite rule: every `.pdf-<active>` token is replaced with
 * `.print .markdown-preview-view` — the export view element (the cssclasses
 * carrier), matching the styles.css body-theming idiom. Descendant forms
 * (`.pdf-links-plain a`) become `.print .markdown-preview-view a`;
 * standalone forms target the view itself. Rules keyed on an INACTIVE
 * `.pdf-*` class are dropped; rules with no `.pdf-*` key are skipped
 * entirely (they're already live in the base element).
 *
 * The parser handles exactly the shapes our bundled CSS uses: one level of
 * nested at-rules (`@media print { @media (prefers-color-scheme: dark) {…} }`)
 * and flat `selector { declarations }` rules. It is not a general CSS parser.
 */

const VIEW_TARGET = ".print .markdown-preview-view";

interface CssRule {
  selector: string;
  body: string;
  /** Enclosing at-rule preludes, outermost first (e.g. ['@media print']). */
  wrappers: string[];
}

/** Flatten css text into rules with their at-rule wrapper chain. */
export function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  walk(stripComments(css), [], rules);
  return rules;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function walk(css: string, wrappers: string[], out: CssRule[]): void {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    const close = matchBrace(css, open);
    const body = css.slice(open + 1, close);
    if (prelude.startsWith("@")) {
      walk(body, [...wrappers, prelude], out);
    } else if (prelude) {
      out.push({ selector: prelude, body: body.trim(), wrappers });
    }
    i = close + 1;
  }
}

/** Index of the brace matching css[open]. */
function matchBrace(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return i;
  }
  return css.length;
}

const PDF_CLASS_TOKEN = /\.pdf-[a-z0-9-]+/g;

/**
 * Rewrite class-keyed rules for the given active classes into class-free,
 * view-targeted rules. Returns CSS ready to inject (wrapped in its original
 * at-rules).
 */
export function activateStateCss(
  css: string,
  activeClasses: Set<string>,
): string {
  const activated: string[] = [];

  for (const rule of parseRules(css)) {
    // Only activate print-scoped rules. Bundled CSS also carries an
    // `@media screen` antidote (signature-block.css hides its print
    // pseudo-element in the live view); re-emitting that into the
    // permanently-mounted print-document element would leak a screen rule.
    if (!rule.wrappers.some((w) => /@media\b[^{]*\bprint\b/.test(w))) continue;

    const selectors = rule.selector.split(",").map((s) => s.trim());
    const rewritten: string[] = [];

    for (const sel of selectors) {
      const tokens = sel.match(PDF_CLASS_TOKEN);
      if (!tokens) continue; // classless — already live in the base element
      const allActive = tokens.every((t) => activeClasses.has(t.slice(1)));
      if (!allActive) continue; // keyed on an inactive state — drop
      const replaced = sel.replace(PDF_CLASS_TOKEN, VIEW_TARGET).trim();
      rewritten.push(collapseTarget(replaced));
    }

    if (rewritten.length > 0) {
      activated.push(
        wrap(rule.wrappers, `${rewritten.join(",\n")} {\n  ${rule.body}\n}`),
      );
    }
  }

  return activated.join("\n");
}

/**
 * A compound like `.markdown-preview-view.pdf-x` would rewrite to
 * `.markdown-preview-view.print .markdown-preview-view` — collapse the
 * doubled target back to one. Our bundled CSS has no compound forms today;
 * this keeps the transform safe if one appears.
 */
function collapseTarget(selector: string): string {
  return selector.replace(
    /\.markdown-preview-view\.print \.markdown-preview-view/g,
    VIEW_TARGET,
  );
}

function wrap(wrappers: string[], rule: string): string {
  return wrappers.reduceRight(
    (inner, prelude) => `${prelude} {\n${inner}\n}`,
    rule,
  );
}
