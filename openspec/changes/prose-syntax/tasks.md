## 1. Dependencies & Types

- [ ] 1.1 Install compromise as a runtime dependency (`npm install compromise`)
- [ ] 1.2 Install compromise type definitions (`npm install -D @types/compromise`)
- [ ] 1.3 Extend `YaaeSettings` in `src/types.ts` with prose highlighting settings (master toggle, per-POS toggles, per-POS colors with defaults)

## 2. POSTagger Interface & Compromise Implementation

- [ ] 2.1 Create `src/prose-highlight/tagger.ts` with `POSTag` type and `POSTagger` interface
- [ ] 2.2 Implement `CompromiseTagger` class that wraps compromise's POS tagging and returns `POSTag[]` with character offsets
- [ ] 2.3 Write tests for `CompromiseTagger` — verify correct POS classification and offset calculation for a sample sentence

## 3. Dynamic CSS Injection

- [ ] 3.1 Create `src/prose-highlight/pos-styles.ts` with a `POSStyleManager` class that creates/updates a `<style>` element in `document.head`
- [ ] 3.2 Implement `updateColors(settings)` method that generates CSS rules for `.yaae-pos-adjective`, `.yaae-pos-noun`, `.yaae-pos-adverb`, `.yaae-pos-verb`, `.yaae-pos-conjunction`
- [ ] 3.3 Implement `destroy()` method that removes the `<style>` element on plugin unload

## 4. CM6 ViewPlugin

- [ ] 4.1 Create `src/prose-highlight/highlighter-plugin.ts` with factory function `createHighlighterExtension(plugin)` that returns a `ViewPlugin`
- [ ] 4.2 Implement `buildDecorations(view)` — iterate `view.visibleRanges`, extract prose-only text using `syntaxTree` to skip markdown nodes, run tagger, build `DecorationSet` with `RangeSetBuilder`
- [ ] 4.3 Implement line-level caching in a `Map<number, POSTag[]>` — on `buildDecorations`, check cache before re-tagging a line
- [ ] 4.4 Implement `update(update: ViewUpdate)` — detect single-character inserts (retag one line) vs bulk changes or viewport scroll (rebuild all visible)
- [ ] 4.5 Implement markdown node filtering — use `syntaxTree(state).iterate()` to identify code blocks, frontmatter, inline code, and link URLs, and exclude those ranges from NLP processing
- [ ] 4.6 Read per-POS toggle settings from the plugin instance via closure and skip disabled categories when building decorations

## 5. Settings Tab

- [ ] 5.1 Create `src/prose-highlight/settings-tab.ts` with a section in YAAE's `PluginSettingTab`
- [ ] 5.2 Add master toggle (on/off) that calls the extension toggle logic
- [ ] 5.3 Add per-POS-category toggles (adjectives, nouns, adverbs, verbs, conjunctions)
- [ ] 5.4 Add per-POS-category color pickers with default values from the spec
- [ ] 5.5 Wire settings changes to trigger `POSStyleManager.updateColors()` and `workspace.updateOptions()` as appropriate

## 6. Plugin Integration

- [ ] 6.1 Update `main.ts` — call `createHighlighterExtension(this)` and register via `registerEditorExtension()` with a mutable array
- [ ] 6.2 Instantiate `POSStyleManager` in `onload()` and tear down in `onunload()`
- [ ] 6.3 Register `addSettingTab()` for the prose highlighting settings
- [ ] 6.4 Register `addCommand()` for "Toggle prose highlighting" command palette entry
- [ ] 6.5 Implement the toggle logic — mutate the extensions array and call `this.app.workspace.updateOptions()`

## 7. Testing

- [ ] 7.1 Unit tests for `CompromiseTagger` — POS classification accuracy for representative sentences
- [ ] 7.2 Unit tests for `POSStyleManager` — CSS generation, color updates, cleanup
- [ ] 7.3 Unit tests for settings defaults and persistence (extend existing settings tests if any)
- [ ] 7.4 Verify build passes (`npm run build`) with compromise bundled and CM6 externalized
