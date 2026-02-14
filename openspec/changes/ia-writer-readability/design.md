## Architecture Decision: CSS-First, CM6-Second

### Context
Four features need to be implemented. Two (syntax dimming, guttered headings) are purely visual styling. Two (focus mode, typewriter scroll) require cursor-aware logic. We need to decide which rendering mechanism to use for each.

### Decision
Use pure CSS for syntax dimming and guttered headings. Use CM6 `ViewPlugin` extensions for focus mode and typewriter scroll.

### Rationale
HyperMD already applies CSS classes to all markdown tokens (`.cm-formatting`, `.cm-formatting-header`, etc.) and lines (`.cm-active`). CSS-only features have zero runtime cost, no JS surface area, and can be toggled by adding/removing a class on `document.body`. CM6 ViewPlugins are reserved for features that need to read cursor position, detect sentence boundaries, or control scroll behavior — things CSS cannot do.

### Alternatives Considered
- **All CM6 ViewPlugins**: Would add unnecessary JS complexity for what CSS handles natively. `Decoration.mark()` for syntax dimming would duplicate what HyperMD classes already provide.
- **All CSS with `:has()` selectors**: Could theoretically use `:has()` to style based on cursor position, but browser support in Electron is inconsistent and the selectors would be fragile.

### Trade-offs
- **Pro**: CSS features work instantly, no initialization delay, no update cycle overhead
- **Pro**: CSS features are theme-compatible by default (use CSS custom properties)
- **Con**: CSS-only toggle requires body class management, not CM6 `Compartment`
- **Con**: CSS cannot handle sentence boundary detection or scroll control

---

## Architecture Decision: Feature Toggle Pattern

### Context
Each feature must be independently toggleable via settings. CSS features and CM6 features have different toggle mechanisms.

### Decision
Use `document.body.classList` toggling for CSS features. Use CM6 `Compartment.reconfigure()` for ViewPlugin features.

### Rationale
CSS features are controlled by scoping rules under a body class (e.g., `body.yaae-syntax-dimming .cm-formatting { ... }`). Toggling the class on/off enables/disables the feature with zero CM6 involvement. ViewPlugin features use `Compartment` because they need to be added to or removed from CM6's extension pipeline — a body class can't prevent a ViewPlugin from running.

### Verification
- Toggling a CSS feature should not trigger a CM6 document update
- Toggling a CM6 feature via Compartment should not cause editor flicker

---

## Architecture Decision: Focus Mode Uses `Decoration.mark()` on Text Ranges

### Context
Focus mode needs to dim text outside the active sentence or paragraph. There are two approaches: dim everything and un-dim the active region, or highlight the active region and dim the rest.

### Decision
Apply `Decoration.mark({ class: "yaae-dimmed" })` to all text ranges outside the active sentence/paragraph. The active text receives no decoration (inherits default styling).

### Rationale
Applying marks to the "inactive" regions and leaving the active region untouched means the active text always looks exactly like normal text — no risk of subtle styling differences. The dimmed class applies `color: var(--text-faint)` which respects the user's theme.

Using `Decoration.mark()` (not `Decoration.line()`) because sentence boundaries can fall mid-line. A sentence that starts mid-line needs the first half of the line dimmed and the second half at full contrast — `Decoration.line()` can only style entire lines.

### Alternatives Considered
- **`Decoration.line()` with `.cm-active` override**: Simpler but only works at line granularity. Paragraph mode could use this, but sentence mode cannot. Using two different decoration strategies for two modes of the same feature adds complexity.
- **CSS `opacity` on `.cm-line`**: The Stille approach. Only works at line level, not sentence level. Also dims backgrounds, borders, and any inline widgets.
- **Color shift on active text instead**: Would require tracking exactly which CSS properties to override per theme, fragile.

### Trade-offs
- **Pro**: Sentence-granular dimming; single strategy for both sentence and paragraph modes
- **Pro**: Active text inherits default theme styling with zero overrides
- **Con**: Must rebuild decorations on every cursor movement (mitigated by viewport scoping)
- **Con**: More decoration objects than the line-based approach

### Verification
- Active sentence text should be visually identical to text with focus mode off
- Decoration rebuild should complete in <5ms for a typical document (< 500 lines in viewport)

---

