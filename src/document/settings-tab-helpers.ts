/**
 * Pure helpers extracted from settings-tab.ts for testability.
 *
 * These functions encapsulate validation and detection logic that drives
 * settings UI behavior, so they can be unit tested without needing to render
 * the actual Obsidian Setting UI.
 */

/**
 * Sanitize a classification ID input into a slug-safe string.
 * Lowercases, replaces whitespace runs with hyphens, strips non `[a-z0-9-]`,
 * collapses hyphen runs, and trims edge hyphens. The trim matters because
 * leading/trailing whitespace in user paste must not become semantically
 * significant — `' foo '` and `'foo'` resolve to the same ID.
 */
export function sanitizeClassificationId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Whether a sanitized classification ID is acceptable for persistence.
 * Requires at least one alphanumeric character to reject inputs like
 * "   " (which sanitizes to a hyphen) or "!@#" (which sanitizes to "").
 */
export function isValidClassificationId(id: string): boolean {
  return /[a-z0-9]/.test(id);
}

/** Named font dropdown presets. Source of truth — UI dropdown derives from this. */
export const FONT_PRESETS = ['sans', 'serif', 'mono', 'system'] as const;

export type FontPreset = (typeof FONT_PRESETS)[number];

/**
 * Whether a font value is one of the named dropdown presets.
 * Arbitrary strings (e.g. "Inter", "Helvetica Neue") return false and
 * should be displayed via the "Custom" branch of the dropdown UI so a
 * stray click on the dropdown doesn't silently overwrite the stored value.
 */
export function isFontPreset(value: string): value is FontPreset {
  return (FONT_PRESETS as readonly string[]).includes(value);
}

/** Sentinel value used by the font dropdown to surface a custom string. */
export const FONT_CUSTOM_SENTINEL = 'custom';
