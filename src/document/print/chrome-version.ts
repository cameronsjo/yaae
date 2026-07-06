/**
 * Chrome version detection for the PDF chrome strategy gate (#29).
 *
 * Obsidian's Chrome major is set by the Electron *installer* date, not the
 * app version — observed 120-132 across one user's machines. @page margin
 * boxes (and counter(page)) need 131+; below that the chrome falls back to
 * position:fixed pseudo-elements and page numbers degrade to nothing.
 */

export const MARGIN_BOX_MIN_CHROME = 131;

/** Parse the Chrome major version from a user-agent string. 0 when absent. */
export function detectChromeMajor(userAgent: string): number {
  return parseInt(userAgent.match(/Chrome\/(\d+)/)?.[1] ?? '0', 10);
}

export function supportsMarginBoxes(chromeMajor: number): boolean {
  return chromeMajor >= MARGIN_BOX_MIN_CHROME;
}