## Architecture Decision: Sentence Boundary Detection Algorithm

### Context
Sentence focus requires detecting where sentences begin and end. This must handle abbreviations (Dr., Mr., e.g., etc.) and multi-line paragraphs.

### Decision
Scan bidirectionally from the cursor position using `.`, `!`, `?` as delimiters. Maintain a configurable abbreviation list to skip false boundaries. Sentence detection operates on the raw text of the current paragraph (between blank lines), not individual lines.

### Rationale
The Focus Active Sentence plugin and Typewriter Mode plugin both use this approach successfully. Operating on the paragraph level (not single lines) correctly handles sentences that wrap across visual lines. The abbreviation list handles the most common false positives (Dr., Mr., Mrs., Ms., Prof., Sr., Jr., St., vs., etc., i.e., e.g.).

### Alternatives Considered
- **Regex-based splitting**: A single regex like `/(?<=[.!?])\s+/` is simple but cannot handle abbreviations without negative lookbehind for every abbreviation — becomes unmaintainable.
- **NLP library (compromise.js, etc.)**: Accurate but adds a large dependency, overkill for this use case, and would not work on mobile.

### Trade-offs
- **Pro**: Zero dependencies, fast, handles 95%+ of English prose
- **Con**: Abbreviation list is English-centric; non-English writers may see false boundaries
- **Con**: Edge cases like "U.S.A." or ellipsis "..." require special handling

### Verification
- Unit tests for sentence detection covering: simple sentences, abbreviations, multi-line paragraphs, empty lines, single-sentence paragraphs

---

## Architecture Decision: Typewriter Scroll Uses `EditorView.scrollIntoView()`

### Context
Typewriter scroll needs to keep the cursor at a fixed vertical position. Two approaches: dispatch `scrollIntoView` effects, or directly manipulate `scrollDOM.scrollTop`.

### Decision
Use `EditorView.scrollIntoView()` with a `yMargin` computed from viewport height. Add bottom padding to `.cm-sizer` to allow end-of-document scrolling. Filter by `Transaction.userEvent` to only scroll on user input.

### Rationale
`scrollIntoView` is CM6's official scroll control API. It integrates with CM6's scroll coordination and avoids conflicts with other extensions that may also manage scroll position. The `yMargin` parameter directly supports the "scroll to offset" pattern needed for typewriter mode.

### Alternatives Considered
- **Direct `scrollDOM.scrollTop` manipulation**: Works but bypasses CM6's scroll coordination. Can conflict with CM6's own scroll-into-view logic after text changes.
- **CSS `scroll-snap`**: Cannot target cursor position, only element boundaries.

### Trade-offs
- **Pro**: Uses CM6's official API, compatible with other scroll-managing extensions
- **Pro**: `userEvent` filtering prevents scroll jank from programmatic edits
- **Con**: No built-in smooth scrolling — would need `requestAnimationFrame` wrapper if desired

### Verification
- Typing at end of document: cursor should remain at viewport center
- Clicking a distant line: viewport should scroll to center that line
- Plugin-triggered edit: viewport should NOT scroll

---

## File Structure

```
src/
├── cm6/
│   ├── focus-mode.ts           # ViewPlugin: sentence + paragraph dimming
│   ├── typewriter-scroll.ts    # ViewPlugin: cursor-centering scroll
│   └── sentence-detection.ts   # Pure function: find sentence boundaries
├── types.ts                    # Settings interface (extended)
main.ts                         # Plugin entry: register extensions, commands, settings
styles.css                      # CSS: syntax dimming, guttered headings, focus dimming
```

### Why Not Separate CSS Files
Obsidian only auto-loads one `styles.css` from the plugin root. All CSS must go in this single file. Sections are separated by comments.

### Registration Order in `main.ts`

```typescript
// 1. CSS features: toggle body classes
document.body.classList.toggle("yaae-syntax-dimming", this.settings.syntaxDimming);
document.body.classList.toggle("yaae-guttered-headings", this.settings.gutteredHeadings);

// 2. CM6 features: register via Compartment
this.registerEditorExtension([
  focusCompartment.of(this.settings.focusMode !== "off" ? focusExtension(this.settings.focusMode) : []),
  typewriterCompartment.of(this.settings.typewriterScroll ? typewriterExtension() : []),
]);
```
