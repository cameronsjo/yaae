# What I Wish I Knew Sooner: Obsidian Plugin Development

Lessons from building YAAE — collected so an AI skill or human contributor can skip the rabbit holes.

---

## 1. The editor is CodeMirror 6, not "Obsidian's editor"

Obsidian wraps CM6 with a layer called HyperMD. When you search for "how to do X in Obsidian's editor," you're actually looking for "how to do X in CodeMirror 6." The Obsidian-specific part is just registration:

```typescript
this.registerEditorExtension(myCM6Extension);
```

Everything else — `ViewPlugin`, `Decoration`, `StateField`, `Facet`, `Compartment` — is stock CM6. Search the [CM6 docs](https://codemirror.net/docs/) and [CM6 forum](https://discuss.codemirror.net/), not Obsidian forums, for editor internals.

## 2. You MUST externalize `@codemirror/*` packages

If you bundle your own copy of `@codemirror/view` or `@codemirror/state`, class identity checks like `instanceof Decoration` will fail silently. Your decorations will be ignored, your StateFields won't resolve, and nothing will error — it just won't work.

The fix: mark all `@codemirror/*` and `@lezer/*` packages as `external` in your bundler. Obsidian provides these at runtime.

```javascript
// esbuild.config.mjs
external: [
  "obsidian",
  "@codemirror/autocomplete",
  "@codemirror/collab",
  "@codemirror/commands",
  "@codemirror/language",
  "@codemirror/lint",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/view",
  "@lezer/common",
  "@lezer/highlight",
  "@lezer/lr",
]
```

## 3. HyperMD already applies CSS classes to everything

Before writing a ViewPlugin to classify markdown tokens, check whether HyperMD already applies a class. It almost certainly does:

| What you want | Class already there |
|---|---|
| Bold markers `**` | `.cm-formatting-strong` |
| Italic markers `*` | `.cm-formatting-em` |
| Heading hashes `#` | `.cm-formatting-header`, `.cm-formatting-header-1` … `6` |
| Code backticks | `.cm-formatting-code` |
| Link brackets | `.cm-formatting-link`, `.cm-formatting-link-end` |
| List bullets | `.cm-formatting-list`, `.cm-formatting-list-ul`, `.cm-formatting-list-ol` |
| Blockquote `>` | `.cm-formatting-quote` |
| All formatting chars | `.cm-formatting` (base class) |
| Active line | `.cm-active` (on `.cm-line`) |
| Heading content | `.cm-header`, `.cm-header-1` … `.cm-header-6` |
| Heading line | `.HyperMD-header`, `.HyperMD-header-1` … `6` |
| Bold content | `.cm-strong` |
| Italic content | `.cm-em` |
| Internal links | `.cm-hmd-internal-link` |

**Lesson:** If you can do it with a CSS snippet, do it with a CSS snippet. Save CM6 extensions for things CSS can't do (cursor-aware logic, sentence detection, scroll control).

## 4. `registerEditorExtension()` vs `registerEvent()` — know which to use

- **`registerEditorExtension()`** — for CM6 extensions (ViewPlugins, StateFields, Decorations). Auto-cleanup on plugin unload. The extension runs inside CM6's update cycle.
- **`registerEvent()`** — for Obsidian workspace/vault events (`file-open`, `active-leaf-change`, `modify`, etc.). Auto-cleanup on plugin unload.
- **`this.addCommand()`** — for commands in the command palette. Auto-cleanup on plugin unload.

Don't use raw `addEventListener` or `workspace.on()` without wrapping in `registerEvent()` — you'll leak listeners.

## 5. Live Preview hides formatting characters — and that fights you

Obsidian's Live Preview mode folds formatting characters when the cursor leaves a line. If your plugin dims formatting characters with CSS, you'll fight with Live Preview's fold behavior: your dimmed `**` will disappear entirely when the cursor moves away.

Options:
- **Accept it:** Only dim on the active line (where characters are visible)
- **Fight it:** Use `::before`/`::after` pseudo-elements to "restore" folded characters at reduced opacity (Roman Komarov's technique)
- **Disable it:** Reconfigure CM6 fold extensions to never fold formatting (heavy-handed)

## 6. `Decoration.mark()` vs `Decoration.line()` vs `Decoration.widget()`

- **`mark()`** — applies a CSS class to a text range. Use for: dimming a sentence, styling formatting chars, highlighting spans.
- **`line()`** — applies a CSS class to an entire line element. Use for: background colors, line-level indicators, heading line styling.
- **`widget()`** — inserts a DOM element at a position. Use for: gutter icons, inline buttons, fold toggles.

Common mistake: using `mark()` when you want `line()`. Line decorations are simpler and perform better for line-level effects.

## 7. `ViewPlugin.fromClass()` is the workhorse pattern

90% of editor features follow this shape:

```typescript
const myPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view);
      }
    }
    buildDecorations(view: EditorView): DecorationSet {
      // ... build and return decorations
    }
  },
  { decorations: (v) => v.decorations }
);
```

The key gotcha: the `decorations` accessor in the second arg **must** be provided or CM6 won't read your decorations. It's not optional despite looking like boilerplate.

## 8. Use `Compartment` for toggling features

Don't unregister/re-register editor extensions to toggle features. Use CM6's `Compartment`:

```typescript
const compartment = new Compartment();
this.registerEditorExtension(compartment.of(myPlugin));

// Later, toggle off:
cm.dispatch({ effects: compartment.reconfigure([]) });

// Toggle back on:
cm.dispatch({ effects: compartment.reconfigure(myPlugin) });
```

## 9. `syntaxTree()` is how you read markdown structure

To find headings, links, code blocks, etc. programmatically:

```typescript
import { syntaxTree } from "@codemirror/language";

const tree = syntaxTree(view.state);
tree.iterate({
  from: view.viewport.from,
  to: view.viewport.to,
  enter: (node) => {
    // node.type.name === "ATXHeading1", "Emphasis", "StrongEmphasis", etc.
  },
});
```

Always scope iteration to `view.viewport` — iterating the entire document on every keystroke will freeze the editor.

## 10. Testing is hard — mock early, mock correctly

Obsidian doesn't export a test harness. You need to:
1. Mock the `obsidian` module entirely (we alias it in `vitest.config.ts`)
2. Mock browser globals (`document`, `window`) in a setup file
3. For CM6 logic, test against real CM6 (it runs in Node) but mock Obsidian's StateFields (`editorEditorField`, `editorViewField`)

The mock needs to cover `Plugin`, `TFile`, `TAbstractFile`, `Setting`, `Notice`, etc. — Obsidian's type surface is wide. Start with only what you use and grow the mock incrementally.

## 11. `styles.css` is loaded automatically

Obsidian loads `styles.css` from your plugin's root directory automatically. You don't need to inject it manually. CSS custom properties defined by Obsidian themes (like `--text-muted`, `--background-primary`, etc.) are available to you — use them instead of hard-coding colors so your plugin works with all themes.

## 12. Hot reload works — but with caveats

`npm run dev` (esbuild watch mode) rebuilds `main.js` on save. The Obsidian "Hot Reload" community plugin detects this and reloads your plugin. But:
- CSS changes are picked up immediately (no reload needed)
- `registerEditorExtension()` extensions persist across reloads if not properly cleaned up
- State in `this.settings` is re-loaded from disk on each reload

## 13. Don't import from `electron` unless you need to

`electron` is listed as an external in the build config. It's available at runtime for desktop-only features (file system dialogs, native menus, etc.). But if you import it, your plugin becomes `"isDesktopOnly": true` territory. Mobile users lose access.

## 14. `main.js` is the artifact — not your source

`main.js` is the bundled output, gitignored by convention. CI builds it. Don't edit it, don't commit it. Your entry point is `main.ts` and esbuild produces `main.js`. The `manifest.json` tells Obsidian where to find it.

## 15. The Obsidian API docs are incomplete — read plugin source code

The official [Obsidian Developer Docs](https://docs.obsidian.md/) cover the basics. For anything beyond simple settings and commands, read the source of established plugins:

| Plugin | What to learn |
|---|---|
| [Lapel](https://github.com/liamcain/obsidian-lapel) | CM6 `gutter()` API, syntax tree iteration |
| [Typewriter Mode](https://github.com/davisriedel/obsidian-typewriter-mode) | Scroll control, sentence detection, feature toggling |
| [Focus Active Sentence](https://github.com/artisticat1/focus-active-sentence) | `Decoration.mark()` with sentence boundaries |
| [Stille](https://github.com/michaellee/stille) | Simplest possible focus mode (CSS only) |
| [cm6-attributes](https://github.com/nothingislost/obsidian-cm6-attributes) | Comprehensive syntax tree parsing + all decoration types |
