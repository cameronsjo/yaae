/**
 * CSS/SVG sanitization for values interpolated into dynamic style rules.
 *
 * All three print style managers build CSS strings from deserialized settings.
 * The settings UI enforces constraints, but data.json can be tampered directly —
 * these functions validate at the point of CSS interpolation as defense in depth.
 */

/** Escape a string for safe embedding inside CSS `content: "..."` */
export function escapeCssString(value: string): string {
 return value
  .replace(/\\/g, "\\\\")
  .replace(/"/g, '\\"')
  .replace(/\n/g, "\\a ")
  .replace(/\r/g, "");
}

/**
 * Validate a hex color value. Returns the fallback if the value isn't a
 * valid hex color, and logs a warning so a corrupt classification color
 * doesn't silently render as black-on-white (visually indistinguishable
 * from PUBLIC) and mask the misclassification.
 */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export function sanitizeColor(value: string, fallback: string): string {
 if (HEX_COLOR.test(value)) return value;
 console.warn("[yaae] invalid color input rejected:", value);
 return fallback;
}

/** Coerce to number and clamp within a range. Returns fallback for non-finite values. */
export function clampNumber(
 value: unknown,
 min: number,
 max: number,
 fallback: number,
): number {
 const n = Number(value);
 if (!Number.isFinite(n)) return fallback;
 return Math.min(Math.max(n, min), max);
}

/**
 * Quote and escape a font-family string for safe CSS interpolation.
 *
 * `export.pdf.fontFamily` accepts arbitrary strings (Zod union with a bare
 * string), and vaults are shared, so this value is untrusted. A raw newline
 * (or CR/FF) ends the CSS string token, letting the rest of the value break
 * out of the declaration block and inject sibling rules — enough to strip a
 * classification banner from a victim's export. Newlines are escaped to the
 * CSS `\a ` form (as escapeCssString does), and FF/CR dropped, so the value
 * can never terminate the string early.
 */
export function sanitizeFontFamily(value: string): string {
 const escaped = value
  .replace(/\\/g, "\\\\")
  .replace(/"/g, '\\"')
  .replace(/\n/g, "\\a ")
  .replace(/[\r\f]/g, "");
 return `"${escaped}"`;
}

/** Validate a string for use as a CSS class name fragment (e.g., `.pdf-{id}`). */
const SAFE_CSS_ID = /^[a-zA-Z0-9_-]+$/;
export function sanitizeCssId(value: string): string | null {
 return SAFE_CSS_ID.test(value) ? value : null;
}
