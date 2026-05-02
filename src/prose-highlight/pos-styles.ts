import type { ProseHighlightSettings } from '../types';
import { POS_CATEGORIES, DEFAULT_POS_COLORS } from '../types';
import { sanitizeListName } from './word-lists';

const STYLE_ID = 'yaae-prose-highlight-styles';

/**
 * Manages a dynamic <style> element for custom word list colors.
 * POS category colors are now defined in styles.css via layered CSS
 * variables (--yaae-pos-*-color-{light,dark}); see Style Settings YAML
 * and theme overrides.
 */
export class POSStyleManager {
  private styleEl: HTMLStyleElement | null = null;

  /** Create the <style> element, run one-shot POS migration, inject rules */
  init(settings: ProseHighlightSettings): void {
    this.styleEl = document.createElement('style');
    this.styleEl.id = STYLE_ID;
    document.head.appendChild(this.styleEl);
    this.migrateLegacyPOSColors(settings);
    this.update(settings);
  }

  /** Regenerate dynamic rules — only custom word lists need <style> injection */
  update(settings: ProseHighlightSettings): void {
    if (!this.styleEl) return;

    const rules: string[] = [];
    for (const list of settings.customWordLists) {
      const cls = sanitizeListName(list.name);
      if (cls) {
        rules.push(`.yaae-list-${cls} { color: ${list.color}; }`);
      }
    }
    this.styleEl.textContent = rules.join('\n');
  }

  /**
   * One-shot migration for users who customized POS colors before the
   * light/dark refactor. Writes legacy single-value colors to the new
   * `-light` variant via body.style so they keep their look. Dark variant
   * gets the new default; user can adjust via Style Settings or theme CSS.
   */
  private migrateLegacyPOSColors(settings: ProseHighlightSettings): void {
    for (const cat of POS_CATEGORIES) {
      const legacy = settings.categories[cat]?.color;
      if (legacy && legacy !== DEFAULT_POS_COLORS[cat]) {
        document.body.style.setProperty(`--yaae-pos-${cat}-color-light`, legacy);
      }
    }
  }

  /** Remove the <style> element from the DOM */
  destroy(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }
}
