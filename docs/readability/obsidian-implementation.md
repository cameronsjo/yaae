# Implementing iA Writer-Style Readability in Obsidian

Technical research on how to implement guttered headings, dimmed syntax characters, sentence/paragraph focus, and typewriter scrolling inside an Obsidian plugin using CodeMirror 6.

---

## Obsidian's Editor Architecture

Obsidian uses **CodeMirror 6 (CM6)** as its editor engine, extended by **HyperMD** for Markdown-specific line classes and token classes. Obsidian re-exports `@codemirror/*` packages internally — plugins must mark these as `external` in their bundler so they share the same class instances (YAAE already does this in `esbuild.config.mjs`).

An "Obsidian editor extension" **is** a CM6 extension, registered via `Plugin.registerEditorExtension()`.

### Key Obsidian-Provided StateFields

```typescript
import { editorEditorField, editorViewField } from "obsidian";

// Inside a CM6 extension:
const cmView: EditorView = state.field(editorEditorField);       // CM6 EditorView
const mdView: MarkdownView = state.field(editorViewField);       // Obsidian MarkdownView
```

---

## Feature 1: Guttered / Outdented Headings

Push `#` characters into the left margin so heading text aligns with body text.

### Approach A: Pure CSS (Simplest)

Obsidian already applies these classes via HyperMD:

| Element | CSS Class |
|---|---|
| Heading lines | `.HyperMD-header`, `.HyperMD-header-1` … `.HyperMD-header-6` |
| `#` characters | `.cm-formatting-header`, `.cm-formatting-header-1` … `.cm-formatting-header-6` |

```css
/* Create gutter space on all content lines */
.cm-content .cm-line {
  padding-left: 40px;
}

/* Pull heading formatting characters into the gutter */
.cm-content .cm-line .cm-formatting-header {
  display: inline-block;
  width: 40px;
  margin-left: -40px;
  text-align: right;
  padding-right: 0.5em;
  color: var(--text-muted);
  opacity: 0.5;
}
```

### Approach B: CM6 `Decoration.line()` (More Control)

Use the syntax tree to identify headings and apply line-level decorations:

```typescript
import { syntaxTree } from "@codemirror/language";
import { Decoration, ViewPlugin, ViewUpdate, EditorView } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const headingPlugin = ViewPlugin.fromClass(
  class {
    decorations;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }
    build(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      const tree = syntaxTree(view.state);
      tree.iterate({
        from: view.viewport.from,
        to: view.viewport.to,
        enter: (node) => {
          if (node.type.name.startsWith("ATXHeading")) {
            const level = node.type.name.match(/\d/)?.[0] || "1";
            const line = view.state.doc.lineAt(node.from);
            builder.add(line.from, line.from, Decoration.line({
              attributes: {
                class: `yaae-heading yaae-heading-${level}`,
              },
            }));
          }
        },
      });
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations }
);
```

### Approach C: CM6 `gutter()` API (Heading Level Indicators)

