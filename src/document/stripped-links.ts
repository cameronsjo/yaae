import type { MarkdownPostProcessorContext } from 'obsidian';
import type { DocumentSettings } from './settings';

/**
 * Create a MarkdownPostProcessor that replaces `<a>` elements with
 * plain `<span>` elements when `links` is set to `'stripped'`.
 *
 * CSS alone cannot prevent the PDF renderer from embedding clickable
 * link annotations — the `<a>` elements must be removed from the DOM.
 * This processor runs in reading view, which is what Obsidian uses
 * for PDF export.
 */
export function createStrippedLinksProcessor(
  getSettings: () => DocumentSettings,
) {
  return function strippedLinksProcessor(
    el: HTMLElement,
    _ctx: MarkdownPostProcessorContext,
  ): void {
    const settings = getSettings();
    if (settings.links !== 'stripped') return;

    const anchors = el.querySelectorAll('a');
    for (const anchor of Array.from(anchors)) {
      const span = document.createElement('span');
      // Preserve the text content (and any nested inline elements)
      while (anchor.firstChild) {
        span.appendChild(anchor.firstChild);
      }
      anchor.replaceWith(span);
    }
  };
}
