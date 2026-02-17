import { MarkdownPostProcessorContext } from 'obsidian';
import {
  CLASSIFICATION_TAXONOMY,
  type ClassificationLevel,
} from '../schemas';

/**
 * MarkdownPostProcessor that injects a classification banner into reading view.
 * Only injects once per document (checks sectionInfo.lineStart === 0).
 */
export function classificationBannerProcessor(
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
): void {
  const info = ctx.getSectionInfo(el);
  if (!info || info.lineStart !== 0) return;

  const metadata = ctx.frontmatter;
  if (!metadata) return;

  const classification = metadata.classification as ClassificationLevel | undefined;
  if (!classification || !(classification in CLASSIFICATION_TAXONOMY)) return;

  const meta = CLASSIFICATION_TAXONOMY[classification];

  const banner = document.createElement('div');
  banner.className = `yaae-classification-banner yaae-${classification}`;
  banner.textContent = meta.label;
  banner.style.cssText = [
    `background: ${meta.background}`,
    `color: ${meta.color}`,
    `border: 1px solid ${meta.color}`,
    'text-align: center',
    'font-size: 11px',
    'font-weight: 700',
    'letter-spacing: 0.1em',
    'padding: 3px 8px',
    'margin-bottom: 8px',
    'border-radius: 3px',
  ].join(';');

  el.insertBefore(banner, el.firstChild);
}
