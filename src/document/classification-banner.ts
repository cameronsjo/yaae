import { MarkdownPostProcessorContext } from 'obsidian';
import {
  getClassificationMeta,
  type CustomClassification,
} from '../schemas';
import { sanitizeCssId } from './css-sanitize';
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

    // The class-name fragment must be a safe CSS identifier. Use the
    // resolved `meta.level` (already trimmed inside getClassificationMeta)
    // so the banner class matches the looked-up classification, then
    // sanitize to drop spaces or selector-injection characters.
    const classFragment = sanitizeCssId(meta.level);
    const banner = document.createElement('div');
    banner.className = classFragment
      ? `yaae-classification-banner yaae-${classFragment}`
      : 'yaae-classification-banner';
    banner.textContent = meta.label;

    // Color/background flow through CSS custom properties so styles.css
    // can switch light↔dark via `body.theme-dark .yaae-classification-banner`.
    // Layout is set via setProperty() for each declaration; using
    // `cssText += ...` here clobbers previously-set custom properties in
    // some Chromium builds, leaving the banner unstyled.
    banner.style.setProperty('--yaae-banner-color', meta.color);
    banner.style.setProperty('--yaae-banner-bg', meta.background);
    if (meta.colorDark) banner.style.setProperty('--yaae-banner-color-dark', meta.colorDark);
    if (meta.backgroundDark) banner.style.setProperty('--yaae-banner-bg-dark', meta.backgroundDark);
    banner.style.setProperty('text-align', 'center');
    banner.style.setProperty('font-size', '11px');
    banner.style.setProperty('font-weight', '700');
    banner.style.setProperty('letter-spacing', '0.1em');
    banner.style.setProperty('padding', '3px 8px');
    banner.style.setProperty('margin-bottom', '8px');
    banner.style.setProperty('border-radius', '3px');

    el.insertBefore(banner, el.firstChild);
  };
}
