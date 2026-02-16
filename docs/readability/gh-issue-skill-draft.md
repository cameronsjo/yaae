# GitHub Issue: Create an "Obsidian Plugin Development" Skill

**Title:** `Create skill: Obsidian CM6 plugin development knowledge base`

---

## Summary

Build a reusable skill (dogfooded via OpenSpec or Claude Code) that encodes hard-won Obsidian plugin development knowledge so AI coding assistants stop making the same mistakes we did.

## Problem

Every time an AI assistant (or a new contributor) works on an Obsidian plugin, they hit the same walls:

1. **Bundler externals** — They bundle their own `@codemirror/*` copies, class identity breaks, decorations silently don't render. No errors. Hours wasted.
2. **Reinventing HyperMD** — They write ViewPlugins to classify markdown tokens that HyperMD already applies CSS classes to (`.cm-formatting-strong`, `.cm-formatting-header`, etc.).
3. **Wrong decoration type** — They use `Decoration.mark()` for line-level effects instead of `Decoration.line()`, or try `Decoration.widget()` when a `gutter()` marker is the right tool.
4. **Missing the `decorations` accessor** — They write a `ViewPlugin.fromClass()` with a `decorations` property but forget the second arg `{ decorations: (v) => v.decorations }`, so CM6 never reads it. Zero errors, zero output.
5. **Fighting Live Preview** — They dim formatting characters with CSS, but Live Preview folds them away when the cursor leaves. The interaction between their CSS and Obsidian's fold behavior is undocumented.
6. **Leaking event listeners** — They use raw `workspace.on()` instead of `registerEvent()`, or raw `addEventListener` instead of the plugin lifecycle.
7. **Testing blind spots** — They don't know `obsidian` must be mocked as a module alias, that CM6 itself works in Node, or that `editorEditorField` / `editorViewField` are Obsidian-injected StateFields that need stubs.

## Proposed Skill

A structured knowledge base the AI assistant can reference when working on Obsidian plugins. It should cover:

### Tier 1 — Build & Project Setup
- [ ] Externalization rules: which packages must be `external` and why
- [ ] `manifest.json` schema and `versions.json` mapping
- [ ] Entry point convention (`main.ts` → `main.js`)
- [ ] `styles.css` auto-loading behavior
- [ ] Dev workflow: esbuild watch + Hot Reload plugin
- [ ] Testing setup: Vitest + `obsidian` module mock + browser globals

### Tier 2 — Obsidian API Patterns
- [ ] `registerEditorExtension()` for CM6 extensions (auto-cleanup)
- [ ] `registerEvent()` for workspace/vault events (auto-cleanup)
- [ ] `addCommand()` for command palette entries
- [ ] `loadData()` / `saveData()` for persistent settings
- [ ] `PluginSettingTab` for the settings UI
- [ ] `TAbstractFile` type guards before file operations
- [ ] `MarkdownView` vs `EditorView` — when to use which

### Tier 3 — CodeMirror 6 Inside Obsidian
- [ ] HyperMD CSS class reference (full table of `.cm-formatting-*`, `.cm-header-*`, `.HyperMD-*`, etc.)
- [ ] `ViewPlugin.fromClass()` boilerplate with the `decorations` accessor gotcha
- [ ] `Decoration.mark()` vs `.line()` vs `.widget()` — decision tree
- [ ] `syntaxTree().iterate()` — how to read markdown structure, always scope to viewport
- [ ] `gutter()` + `GutterMarker` for gutter-column content
- [ ] `Compartment` for runtime feature toggling
- [ ] `EditorView.scrollIntoView()` for scroll control
- [ ] `RangeSetBuilder` usage pattern
- [ ] Live Preview fold interaction — how it hides formatting chars and how to work with/around it
- [ ] `editorEditorField` / `editorViewField` — Obsidian's injected StateFields

### Tier 4 — Reference Implementations
- [ ] Link to Lapel (gutter API)
- [ ] Link to Typewriter Mode (scroll + sentence focus)
- [ ] Link to Focus Active Sentence (Decoration.mark sentence detection)
- [ ] Link to Stille (simplest CSS-only focus)
- [ ] Link to cm6-attributes (syntax tree parsing reference)
- [ ] Link to Ghost Fade Focus (proximity gradient dimming)

## Acceptance Criteria

- [ ] AI assistant correctly externalizes `@codemirror/*` on first attempt when scaffolding a new plugin
- [ ] AI assistant checks HyperMD classes before writing a ViewPlugin to classify tokens
- [ ] AI assistant uses the correct `Decoration` type for the effect requested
- [ ] AI assistant includes the `decorations` accessor in `ViewPlugin.fromClass()` calls
- [ ] AI assistant uses `registerEvent()` / `registerEditorExtension()` instead of raw listeners
- [ ] AI assistant can set up a working Vitest config with obsidian mocks without trial and error

## Source Material

All research is committed at `docs/readability/`:
- [`ia-writer-reference.md`](docs/readability/ia-writer-reference.md) — iA Writer design patterns
- [`obsidian-implementation.md`](docs/readability/obsidian-implementation.md) — CM6 implementation research
- [`obsidian-plugin-dev-lessons.md`](docs/readability/obsidian-plugin-dev-lessons.md) — 15 lessons learned

## Labels

`enhancement`, `documentation`, `good first issue`, `skill`
