# Tasks: ia-writer-readability

## 1. Settings Infrastructure
- [ ] 1.1 Extend `YaaeSettings` in `src/types.ts` with: `syntaxDimming: boolean` (default `true`), `gutteredHeadings: boolean` (default `true`), `focusMode: "off" | "sentence" | "paragraph"` (default `"off"`), `typewriterScroll: boolean` (default `false`)
- [ ] 1.2 Add settings tab in `main.ts` with `PluginSettingTab` — toggles for each feature, dropdown for focus mode
- [ ] 1.3 Verify: settings save/load across Obsidian restart

## 2. CSS: Syntax Dimming
- [ ] 2.1 Add CSS rules to `styles.css` scoped under `body.yaae-syntax-dimming`: target `.cm-formatting` at opacity 0.3, `.cm-active .cm-formatting` at opacity 0.7
- [ ] 2.2 Add body class toggle in `main.ts` `onload()`: `document.body.classList.toggle("yaae-syntax-dimming", this.settings.syntaxDimming)`
- [ ] 2.3 Wire settings change to toggle body class in real-time (no restart required)
- [ ] 2.4 Verify: open a markdown file with bold, italic, headings, links, code, blockquotes, lists — formatting chars should be dimmed; move cursor to a formatted line — chars should brighten

## 3. CSS: Guttered Headings
- [ ] 3.1 Add CSS rules to `styles.css` scoped under `body.yaae-guttered-headings`: padding-left on `.cm-content .cm-line`, negative margin + inline-block + text-align on `.cm-formatting-header`
- [ ] 3.2 Add body class toggle in `main.ts` `onload()`
- [ ] 3.3 Wire settings change to toggle body class in real-time
- [ ] 3.4 Verify: open a document with H1–H6 headings — `#` chars should sit in the left gutter, heading text should align with body text

## 4. CM6: Sentence Detection
- [ ] 4.1 Create `src/cm6/sentence-detection.ts` — pure function `findSentenceBounds(docText: string, cursorOffset: number): { from: number; to: number }` that scans for `.`, `!`, `?` boundaries
- [ ] 4.2 Handle abbreviation list: Dr., Mr., Mrs., Ms., Prof., Sr., Jr., St., vs., etc., i.e., e.g.
- [ ] 4.3 Handle paragraph boundaries (blank lines) — sentence cannot span across blank lines
- [ ] 4.4 Write unit tests in `tests/sentence-detection.test.ts`: simple sentences, abbreviations, multi-line paragraphs, empty lines, single-sentence paragraphs, consecutive punctuation (`"Hello!" she said.`)
- [ ] 4.5 Verify: `npm test` passes

## 5. CM6: Focus Mode ViewPlugin
- [ ] 5.1 Create `src/cm6/focus-mode.ts` — `ViewPlugin.fromClass()` that builds `Decoration.mark({ class: "yaae-dimmed" })` on all text outside the active sentence or paragraph
- [ ] 5.2 Implement paragraph mode: find paragraph bounds (blank line delimiters), dim everything outside
- [ ] 5.3 Implement sentence mode: use `findSentenceBounds()`, dim everything outside the active sentence
- [ ] 5.4 Accept mode parameter (`"sentence" | "paragraph"`) to switch behavior
- [ ] 5.5 Add scroll-pause: register `EditorView.domEventHandlers` for `scroll` event, debounce 150ms, temporarily clear decorations during scroll
- [ ] 5.6 Add CSS for `.yaae-dimmed` in `styles.css`: `color: var(--text-faint)` with 0.15s transition
- [ ] 5.7 Create `Compartment` in `main.ts`, register extension, wire settings changes to `compartment.reconfigure()`
- [ ] 5.8 Verify: enable sentence focus — only cursor sentence should be at full contrast; switch to paragraph focus — entire paragraph should be at full contrast; disable — all text at full contrast

## 6. CM6: Typewriter Scroll ViewPlugin
- [ ] 6.1 Create `src/cm6/typewriter-scroll.ts` — `ViewPlugin.fromClass()` that dispatches `EditorView.scrollIntoView()` with computed `yMargin`
- [ ] 6.2 Add bottom padding to `.cm-sizer` DOM element so end-of-document lines can scroll to center
- [ ] 6.3 Filter by `Transaction.userEvent` — only scroll on `input`, `select`, `delete`, `move` events
- [ ] 6.4 Create `Compartment` in `main.ts`, register extension, wire settings
- [ ] 6.5 Verify: type at end of document — cursor should stay centered; click a distant line — viewport should scroll to center it; ensure no scroll on programmatic edits

## 7. Commands
- [ ] 7.1 Add command "YAAE: Toggle syntax dimming" — toggles setting and body class
- [ ] 7.2 Add command "YAAE: Toggle guttered headings" — toggles setting and body class
- [ ] 7.3 Add command "YAAE: Cycle focus mode" — cycles off → sentence → paragraph → off, reconfigures Compartment
- [ ] 7.4 Add command "YAAE: Toggle typewriter scroll" — toggles setting and Compartment
- [ ] 7.5 Verify: each command works from the command palette and updates settings

## 8. Cleanup on Unload
- [ ] 8.1 In `onunload()`: remove body classes (`yaae-syntax-dimming`, `yaae-guttered-headings`)
- [ ] 8.2 In `onunload()`: remove `.cm-sizer` bottom padding if typewriter scroll was active
- [ ] 8.3 Verify: disable the plugin — editor should return to Obsidian defaults with no residual styling

## 9. Final Verification
- [ ] 9.1 Run `npm run build` — production build succeeds with no errors
- [ ] 9.2 Run `npm test` — all tests pass
- [ ] 9.3 Enable all four features simultaneously — no visual conflicts or performance degradation
- [ ] 9.4 Test with a 1000+ line document — no perceptible lag on cursor movement
- [ ] 9.5 Confirm `manifest.json` has `"isDesktopOnly": false` — no electron imports used
