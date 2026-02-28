import { MarkdownPostProcessorContext } from 'obsidian';
import {
  getClassificationMeta,
  type CustomClassification,
} from '../schemas';
import type { DocumentSettings } from './settings';

/**
 * Create a MarkdownPostProcessor that injects a classification banner
 * into reading view. Reads the `showClassificationBanner` setting at
 * runtime so toggling takes effect without a reload.
 */
export function createClassificationBannerProcessor(
  getSettings: () => DocumentSettings,
) {
  return function classificationBannerProcessor(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): void {
    const settings = getSettings();
    if (!settings.showClassificationBanner) return;

    const info = ctx.getSectionInfo(el);
    if (!info || info.lineStart !== 0) return;

    const metadata = ctx.frontmatter;
    if (!metadata) return;

    const classification = metadata.classification as string | undefined;
    if (!classification) return;

    const meta = getClassificationMeta(classification, settings.customClassifications);
    if (!meta) return;

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
  };
}