The [Lapel plugin](https://github.com/liamcain/obsidian-lapel) demonstrates using CM6's `gutter()` with custom `GutterMarker` subclasses to render `H1`, `H2`, etc. labels in a dedicated gutter column — these don't replace the `#` characters but add a visual indicator alongside them.

```typescript
import { gutter, GutterMarker } from "@codemirror/view";

class HeadingMarker extends GutterMarker {
  constructor(readonly level: number) { super(); }
  toDOM() {
    const el = document.createElement("span");
    el.className = "yaae-gutter-heading";
    el.dataset.level = String(this.level);
    el.textContent = `H${this.level}`;
    return el;
  }
}
```

### Recommendation

Start with **Approach A (pure CSS)** — it's zero-JS, leverages existing HyperMD classes, and achieves the core visual effect. Graduate to Approach B if we need cursor-aware behavior (e.g., show `#` at full opacity on the active line).

---

## Feature 2: Dimmed Syntax Characters

Keep `**`, `*`, `[]()`, `` ` ``, `>`, `-` visible but visually subdued.

### Approach A: Pure CSS

```css
/* Dim all formatting markers */
.cm-formatting {
  opacity: 0.3;
  transition: opacity 0.15s ease;
}

/* Full opacity when cursor is on the line */
.cm-active .cm-formatting {
  opacity: 0.7;
}

/* Target specific types if desired */
.cm-formatting-strong,      /* ** */
.cm-formatting-em,           /* * or _ */
.cm-formatting-header,       /* # */
.cm-formatting-link,         /* [ */
.cm-formatting-link-end,     /* ] */
.cm-formatting-quote,        /* > */
.cm-formatting-list,         /* - or 1. */
.cm-formatting-code {        /* ` */
  /* inherits from .cm-formatting */
}
```

### Approach B: CM6 `Decoration.mark()` (Cursor-Aware)

Walk the syntax tree and apply decorations to formatting tokens, with different treatment near the cursor:

```typescript
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";

// Inside a ViewPlugin's build method:
const tree = syntaxTree(view.state);
const cursorLine = view.state.doc.lineAt(view.state.selection.main.head);

tree.iterate({
  from: view.viewport.from,
  to: view.viewport.to,
  enter: (node) => {
    const props = node.type.prop(tokenClassNodeProp);
    if (props?.includes("formatting")) {
      const nodeLine = view.state.doc.lineAt(node.from);
      const cls = nodeLine.number === cursorLine.number
        ? "yaae-syntax-near"    // subtle dim
        : "yaae-syntax-far";    // strong dim
      builder.add(node.from, node.to, Decoration.mark({ class: cls }));
    }
  },
});
```

### Obsidian's Built-In CSS Classes for Tokens

| Class | Content |
|---|---|
| `.cm-formatting` | Base class for ALL syntax markers |
| `.cm-formatting-header` | `#` characters |
| `.cm-formatting-strong` | `**` markers |
| `.cm-formatting-em` | `*` or `_` markers |
| `.cm-formatting-link` | `[` bracket |
| `.cm-formatting-link-end` | `]` bracket |
| `.cm-formatting-code` | Backtick markers |
| `.cm-formatting-list` | List bullets/numbers |
| `.cm-formatting-quote` | `>` marker |
| `.cm-strong` | Bold text content |
| `.cm-em` | Italic text content |
| `.cm-header` / `.cm-header-1` … `6` | Heading text content |
| `.cm-link` | External link text |
| `.cm-hmd-internal-link` | Wiki link text |
| `.cm-inline-code` | Inline code content |
| `.cm-strikethrough` | Strikethrough text |
| `.cm-highlight` | Highlighted text |

### On "The Jiggle" Problem

Obsidian's Live Preview mode hides/shows formatting characters when the cursor enters/leaves a line. iA Writer argues this "jiggle" is distracting. If we want to prevent it:

- Roman Komarov's technique ([blog.kizu.dev](https://blog.kizu.dev/fixing-obsidians-markdown-display-with-css/)): Use `::before` / `::after` pseudo-elements to "restore" hidden syntax characters at reduced opacity, so they're always visible but subdued.
- Alternatively, disable Obsidian's Live Preview folding via CM6 and always show formatting characters.

### Recommendation

Start with **pure CSS** targeting `.cm-formatting`. If the interaction with Obsidian's Live Preview folding causes problems, escalate to the CM6 approach with `Decoration.mark()`.

---

## Feature 3: Sentence & Paragraph Focus

Dim all text except the current sentence or paragraph.

### Prior Art in the Obsidian Ecosystem

| Plugin | Approach | Granularity |
|---|---|---|
| [Stille](https://github.com/michaellee/stille) | Pure CSS (`.cm-active` line) | Line only |
| [Focus Active Sentence](https://github.com/artisticat1/focus-active-sentence) | `ViewPlugin` + `Decoration.mark()` | Sentence |
| [Ghost Fade Focus](https://github.com/skipadu/obsidian-ghost-fade-focus) | `ViewPlugin` + `Decoration.line()` | Line proximity (gradient) |
| [Typewriter Mode](https://github.com/davisriedel/obsidian-typewriter-mode) | `ViewPlugin` + `Decoration.mark()` | Sentence + paragraph |
| [Obsidian Scroller](https://github.com/coignard/obsidian-scroller) | `ViewPlugin` + `Decoration.mark()` | Line/sentence/paragraph/section |

### Implementation Pattern

The proven pattern used by Focus Active Sentence and Typewriter Mode:

```typescript
const focusPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = this.build(update.view);
      }
    }

    build(view: EditorView): DecorationSet {
      const { state } = view;
      const pos = state.selection.main.head;
      const widgets: Range<Decoration>[] = [];

      // --- Paragraph mode ---
      const cursorLine = state.doc.lineAt(pos);
      let paraStart = cursorLine.from;
      let paraEnd = cursorLine.to;

      // Walk backward to paragraph start (empty line)
      for (let n = cursorLine.number - 1; n >= 1; n--) {
        const line = state.doc.line(n);
        if (line.text.trim().length === 0) break;
        paraStart = line.from;
      }

      // Walk forward to paragraph end (empty line)
      for (let n = cursorLine.number + 1; n <= state.doc.lines; n++) {
        const line = state.doc.line(n);
        if (line.text.trim().length === 0) break;
        paraEnd = line.to;
      }

      // Dim everything outside the active paragraph
      const dimDeco = Decoration.mark({ class: "yaae-dimmed" });
      if (paraStart > 0) {
        widgets.push(dimDeco.range(0, paraStart));
      }
      if (paraEnd < state.doc.length) {
        widgets.push(dimDeco.range(paraEnd, state.doc.length));
      }

      return Decoration.set(widgets.sort((a, b) => a.from - b.from));
    }
  },
  { decorations: (v) => v.decorations }
);
```

### Sentence Detection

Sentence boundary detection requires special handling:

```typescript
function findSentenceBounds(line: Line, pos: number): { start: number; end: number } {
  const text = line.text;
  const offset = pos - line.from;
  const delimiters = /[.!?]/;
  const abbreviations = /\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g)\./gi;

  // Find sentence start: scan backward from cursor
  let start = 0;
  for (let i = offset - 1; i >= 0; i--) {
    if (delimiters.test(text[i])) {
      // Check it's not an abbreviation
      const before = text.substring(Math.max(0, i - 5), i + 1);
      if (!abbreviations.test(before)) {
        start = i + 1;
        break;
      }
    }
  }

  // Find sentence end: scan forward from cursor
  let end = text.length;
  for (let i = offset; i < text.length; i++) {
    if (delimiters.test(text[i])) {
      const before = text.substring(Math.max(0, i - 5), i + 1);
      if (!abbreviations.test(before)) {
        end = i + 1;
        break;
      }
    }
  }

  // Trim leading whitespace
  while (start < end && text[start] === " ") start++;

  return { start: line.from + start, end: line.from + end };
}
```

### CSS for Dimming

```css
.yaae-dimmed {
  color: var(--text-muted);          /* or a custom grey */
  /* NOT opacity — that would also dim backgrounds/borders */
  transition: color 0.15s ease;
}

/* Alternative: use opacity on the span level */
.yaae-dimmed {
  opacity: 0.3;
}
```

### Sentence vs. Paragraph: The Typewriter Mode Approach

Typewriter Mode uses two CSS classes on different ranges within the active line:

- `.active-sentence` → full opacity (the sentence the cursor is in)
- `.active-paragraph` → dimmed (the rest of the current line/paragraph around the sentence)
- Everything outside the active line → dimmed via line-level CSS

```scss
// Sentence-level dimming
.cm-line {
  opacity: var(--dimmed-opacity);     // dim everything by default
  &.cm-active {
    opacity: 1;                       // restore active line
    .active-paragraph { opacity: var(--dimmed-opacity); }  // re-dim non-sentence parts
    .active-sentence  { opacity: 1; }                      // keep sentence bright
  }
}
```

---

## Feature 4: Typewriter Scrolling

Keep the cursor vertically centered in the viewport.

### Core Technique

```typescript
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";

function getTypewriterOffset(view: EditorView, percent = 0.5): number {
  const editorDom = view.dom.closest(".cm-editor");
  return editorDom ? editorDom.clientHeight * percent : 0;
}

const typewriterPlugin = ViewPlugin.fromClass(
  class {
    constructor(private view: EditorView) {
      this.recenter();
    }

    update(update: ViewUpdate) {
      if (update.selectionSet || update.docChanged) {
        this.recenter();
      }
    }

    recenter() {
      const head = this.view.state.selection.main.head;
      const offset = getTypewriterOffset(this.view);
      this.view.dispatch({
        effects: EditorView.scrollIntoView(head, {
          y: "start",
          yMargin: offset,
        }),
      });
    }
  }
);
```

### Bottom Padding

For typewriter mode to work at the end of a document, the content area needs extra bottom padding so the last line can scroll to center:

```typescript
// Inside the ViewPlugin:
const sizer = this.view.dom.querySelector(".cm-sizer") as HTMLElement;
if (sizer) {
  sizer.style.paddingBottom = `${offset}px`;
}
```

### Smooth Scrolling (Optional)

Instead of `EditorView.scrollIntoView()`, animate `scrollDOM.scrollTop` directly:

```typescript
animateScrollTo(target: number) {
  const scrollDOM = this.view.scrollDOM;
  const from = scrollDOM.scrollTop;
  const duration = 150; // ms
  const start = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3); // cubic ease-out

  const step = () => {
    const progress = Math.min((performance.now() - start) / duration, 1);
    scrollDOM.scrollTop = from + (target - from) * ease(progress);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
```

### User Event Filtering

Only scroll on user-initiated changes, not programmatic ones:

```typescript
update(update: ViewUpdate) {
  for (const tr of update.transactions) {
    if (tr.isUserEvent("input") || tr.isUserEvent("select") || tr.isUserEvent("delete")) {
      this.recenter();
      break;
    }
  }
}
```

---

## Plugin Registration Pattern

All CM6 extensions are registered via `registerEditorExtension()`:

```typescript
import { Plugin } from "obsidian";

export default class YAAEPlugin extends Plugin {
  onload() {
    this.registerEditorExtension([
      headingPlugin,      // guttered headings
      focusPlugin,        // sentence/paragraph focus
      typewriterPlugin,   // typewriter scroll
    ]);
  }
}
```

### Dynamic Feature Toggling

Use CM6 `Compartment` for toggling features on/off without re-registering:

```typescript
import { Compartment } from "@codemirror/state";

const focusCompartment = new Compartment();

// Register with initial state
this.registerEditorExtension(
  focusCompartment.of(settings.focusEnabled ? focusPlugin : [])
);

// Toggle later:
this.app.workspace.iterateAllLeaves((leaf) => {
  if (leaf.view instanceof MarkdownView) {
    const cm = (leaf.view.editor as any).cm as EditorView;
    cm.dispatch({
      effects: focusCompartment.reconfigure(
        newValue ? focusPlugin : []
      ),
    });
  }
});
```

### Alternative: Body Class Toggle Pattern

The simpler approach used by Stille and Typewriter Mode for CSS-only features:

```typescript
// Enable
document.body.classList.add("yaae-focus-mode");

// Disable
document.body.classList.remove("yaae-focus-mode");

// CSS scoped to the body class
// body.yaae-focus-mode .cm-line:not(.cm-active) { opacity: 0.3; }
```

---

## Recommended Architecture

```
src/
├── cm6/
│   ├── guttered-headings.ts    # Decoration.line() for heading outdenting
│   ├── syntax-dimming.ts       # Decoration.mark() for formatting char dimming
│   ├── focus-mode.ts           # Sentence/paragraph dimming ViewPlugin
│   └── typewriter-scroll.ts    # Cursor-centering scroll ViewPlugin
├── css/
│   ├── guttered-headings.css   # Heading outdent styles
│   ├── syntax-dimming.css      # Formatting character opacity
│   └── focus-mode.css          # Dimmed text color/opacity
└── types.ts                    # Settings interfaces
```

### Phase 1 — CSS-Only (Low Risk, High Impact)

1. Guttered headings via `.cm-formatting-header` negative margin
2. Dimmed syntax characters via `.cm-formatting` opacity
3. Simple line-level focus via `.cm-active` (Stille approach)

### Phase 2 — CM6 ViewPlugin (Medium Complexity)

4. Paragraph-level focus with `Decoration.mark()`
5. Sentence-level focus with boundary detection
6. Cursor-aware syntax dimming (brighter near cursor)

### Phase 3 — Advanced (Higher Complexity)

7. Typewriter scrolling with `EditorView.scrollIntoView()`
8. Smooth scroll animation
9. Configurable settings (opacity levels, focus mode selection, typewriter offset)
10. Keyboard shortcuts / commands for toggling modes

---

## Key Reference Plugins

| Plugin | GitHub | Key Technique |
|---|---|---|
| **Stille** | [michaellee/stille](https://github.com/michaellee/stille) | CSS-only focus (line-level) |
| **Focus Active Sentence** | [artisticat1/focus-active-sentence](https://github.com/artisticat1/focus-active-sentence) | CM6 sentence detection + `Decoration.mark()` |
| **Ghost Fade Focus** | [skipadu/obsidian-ghost-fade-focus](https://github.com/skipadu/obsidian-ghost-fade-focus) | `Decoration.line()` proximity gradient |
| **Typewriter Mode** | [davisriedel/obsidian-typewriter-mode](https://github.com/davisriedel/obsidian-typewriter-mode) | Full CM6: sentence focus + typewriter scroll |
| **Obsidian Scroller** | [coignard/obsidian-scroller](https://github.com/coignard/obsidian-scroller) | JS-only ViewPlugin, smooth scroll |
| **Lapel** | [liamcain/obsidian-lapel](https://github.com/liamcain/obsidian-lapel) | CM6 `gutter()` + `GutterMarker` for heading indicators |
| **cm6-attributes** | [nothingislost/obsidian-cm6-attributes](https://github.com/nothingislost/obsidian-cm6-attributes) | Syntax tree parsing reference |

---

## Sources

- [Editor Extensions — Obsidian Developer Docs](https://docs.obsidian.md/Plugins/Editor/Editor+extensions)
- [View Plugins — Obsidian Developer Docs](https://docs.obsidian.md/Plugins/Editor/View+plugins)
- [State Fields — Obsidian Developer Docs](https://docs.obsidian.md/Plugins/Editor/State+fields)
- [Decorations — Obsidian Developer Docs](https://docs.obsidian.md/Plugins/Editor/Decorations)
- [registerEditorExtension — Obsidian API](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerEditorExtension)
- [Communicating with Editor Extensions — Obsidian Developer Docs](https://docs.obsidian.md/Plugins/Editor/Communicating+with+editor+extensions)
- [CodeMirror Decoration Example](https://codemirror.net/examples/decoration/)
- [CodeMirror Gutter Example](https://codemirror.net/examples/gutter/)
- [CodeMirror Reference Manual](https://codemirror.net/docs/ref/)
- [Fixing Obsidian's Markdown Display with CSS — Roman Komarov](https://blog.kizu.dev/fixing-obsidians-markdown-display-with-css/)
- [Accessing the Vault from a CM6 Plugin — designdebt.club](https://designdebt.club/accessing-the-vault-from-an-obsidian-codemirror-plugin/)
- [CM6 Scroll to Middle — CodeMirror Forum](https://discuss.codemirror.net/t/cm6-scroll-to-middle/2924)
