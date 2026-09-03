import type { ProseHighlightSettings } from "../types";
import { buildUniqueClassSuffixes } from "./word-lists";

const STYLE_ID = "yaae-prose-highlight-styles";

/**
 * Manages a dynamic <style> element for custom word list colors.
 * POS category colors are now defined in styles.css via layered CSS
 * variables (--yaae-pos-*-color-{light,dark}); see Style Settings YAML
 * and theme overrides.
 */
export class POSStyleManager {
  private styleEl: HTMLStyleElement | null = null;

  /** Create the <style> element and inject rules.
   * Re-init is idempotent: any prior <style> is removed first so a
   * partial-init failure or hot reload cannot leave orphaned elements
   * behind. */
  init(settings: ProseHighlightSettings): void {
    if (this.styleEl) {
      this.destroy();
    }
    this.styleEl = document.createElement("style");
    this.styleEl.id = STYLE_ID;
    document.head.appendChild(this.styleEl);
    this.update(settings);
    console.debug("[yaae] POSStyleManager initialized.");
  }

  /** Regenerate dynamic rules — only custom word lists need <style> injection */
  update(settings: ProseHighlightSettings): void {
    if (!this.styleEl) return;

    const rules: string[] = [];

    // Custom word list colors (fully dynamic — no static rules). POS
    // category default colors live in styles.css now (layered light/dark
    // variables); only word lists need <style> injection. Dedup colliding
    // sanitized names so two list names like "My List" and "my-list" each
    // get a distinct class (matches WordListMatcher's behavior).
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
    this.styleEl.textContent = rules.join("\n");
  }

  /** Remove the <style> element from the DOM */
  destroy(): void {
    if (this.styleEl) {
      this.styleEl.remove();
      this.styleEl = null;
    }
  }
}
