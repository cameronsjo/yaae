import type { MarkdownPostProcessorContext } from 'obsidian';
import type { DocumentSettings } from './settings';

/**
 * Defang a URL for use in security/threat intelligence documents.
 *
 * - `https://` → `hxxps://`
 * - `http://` → `hxxp://`
 * - Dots in the domain portion → `[.]`
 * - Path dots are preserved
 */
export function defangUrl(url: string): string {
  // Replace protocol
  let result = url
    .replace(/^https:\/\//i, 'hxxps://')
    .replace(/^http:\/\//i, 'hxxp://');

  // Find where the domain ends (first `/`, `?`, `#`, or `:port` after protocol)
  const protocolEnd = result.indexOf('//');
  if (protocolEnd === -1) return result;

  const domainStart = protocolEnd + 2;
  // Domain ends at first `/`, `?`, or `#` after the protocol
  let domainEnd = result.length;
  for (const char of ['/', '?', '#']) {
    const idx = result.indexOf(char, domainStart);
    if (idx !== -1 && idx < domainEnd) {
      domainEnd = idx;
    }
  }

  const domain = result.slice(domainStart, domainEnd);
  const defangedDomain = domain.replace(/\./g, '[.]');

  return result.slice(0, domainStart) + defangedDomain + result.slice(domainEnd);
}

/**
 * Create a MarkdownPostProcessor that defangs links in reading view.
 * Only activates when `settings.links === 'defanged'`.
 */
export function createDefangedLinksProcessor(
  getSettings: () => DocumentSettings,
) {
  return function defangedLinksProcessor(
    el: HTMLElement,
    _ctx: MarkdownPostProcessorContext,
  ): void {
    const settings = getSettings();
    if (settings.links !== 'defanged') return;

    const anchors = el.querySelectorAll('a');
    for (const anchor of Array.from(anchors)) {
      const href = anchor.getAttribute('href');
      if (!href) continue;

      // Only defang http/https URLs
      if (!/^https?:\/\//i.test(href)) continue;

      const defangedHref = defangUrl(href);

      // Replace visible text if it contains the original URL
      const textContent = anchor.textContent ?? '';
      if (textContent.includes(href)) {
        anchor.textContent = textContent.replace(href, defangedHref);
      }

      // Replace the href so the link is non-functional
      anchor.setAttribute('href', defangedHref);

      // Wrap content in a span to signal non-clickable styling
      const span = document.createElement('span');
      span.className = 'yaae-defanged-link';
      span.textContent = anchor.textContent ?? defangedHref;

      anchor.replaceWith(span);
    }
  };
}
