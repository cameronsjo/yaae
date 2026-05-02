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

    // Color/background flow through CSS custom properties so styles.css
    // can switch light↔dark via `body.theme-dark .yaae-classification-banner`.
    // Layout is set via inline style for self-containment in reading view.
    banner.style.setProperty('--yaae-banner-color', meta.color);
    banner.style.setProperty('--yaae-banner-bg', meta.background);
    if (meta.colorDark) banner.style.setProperty('--yaae-banner-color-dark', meta.colorDark);
    if (meta.backgroundDark) banner.style.setProperty('--yaae-banner-bg-dark', meta.backgroundDark);
    banner.style.cssText += [
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
