## 1. Dependencies & Types

- [x] 1.1 Install compromise as a runtime dependency (`npm install compromise`)
- [x] 1.2 Install compromise type definitions (`npm install -D @types/compromise`)
- [x] 1.3 Extend `YaaeSettings` in `src/types.ts` with prose highlighting settings: master toggle, per-POS toggles, per-POS colors (with defaults), Reading View toggle, and custom word lists array

## 2. POSTagger Interface & Compromise Implementation

- [x] 2.1 Create `src/prose-highlight/tagger.ts` with `POSTag` type and `POSTagger` interface
- [x] 2.2 Implement `CompromiseTagger` class that wraps compromise's POS tagging and returns `POSTag[]` with character offsets
- [x] 2.3 Write tests for `CompromiseTagger` — verify correct POS classification and offset calculation for a sample sentence

## 3. Custom Word Lists

- [x] 3.1 Create `src/prose-highlight/word-lists.ts` with `WordListMatcher` class
- [x] 3.2 Implement `compile(lists)` — generate a regex per enabled list from its word array, with word boundary anchors and case-sensitivity flag
- [x] 3.3 Implement `match(text): WordListMatch[]` — run compiled regexes against a line of text, return matches with `{ text, listName, start, end }`
- [x] 3.4 Handle multi-word phrase matching (phrases with spaces)
- [x] 3.5 Write tests for `WordListMatcher` — single words, multi-word phrases, case sensitivity, overlapping lists

## 4. Dynamic CSS Injection

- [x] 4.1 Create `src/prose-highlight/pos-styles.ts` with a `POSStyleManager` class that creates/updates a `<style>` element in `document.head`
- [x] 4.2 Implement `updateColors(settings)` method that generates CSS rules for `.yaae-pos-adjective`, `.yaae-pos-noun`, `.yaae-pos-adverb`, `.yaae-pos-verb`, `.yaae-pos-conjunction`
- [x] 4.3 Implement `updateListColors(lists)` method that generates CSS rules for `.yaae-list-<sanitized-name>` per custom word list
- [x] 4.4 Implement `destroy()` method that removes the `<style>` element on plugin unload

## 5. CM6 ViewPlugin (Editor / Live Preview)

- [x] 5.1 Create `src/prose-highlight/highlighter-plugin.ts` with factory function `createHighlighterExtension(plugin)` that returns a `ViewPlugin`
- [x] 5.2 Implement `buildDecorations(view)` — iterate `view.visibleRanges`, extract prose-only text using `syntaxTree` to skip markdown nodes, run tagger + word list matcher, build `DecorationSet` with `RangeSetBuilder`
- [x] 5.3 Implement line-level caching in a `Map<number, POSTag[]>` — on `buildDecorations`, check cache before re-tagging a line
- [x] 5.4 Implement `update(update: ViewUpdate)` — detect single-character inserts (retag one line) vs bulk changes or viewport scroll (rebuild all visible)
- [x] 5.5 Implement markdown node filtering — use `syntaxTree(state).iterate()` to identify code blocks, frontmatter, inline code, and link URLs, and exclude those ranges from NLP processing
- [x] 5.6 Read per-POS toggle settings from the plugin instance via closure and skip disabled categories when building decorations
- [x] 5.7 Apply custom word list decorations — check custom lists first, skip POS decoration for overlapping ranges (custom list wins)

## 6. Reading View Post-Processor

- [x] 6.1 Create `src/prose-highlight/reading-view.ts` with a function that returns a `MarkdownPostProcessor`
- [x] 6.2 Implement text node walking via `TreeWalker(NodeFilter.SHOW_TEXT)` — collect text nodes, skip nodes inside `<code>`, `<pre>`, and `.frontmatter` elements
- [x] 6.3 For each text node, run tagger + word list matcher, then replace with a `DocumentFragment` of `<span>` wrapped words
- [x] 6.4 Gate the post-processor behind the "Highlight in Reading View" setting — when disabled, the post-processor returns early

## 7. Print / PDF Suppression

- [x] 7.1 Add `@media print` rules to `styles.css` that reset all `yaae-pos-*` and `yaae-list-*` classes to `color: inherit`
- [x] 7.2 Add `.print [class*="yaae-"]` rules to `styles.css` for Obsidian's export container

## 8. Settings Tab

- [x] 8.1 Create `src/prose-highlight/settings-tab.ts` with a section in YAAE's `PluginSettingTab`
- [x] 8.2 Add master toggle (on/off) that calls the extension toggle logic
- [x] 8.3 Add per-POS-category toggles (adjectives, nouns, adverbs, verbs, conjunctions)
- [x] 8.4 Add per-POS-category color pickers with default values from the spec
- [x] 8.5 Add "Highlight in Reading View" toggle
- [x] 8.6 Add custom word lists management UI — add/remove lists, edit name, edit words (comma or newline separated), color picker, case-sensitivity toggle, enable/disable per list
- [x] 8.7 Wire settings changes to trigger `POSStyleManager.updateColors()`, `WordListMatcher.compile()`, and `workspace.updateOptions()` as appropriate

## 9. Plugin Integration

- [x] 9.1 Update `main.ts` — call `createHighlighterExtension(this)` and register via `registerEditorExtension()` with a mutable array
- [x] 9.2 Register the Reading View post-processor via `registerMarkdownPostProcessor()`
- [x] 9.3 Instantiate `POSStyleManager` in `onload()` and tear down in `onunload()`
- [x] 9.4 Register `addSettingTab()` for the prose highlighting settings
- [x] 9.5 Register `addCommand()` for "Toggle prose highlighting" command palette entry
- [x] 9.6 Implement the toggle logic — mutate the extensions array and call `this.app.workspace.updateOptions()`

## 10. Testing

- [x] 10.1 Unit tests for `CompromiseTagger` — POS classification accuracy for representative sentences
- [x] 10.2 Unit tests for `WordListMatcher` — single words, multi-word phrases, case sensitivity, overlapping lists, regex special character escaping
- [x] 10.3 Unit tests for `POSStyleManager` — CSS generation for POS colors, custom list colors, cleanup
- [x] 10.4 Unit tests for settings defaults and persistence (extend existing settings tests if any)
- [x] 10.5 Verify build passes (`npm run build`) with compromise bundled and CM6 externalized
