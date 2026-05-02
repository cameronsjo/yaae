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

  /** Create the <style> element, run one-shot POS migration, inject rules.
   * Re-init is idempotent: any prior <style> is removed first so a
   * partial-init failure or hot reload cannot leave orphaned elements
   * behind. Returns true when migration ran (caller should persist). */
  init(settings: ProseHighlightSettings): boolean {
    if (this.styleEl) {
      this.destroy();
    }
    this.styleEl = document.createElement('style');
    this.styleEl.id = STYLE_ID;
    document.head.appendChild(this.styleEl);
    const migrated = this.migrateLegacyPOSColors(settings);
    this.update(settings);
    return migrated;
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
   *
   * Latched by `settings.posColorsMigrated` so subsequent reloads do not
   * re-stamp inline styles — that would clobber any Style Settings user
   * overrides since inline body styles outrank stylesheet declarations.
   * Caller is expected to persist the mutated flag via saveSettings().
   *
   * Returns true if migration ran for the first time (i.e. the caller
   * should persist settings); false otherwise.
   */
  private migrateLegacyPOSColors(settings: ProseHighlightSettings): boolean {
    if (settings.posColorsMigrated) return false;

    for (const cat of POS_CATEGORIES) {
      const legacy = settings.categories[cat]?.color;
      if (legacy && legacy !== DEFAULT_POS_COLORS[cat]) {
        document.body.style.setProperty(`--yaae-pos-${cat}-color-light`, legacy);
      }
    }

    settings.posColorsMigrated = true;
    return true;
  }

  /** Remove the <style> element from the DOM */
  destroy(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }
}
