/**
 * Pure helpers extracted from settings-tab.ts for testability.
 *
 * These functions encapsulate validation and detection logic that drives
 * settings UI behavior, so they can be unit tested without needing to render
 * the actual Obsidian Setting UI.
 */

/**
 * Sanitize a classification ID input into a slug-safe string.
 * Lowercases, replaces whitespace runs with hyphens, strips non `[a-z0-9-]`.
 *
 * Note: This does NOT guarantee a meaningful ID. Use {@link isValidClassificationId}
 * to gate persistence — whitespace-only input sanitizes to a hyphen.
 */
export function sanitizeClassificationId(input: string): string {
  return input.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Whether a sanitized classification ID is acceptable for persistence.
 * Requires at least one alphanumeric character to reject inputs like
 * "   " (which sanitizes to a hyphen) or "!@#" (which sanitizes to "").
 */
export function isValidClassificationId(id: string): boolean {
  return /[a-z0-9]/.test(id);
}

/**
 * Whether a font value is one of the named dropdown presets.
 * Arbitrary strings (e.g. "Inter", "Helvetica Neue") return false and
 * should be displayed via the "Custom" branch of the dropdown UI so a
 * stray click on the dropdown doesn't silently overwrite the stored value.
 */
export function isFontPreset(
  value: string,
): value is 'sans' | 'serif' | 'mono' | 'system' {
  switch (value) {
    case 'sans':
    case 'serif':
    case 'mono':
    case 'system':
      return true;
    default:
      return false;
  }
}

/** Sentinel value used by the font dropdown to surface a custom string. */
export const FONT_CUSTOM_SENTINEL = 'custom';
