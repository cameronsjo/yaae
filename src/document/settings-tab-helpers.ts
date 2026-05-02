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
