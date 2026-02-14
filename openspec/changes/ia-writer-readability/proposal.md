## Why

Obsidian's Live Preview editor hides markdown syntax characters when the cursor leaves a line, causing distracting text reflow ("the jiggle"). Writers lose context about what formatting is applied and can't scan document structure at a glance. There is no built-in way to focus on the current sentence or paragraph while writing, leaving the full document competing for attention equally.

YAAE should bring iA Writer's proven readability patterns to Obsidian: keep syntax visible but subdued, outdent heading markers into a gutter for clean hierarchy, and offer focus modes that dim everything except what you're actively writing. Research is complete (see `docs/readability/`).

## What Changes

- Add CSS-based dimming of markdown formatting characters (`**`, `*`, `#`, `` ` ``, `[]()`, `>`, `-`) so they remain visible but visually recessive
- Add CSS-based outdenting of `#` heading markers into a left gutter, keeping heading text aligned with body text
- Add a CM6 ViewPlugin for sentence-level focus (dim all text except the sentence at the cursor)
- Add a CM6 ViewPlugin for paragraph-level focus (dim all text except the paragraph at the cursor)
- Add a CM6 ViewPlugin for typewriter scrolling (keep cursor vertically centered in viewport)
- Add plugin settings to toggle each feature independently
- Add commands to toggle focus modes from the command palette

## Capabilities

### New Capabilities
- `syntax-dimming`: Reduce visual prominence of markdown formatting characters while keeping them visible
- `guttered-headings`: Outdent `#` heading markers into the left margin for clean document hierarchy
- `focus-mode`: Sentence-level and paragraph-level text dimming to highlight only the active writing context
- `typewriter-scroll`: Keep the cursor at a fixed vertical position by scrolling the document instead of the cursor

### Modified Capabilities
<!-- No existing specs to modify — this is a greenfield plugin -->

## Impact

- **New files**: `src/cm6/` directory with ViewPlugin modules; CSS additions to `styles.css`
- **Modified files**: `main.ts` (register extensions, commands, settings), `src/types.ts` (settings interface)
- **Dependencies**: No new npm dependencies — uses `@codemirror/*` packages already provided by Obsidian at runtime
- **Build**: No changes — `@codemirror/*` already externalized in `esbuild.config.mjs`
- **Testing**: New tests for sentence/paragraph boundary detection logic; CM6 ViewPlugin tests against real CM6 (no Obsidian runtime needed for unit tests)
- **Mobile**: All features must work on Obsidian mobile (no `electron` imports, no desktop-only APIs)
