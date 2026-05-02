import type { ProseHighlightSettings } from '../types';
import { POS_CATEGORIES } from '../types';
import { buildUniqueClassSuffixes } from './word-lists';

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

    // Custom word list colors (fully dynamic — no static rules). Use the
    // same dedup logic as WordListMatcher so collisions (e.g. "My List" and
    // "my-list") get distinct classes here AND in the highlighter, instead
    // of one rule silently overwriting the other.
    const suffixes = buildUniqueClassSuffixes(
      settings.customWordLists.map((l) => l.name),
    );
    for (let i = 0; i < settings.customWordLists.length; i++) {
      const list = settings.customWordLists[i];
      const cls = suffixes[i];
      if (cls) {
        rules.push(`.yaae-list-${cls} { color: ${list.color}; }`);
      }
    }

    this.styleEl.textContent = rules.join('\n');
  }

  /** Remove the <style> element from the DOM */
  destroy(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }
}
