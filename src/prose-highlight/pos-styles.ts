import type { ProseHighlightSettings, CustomWordList } from '../types';
import { POS_CATEGORIES } from '../types';
import { sanitizeListName } from './word-lists';

const STYLE_ID = 'yaae-prose-highlight-styles';

/**
 * Manages a dynamic <style> element for POS and custom word list colors.
 * Updating colors only changes CSS rules — no decoration rebuilds needed.
 */
export class POSStyleManager {
  private styleEl: HTMLStyleElement | null = null;

  /** Create the <style> element and inject initial rules */
  init(settings: ProseHighlightSettings): void {
    this.styleEl = document.createElement('style');
    this.styleEl.id = STYLE_ID;
    document.head.appendChild(this.styleEl);
    this.update(settings);
  }

  /** Regenerate all CSS rules from current settings */
  update(settings: ProseHighlightSettings): void {
    if (!this.styleEl) return;

    const rules: string[] = [];

    // POS category colors — set CSS custom properties so the static
    // class rules in styles.css (`.yaae-pos-adjective { color: var(--…) }`)
    // pick up user overrides from the plugin settings UI.
    const varDecls: string[] = [];
    for (const cat of POS_CATEGORIES) {
      const catSettings = settings.categories[cat];
      varDecls.push(`--yaae-pos-${cat}-color: ${catSettings.color};`);
    }
    rules.push(`body { ${varDecls.join(' ')} }`);

    // Custom word list colors (fully dynamic — no static rules)
    for (const list of settings.customWordLists) {
      const cls = sanitizeListName(list.name);
      if (cls) {
        rules.push(`.yaae-list-${cls} { color: ${list.color}; }`);
      }
    }

    this.styleEl.textContent = rules.join('\n');
  }

  /** Convenience: update only POS colors */
  updateColors(settings: ProseHighlightSettings): void {
    this.update(settings);
  }

  /** Convenience: update only custom list colors */
  updateListColors(lists: CustomWordList[]): void {
    // Full update is cheap — just regenerate all rules
    // Caller should pass the full settings, but we accept lists for the interface
    if (!this.styleEl) return;

    // We need the full settings to generate POS rules too.
    // This method appends list rules. For simplicity, callers should use update().
    const existingRules = this.styleEl.textContent || '';
    const listRules: string[] = [];
    for (const list of lists) {
      const cls = sanitizeListName(list.name);
      if (cls) {
        listRules.push(`.yaae-list-${cls} { color: ${list.color}; }`);
      }
    }

    // Replace list rules section — keep the body{} variable block, swap list rules
    this.styleEl.textContent = existingRules
      .split('\n')
      .filter((line) => !line.startsWith('.yaae-list-'))
      .concat(listRules)
      .join('\n');
  }

  /** Remove the <style> element from the DOM */
  destroy(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }
}
