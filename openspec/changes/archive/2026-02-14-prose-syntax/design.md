## Context

YAAE is an Obsidian plugin (TypeScript, esbuild, Vitest). The codebase is greenfield — `main.ts` has a bare `Plugin` subclass with settings load/save. Obsidian uses CodeMirror 6 as its editor, and plugins can register CM6 extensions via `registerEditorExtension()`. The plugin's esbuild config already externalizes all `@codemirror/*` packages.

The goal is to add iA Writer-style prose syntax highlighting: color-code words by part of speech in the editor. See `docs/prose-syntax/` for full research.

## Goals / Non-Goals

**Goals:**
- Highlight adjectives, nouns, adverbs, verbs, and conjunctions with distinct colors
- Responsive on keystroke — no perceptible lag while typing
- Work on both desktop and mobile (Obsidian mobile uses the same CM6 editor)
- Skip markdown syntax so only prose content is highlighted
- Provide user-configurable toggles and colors via a settings tab

- Support custom user-defined word lists with per-list colors
- Optional Reading View highlighting via MarkdownPostProcessor
- Suppress all decorations in print/PDF export by default

**Non-Goals:**
- Style Check (filler/cliché/redundancy detection) — future work
- Multi-language NLP support — English only for MVP
- IPC to external NLP process — future opt-in enhancement
- Web Worker offloading — unnecessary for compromise's performance profile
- POS correction overrides — future work (custom word lists cover the named-entity case)

## Decisions

### D1: Use compromise as the NLP library

