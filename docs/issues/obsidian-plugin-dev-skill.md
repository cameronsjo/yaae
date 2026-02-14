# Create skill: Obsidian plugin dev — what I wish I knew sooner

> Ready to paste as a GitHub issue at `cameronsjo/yaae`

---

## Context

While researching and planning prose syntax highlighting for YAAE, we accumulated a lot of hard-won knowledge about Obsidian plugin development that isn't obvious from the official docs. This should become a reusable Claude Code skill so future sessions don't have to re-discover it.

## What the skill should cover

### CM6 (Editor / Live Preview)

- **Never bundle your own CM6.** Obsidian overloads `require()` for `@codemirror/*`. If you bundle your own copy, decorations and state fields silently fail. Mark all `@codemirror/*` as `external` in esbuild.
- **ViewPlugin vs StateField:** Use `ViewPlugin` for content-derived decorations (syntax highlighting, POS tagging) because it gives you `view.visibleRanges`. Use `StateField` only when decorations affect vertical layout (block widgets) or are driven by user actions (effects).
- **`view.visibleRanges` is not `view.viewport`.** `visibleRanges` excludes folded ranges inside the viewport — always prefer it.
- **Closure factory pattern** to pass your `Plugin` instance into a `ViewPlugin`. Don't use `window.app.plugins.plugins['your-id']` — it's fragile and untypeable.
- **Mutable array + `workspace.updateOptions()`** is the toggle pattern. Register `this.registerEditorExtension(array)`, then `array.push(ext)` / `array.length = 0` and call `this.app.workspace.updateOptions()`. Expensive — call sparingly.
- **`Decoration.mark()` can do anything CSS can.** Font-family, font-weight, underlines (wavy, dotted), background, opacity, borders, animations, tooltips via `title` attr, custom `data-*` attributes. The `tagName` option lets you use `<strong>`, `<em>`, etc. instead of `<span>`.
- **`hoverTooltip()`** from `@codemirror/view` creates hoverable popups anchored to text ranges.
- **`syntaxTree(state).iterate()`** is the authoritative markdown parse. Use it to identify code blocks, frontmatter, inline code, links — don't reinvent markdown parsing with regex.
- **`syntaxTree` may return incomplete trees** if the parser hasn't finished. Decorations from incomplete trees still work; just re-process on `viewportChanged`.
- **`RangeSetBuilder` must add ranges in ascending order.** If you mix `Decoration.line()` and `Decoration.mark()`, use `Decoration.set(array)` instead.
- **Obsidian state fields**: `editorInfoField` (get `MarkdownView`), `editorLivePreviewField` (boolean). Import from `"obsidian"`.
- **Line-level caching with single-char typing detection** is the proven performance pattern (used by nl-syntax-highlighting). Detect same line count + single char insert → retag one line.
- **`MatchDecorator`** is a built-in CM6 helper for regex-based decorations with automatic incremental updates. Great for simple pattern matching; overkill for NLP.

### Reading View (MarkdownPostProcessor)

- **Reading View is NOT CM6.** It's a standard DOM tree rendered by Obsidian's `MarkdownRenderer`. CM6 extensions do nothing here.
- **`registerMarkdownPostProcessor()`** gives you a raw `HTMLElement` (one per section). You can manipulate it with standard DOM APIs — `TreeWalker`, `createDocumentFragment`, wrapping text nodes in `<span>`s.
- **Sections are virtualized.** Only visible sections are in the DOM. Post-processors run per section as it enters the viewport.
- **Post-processor results are cached.** They only re-run when the source markdown for that section changes.
- **`ctx.getSectionInfo(el)`** gives you line numbers for the section — useful for mapping back to source.
- **`ctx.addChild(new MarkdownRenderChild(el))`** for lifecycle management (cleanup on section removal).
- **`sortOrder`** controls execution order among post-processors. Lower runs first.

### Print / PDF Export

- **PDF export renders Reading View** through Electron's `printToPDF`. Post-processors DO run.
- **No official API event** for detecting export. Two workarounds:
  - CSS: `el.closest('.print')` in post-processor code
  - CSS: `@media print { .yaae-pos-adjective { color: inherit !important; } }`
  - CSS: `.print .yaae-word { /* override */ }`
- **`@media print` in `styles.css`** is the cleanest way to suppress decorations in PDF export.
- **PDF export is forced to light mode** (as of v1.2.7). Dark-mode-only colors won't work.

### General Plugin Dev Patterns

- **`registerEditorExtension()`** auto-loads on all open + future editors, auto-unloads on plugin disable. Don't manage lifecycle manually.
- **`registerEvent()`** for all Obsidian event handlers — auto-cleanup on unload.
- **Type guard `TAbstractFile`** before file operations (`file instanceof TFile`).
- **Dynamic CSS injection** (`document.head.appendChild(styleEl)`) is better than static CSS when colors/styles are user-configurable. Update the style element instead of rebuilding decorations.
- **Bundle size matters.** `compromise` NLP is ~80 kB gzipped. `wink-nlp` + model is ~1 MB. Check what you're bundling with `--metafile` in esbuild.
- **Mobile compatibility:** `isDesktopOnly: false` means no `child_process`, no `fs`, no native modules. Keep heavy features opt-in behind settings.
- **`Compartment`** from `@codemirror/state` enables per-editor reconfiguration without `workspace.updateOptions()` — more surgical but more complex.

## Deliverable

A Claude Code skill (`.claude/skills/obsidian-plugin-dev/`) that provides this knowledge as context when working on Obsidian plugin development tasks. Should be structured so it can be referenced during implementation, not just read linearly.
