## Why

Obsidian is a powerful writing environment but lacks prose-aware editing aids. Writers currently have no way to visualize the grammatical structure of their text — spotting adjective bloat, passive voice, filler words, or repetitive nouns requires careful manual re-reading. iA Writer proved that applying code-style syntax highlighting to natural language is a powerful editorial tool. YAAE should bring this capability to Obsidian.

## What Changes

- Add a CM6 ViewPlugin that color-codes words by part of speech (adjectives, nouns, adverbs, verbs, conjunctions) in the editor
- Integrate an NLP library (compromise) for POS tagging, running on the main thread with viewport-only processing
- Add a settings UI to toggle highlighting on/off, enable/disable individual parts of speech, and customize colors
- Add a command palette command to toggle prose highlighting
- Inject dynamic CSS for POS colors so theme changes don't require decoration rebuilds
- Skip markdown syntax nodes (code blocks, frontmatter, links, YAML) using CM6's `syntaxTree`

## Capabilities

### New Capabilities
- `pos-highlighting`: Color-code words by part of speech (adjectives, nouns, adverbs, verbs, conjunctions) in the editor using CM6 mark decorations
- `prose-syntax-settings`: Settings tab for toggling highlighting, per-POS enable/disable, and color customization

### Modified Capabilities

(none — this is a greenfield feature)

## Impact

- **Dependencies**: Adds `compromise` (~80 kB gzipped) as a runtime dependency
- **Code**: New source files under `src/` for the CM6 ViewPlugin, NLP integration, settings tab, and CSS injection
- **Entry point**: `main.ts` gains `registerEditorExtension()` and settings tab registration in `onload()`
- **Bundle size**: ~80 kB increase from compromise library
- **Performance**: NLP runs synchronously per visible line; viewport-only processing and line-level caching keep it responsive
- **Platform**: Works on desktop and mobile (`isDesktopOnly` remains `false`)
- **Build**: No esbuild changes needed — `@codemirror/*` already externalized