**Choice:** [compromise](https://github.com/spencermountain/compromise) v14 (rule-based POS tagger)

**Alternatives considered:**
- **wink-nlp** — Higher accuracy (~95% vs compromise's rule-based), but requires a 1 MB model file bundled into `main.js` or loaded async. Overkill for a visual aid where occasional misclassification is acceptable.
- **IPC to Python/spaCy** — Best accuracy (97%+), but requires user to install Python + spaCy. Desktop-only. Too heavy for MVP.
- **en-pos (Brill TBL)** — Unmaintained since 2017. No offset output API.

**Rationale:** compromise is ~80 kB gzipped, zero-config, synchronous, and fast enough (~1ms per paragraph) to run on the main thread per visible line. Its accuracy is "good enough" for a visual writing aid — occasional misclassification (e.g., "open" as noun instead of verb) is acceptable. It works on mobile. The plugin can migrate to a more accurate backend later (D6).

### D2: Use CM6 ViewPlugin (not StateField) for decorations

**Choice:** `ViewPlugin.fromClass()` with `decorations` accessor

**Alternatives considered:**
- **StateField** — Cannot access `view.visibleRanges` for viewport-only processing. Required for block widgets, but we only need mark decorations.

**Rationale:** Mark decorations don't affect vertical layout, so ViewPlugin is sufficient. ViewPlugin gives access to `view.visibleRanges` for the most important performance optimization: only processing visible text.

### D3: Closure factory pattern for ViewPlugin

**Choice:** Factory function that closes over the plugin instance:

```ts
export function createHighlighterExtension(plugin: YaaePlugin) {
  class ProseHighlighter { /* ... uses plugin.settings via closure */ }
  return ViewPlugin.fromClass(ProseHighlighter, { decorations: v => v.decorations });
}
```

**Alternatives considered:**
- **Global window access** (`window.app.plugins.plugins['yaae']`) — Used by nl-syntax-highlighting. Fragile, untypeable, breaks if plugin ID changes.

**Rationale:** Type-safe, testable, no global coupling.

### D4: Line-level caching with single-char typing shortcut

**Choice:** Cache POS results per line number in a `Map<number, Decoration[]>`. On single-character insert, only retag the affected line. On paste/bulk edit or viewport scroll, rebuild all visible lines.

**Alternatives considered:**
- **No caching (rebuild every update)** — Simpler but wasteful. NLP is ~1ms/line, and a viewport of 50 lines means ~50ms per keystroke.
- **Sentence-level caching** — More linguistically correct but harder to implement (sentences span lines).

**Rationale:** Line-level caching matches CM6's line-based document model and the single-char typing detection pattern proven by nl-syntax-highlighting. Keeps per-keystroke cost to ~1ms.

### D5: Use syntaxTree to skip markdown nodes

**Choice:** Use `syntaxTree(view.state).iterate()` to identify markdown syntax nodes (code blocks, frontmatter, inline code, link URLs) and exclude them from NLP processing.

**Alternatives considered:**
- **Regex-based markdown stripping** — Fragile, doesn't handle edge cases (nested code blocks, etc.).
- **Process everything and filter results** — Wastes NLP cycles on non-prose text.

**Rationale:** CM6's syntax tree is the authoritative parse of the markdown document. Using it avoids re-inventing markdown parsing and handles all edge cases Obsidian handles.

### D6: Pluggable tagger interface (future-proof)

**Choice:** Define a `POSTagger` interface from the start:

```ts
interface POSTag {
  text: string;
  pos: "adjective" | "noun" | "adverb" | "verb" | "conjunction" | "other";
  start: number;
  end: number;
}

interface POSTagger {
  tag(text: string): POSTag[];
}
```

The MVP implements `CompromiseTagger`. Future backends (wink-nlp, IPC/spaCy) can implement the same interface.

**Rationale:** Costs nothing to add now. Prevents coupling the ViewPlugin to compromise's API.

### D7: Dynamic CSS injection for colors

**Choice:** Inject a `<style>` element into `document.head` with CSS rules mapping `.yaae-pos-adjective { color: #b97a0a }` etc. Update the style element when colors change in settings.

**Alternatives considered:**
- **Inline styles via decoration attributes** — Requires rebuilding all decorations when a color changes.
- **Static CSS file** — Cannot reflect user-customized colors.

**Rationale:** Changing a color only requires updating one CSS rule, not rebuilding decorations. The decoration CSS classes (`yaae-pos-adjective`, etc.) are stable.

### D8: Mutable array + `updateOptions()` for toggle

**Choice:** Register `this.registerEditorExtension(this.extensions)` with a mutable array. Toggle by pushing/clearing the array and calling `this.app.workspace.updateOptions()`.

**Rationale:** This is Obsidian's documented pattern for dynamically enabling/disabling editor extensions.

### D9: Custom word lists — dictionary matching via generated regex

**Choice:** Store user-defined word lists as `Array<{ name: string; words: string[]; color: string; enabled: boolean; caseSensitive: boolean }>` in settings. At decoration time, compile each enabled list into a single regex with word boundaries (`\b(AWS|Azure|GCP|Cloudflare)\b`) and match against visible text. No NLP needed.

**Alternatives considered:**
- **Run words through compromise and check tags** — Wasteful. Dictionary lookup doesn't need NLP.
- **CM6 `MatchDecorator`** — Built-in CM6 helper for regex-based decorations with automatic incremental updates. Attractive but less flexible: hard to dynamically reconfigure when lists change, and can't share the viewport iteration loop with POS tagging.
- **Trie / Aho-Corasick** — Optimal for very large dictionaries (10K+ words). Premature for typical list sizes (10-200 words).

**Rationale:** Regex is fast for typical list sizes, trivial to implement, and supports multi-word phrases naturally. The regex is regenerated only when lists change in settings (not per keystroke). Custom list matches are checked during the same line iteration as POS tagging — one pass through visible text produces both POS and custom list decorations.

**Precedence:** When a word matches both a POS category and a custom list, the custom list decoration wins. Custom lists are more specific (user explicitly chose to highlight that word). Implemented by checking custom lists first and skipping POS decoration for those character ranges.

### D10: Reading View support via MarkdownPostProcessor

**Choice:** Register a `MarkdownPostProcessor` that uses `TreeWalker(NodeFilter.SHOW_TEXT)` to find text nodes in each rendered section, runs the same tagger + custom list matching, and wraps matched words in `<span class="yaae-pos-*">` or `<span class="yaae-list-*">` elements.

**Alternatives considered:**
- **Editor-only (no Reading View)** — This is what nl-syntax-highlighting does. Works, but users who prefer Reading View get nothing.
- **Render a separate overlay** — Over-engineered for what is just DOM manipulation.

**Rationale:** Reading View is a standard DOM tree. `TreeWalker` + `DocumentFragment` is the standard pattern for wrapping text nodes. Sections are virtualized and cached, so performance is naturally bounded. Gated behind a "Highlight in Reading View" toggle in settings.

**Skipping non-prose nodes:** In the post-processor, skip text nodes inside `<code>`, `<pre>`, `<a>` (href), and `.frontmatter` elements by checking `parentElement.closest()`.

### D11: Print/PDF suppression via CSS

**Choice:** Add `@media print` and `.print` CSS rules to `styles.css` that reset all `yaae-pos-*` and `yaae-list-*` classes to `color: inherit`.

```css
@media print {
  [class*="yaae-pos-"], [class*="yaae-list-"] {
    color: inherit !important;
  }
}
.print [class*="yaae-pos-"], .print [class*="yaae-list-"] {
  color: inherit !important;
}
```

**Rationale:** Pure CSS, zero JS overhead, works for both Obsidian's native PDF export and browser print. No need to detect export programmatically.

## File Structure

```
src/
├── prose-highlight/
│   ├── highlighter-plugin.ts   # CM6 ViewPlugin (POS + custom list decorations, caching)
│   ├── reading-view.ts         # MarkdownPostProcessor for Reading View highlighting
│   ├── tagger.ts               # POSTagger interface + CompromiseTagger implementation
│   ├── word-lists.ts           # Custom word list matching (regex compilation, lookup)
│   ├── pos-styles.ts           # Dynamic CSS injection (POS + custom list colors)
│   └── settings-tab.ts         # SettingTab for all prose highlighting options
├── types.ts                    # Extended YaaeSettings with POS, custom list, reading view settings
styles.css                      # Print/PDF suppression rules (@media print, .print)
main.ts                         # registerEditorExtension, registerMarkdownPostProcessor, etc.
```

## Risks / Trade-offs

**[compromise accuracy]** → Rule-based POS tagging will occasionally misclassify words (e.g., "open" as noun instead of verb). Mitigation: this is a visual aid, not a grammar checker. Misclassification is tolerable. The pluggable tagger interface (D6) allows upgrading later.

**[Bundle size +80 kB]** → compromise adds ~80 kB gzipped to the plugin. Mitigation: still small for an Obsidian plugin. Alternative backends can be loaded on-demand in the future.

**[Main thread NLP]** → Compromise runs synchronously on the main thread. Mitigation: viewport-only processing + line-level caching keeps per-keystroke cost to ~1ms. If profiling reveals issues, we can add debouncing or Web Worker offloading.

**[CM6 API stability]** → Obsidian's CM6 version could change. Mitigation: we use only stable, documented CM6 APIs (`ViewPlugin`, `Decoration.mark`, `RangeSetBuilder`). The esbuild externals ensure we always use Obsidian's CM6 instance.

**[syntaxTree availability]** → `syntaxTree(state)` may return an incomplete tree if the parser hasn't finished. Mitigation: incomplete trees still identify already-parsed nodes; we can re-process on `viewportChanged` when parsing catches up.
