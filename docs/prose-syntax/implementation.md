# Implementation Research — Prose Syntax Highlighting in YAAE

How to bring iA Writer-style prose highlighting into an Obsidian plugin, covering
Obsidian's rendering engine, NLP options, IPC strategies, and performance patterns.

---

## Table of Contents

1. [Obsidian's Editor Architecture (CodeMirror 6)](#1-obsidians-editor-architecture)
2. [CM6 Decorations API](#2-cm6-decorations-api)
3. [Obsidian's registerEditorExtension](#3-obsidians-registereditorextension)
4. [StateField vs ViewPlugin](#4-statefield-vs-viewplugin)
5. [NLP: JavaScript Libraries](#5-nlp-javascript-libraries)
6. [NLP: IPC to External Process](#6-nlp-ipc-to-external-process)
7. [NLP: WebAssembly](#7-nlp-webassembly)
8. [NLP: Apple NLTagger via Electron](#8-nlp-apple-nltagger-via-electron)
9. [Performance Patterns](#9-performance-patterns)
10. [Prior Art: nl-syntax-highlighting Plugin](#10-prior-art-nl-syntax-highlighting)
11. [Recommended Architecture for YAAE](#11-recommended-architecture-for-yaae)

---

## 1. Obsidian's Editor Architecture

Obsidian uses **CodeMirror 6** for its editor (both Source mode and Live Preview).
An "Obsidian editor extension" is literally a CM6 extension — same types, same APIs.

### Key Concepts

- **State** (`EditorState`) is immutable and functional. **View** (`EditorView`) is
  the imperative DOM rendering layer.
- All state changes flow through **transactions** (`Transaction`).
- Extensions are composed via **facets** (typed slots), **state fields** (per-instance
  state), and **view plugins** (imperative, view-lifecycle-bound components).
- Obsidian overloads `require()` for `@codemirror/*` so plugins share the same CM6
  instance. **Never bundle your own CM6** — mark all `@codemirror/*` as external in
  esbuild (YAAE's `esbuild.config.mjs` already does this correctly).

### Obsidian-Provided CM6 State Fields

| Import from `'obsidian'` | Type | Purpose |
|---|---|---|
| `editorInfoField` | `StateField<MarkdownView>` | Access the MarkdownView from CM6 state |
| `editorLivePreviewField` | `StateField<boolean>` | Check if Live Preview is active |

```ts
import { editorInfoField } from "obsidian";

// Inside a ViewPlugin or StateField:
const markdownView = state.field(editorInfoField);
const file = markdownView.file; // TFile
```

---

## 2. CM6 Decorations API

CM6 provides four decoration types. For prose highlighting, we only need **mark
decorations** — they wrap existing text ranges in styled `<span>` elements without
affecting layout.

### Mark Decoration

```ts
import { Decoration } from "@codemirror/view";

const adjMark = Decoration.mark({ class: "pos-adjective" });
// Usage: adjMark.range(from, to)
```

### Building a DecorationSet

Two approaches:

```ts
// 1. RangeSetBuilder (must add in ascending document order)
import { RangeSetBuilder } from "@codemirror/state";
const builder = new RangeSetBuilder<Decoration>();
builder.add(5, 10, adjMark);
builder.add(20, 30, nounMark);
const set = builder.finish();

// 2. Decoration.set (from unsorted array)
const set = Decoration.set([
  adjMark.range(5, 10),
  nounMark.range(20, 30),
], true); // true = already sorted
```

### ViewPlugin Pattern (Complete)

```ts
import {
  ViewPlugin, ViewUpdate, Decoration, DecorationSet,
  EditorView
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

class ProseHighlighter {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    for (const { from, to } of view.visibleRanges) {
      // Only process visible text — the key performance win
      const text = view.state.sliceDoc(from, to);
      // ... NLP tagging, add decorations in document order ...
    }
    return builder.finish();
  }
}

export const proseHighlighterPlugin = ViewPlugin.fromClass(
  ProseHighlighter,
  { decorations: (v) => v.decorations }
);
```

### ViewUpdate Properties

| Property | Type | When to react |
|---|---|---|
| `update.docChanged` | `boolean` | Content changed — must retag |
| `update.viewportChanged` | `boolean` | Scrolled — must tag newly visible lines |
| `update.selectionSet` | `boolean` | Selection moved (usually ignore) |
| `update.changes` | `ChangeSet` | Exact ranges that changed |

---

## 3. Obsidian's `registerEditorExtension`

### Basic Registration

```ts
import { Plugin } from "obsidian";

export default class YAAEPlugin extends Plugin {
  private extensions: Extension[] = [];

  async onload() {
    this.extensions = [proseHighlighterPlugin];
    this.registerEditorExtension(this.extensions);
  }
}
```

- Immediately loads on **all open editors** and all future editors
- Automatically **unloads** when the plugin is disabled
- The array is held **by reference** — mutate it and call `updateOptions()` to toggle

### Dynamic Toggle

```ts
toggleHighlighting(enabled: boolean) {
  this.extensions.length = 0;
  if (enabled) {
    this.extensions.push(proseHighlighterPlugin);
  }
  this.app.workspace.updateOptions(); // expensive — call sparingly
}
```

### Passing Plugin Instance to ViewPlugin (Closure Pattern)

The ViewPlugin class has no access to the Obsidian Plugin instance. Use a factory:

```ts
export function createHighlighter(plugin: YAAEPlugin) {
  class Highlighter {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      // `plugin` available via closure
      const settings = plugin.settings;
      this.decorations = this.build(view);
    }
    // ...
  }

  return ViewPlugin.fromClass(Highlighter, {
    decorations: (v) => v.decorations,
  });
}
```

This is cleaner than the global `window.app.plugins.plugins[...]` pattern used by
nl-syntax-highlighting.

---

## 4. StateField vs ViewPlugin

| | StateField | ViewPlugin |
|---|---|---|
| **When to use** | Decorations driven by user actions, block-level widgets | Content-derived decorations, viewport-aware |
| **Viewport access** | No | Yes (`view.visibleRanges`) |
| **Layout effects** | Can add block widgets that change vertical layout | Mark decorations only (no layout changes) |
| **Persistence** | Survives view recreation | Destroyed/recreated with view |

**For prose highlighting → ViewPlugin.** Our decorations are:
- Derived from content (not user actions)
- Mark decorations only (no block widgets)
- Performance-sensitive (need viewport-only processing)

---

## 5. NLP: JavaScript Libraries

### Comparison

| Library | Approach | Accuracy | Bundle (gzip) | Speed | Languages | Maintained |
|---------|----------|----------|--------------|-------|-----------|------------|
| **compromise** | Rule-based | "Good enough" | ~75-80 kB | ~1 MB/sec text | EN + community FR/DE/ES/IT/PT | Yes (active) |
| **wink-nlp** | Statistical ML | ~95% WSJ | ~1 MB (incl. model) | 650K tok/sec | EN only | Yes |
| **en-pos** | Brill TBL | 96.4% Penn | ~50 kB est. | Fast | EN only | No (2017) |
| **natural** | Brill TBL | ~90-93% | Very large | Moderate | EN + some | Yes |
| **pos-js** | HMM | 87.8% | Small | Fast | EN | Minimal |

### compromise (Recommended for MVP)

[github.com/spencermountain/compromise](https://github.com/spencermountain/compromise)

Rule-based POS tagger with 83 custom tags. No model files to load. ~210 kB minified,
~75-80 kB gzipped. Processes ~1 MB/sec of raw text (synchronous, on main thread).

```ts
import nlp from "compromise";

const doc = nlp("The quick brown fox jumps over the lazy dog");

doc.adjectives().out("offset");   // [{text: "quick", offset: {start: 4, length: 5}}, ...]
doc.match("#Noun").not("#Pronoun").out("offset");
doc.adverbs().out("offset");
doc.match("#Verb").out("offset");
doc.conjunctions().out("offset");
```

**Pros:** Zero-config, small bundle, fast enough for main thread, works on mobile.
**Cons:** Rule-based accuracy can miss edge cases, English-centric.

### wink-nlp (Accuracy Upgrade)

[github.com/winkjs/wink-nlp](https://github.com/winkjs/wink-nlp)

Statistical pipeline with pre-trained model. ~95% accuracy (WSJ). The `wink-eng-lite-web-model`
is ~1 MB gzipped — the dominant cost.

```ts
import winkNLP from "wink-nlp";
import model from "wink-eng-lite-web-model";

const nlp = winkNLP(model);
const doc = nlp.readDoc("The quick brown fox jumps over the lazy dog");
doc.tokens().each((t) => {
  console.log(t.out(), t.out(nlp.its.pos)); // "quick" "ADJ"
});
```

**Pros:** High accuracy, Universal POS tagset, TypeScript support.
**Cons:** 1 MB model bundled into main.js (or loaded async), English only.

---

## 6. NLP: IPC to External Process

Since Obsidian runs on Electron, Node.js APIs are available on desktop. An external
process (e.g., Python + spaCy) could provide higher-accuracy tagging.

### IPC Mechanisms

| Mechanism | Overhead | Complexity | Best For |
|-----------|----------|------------|----------|
| `child_process.spawn` + stdio pipes | Low | Medium | Long-running NLP server |
| HTTP on localhost | Higher | Low | Request/response pattern |
| WebSockets | Low | Medium | High-frequency, small payloads |
| Named pipes | Lowest | High | Maximum throughput |

### child_process Pattern

```ts
// Plugin side (Node.js in Electron)
import { spawn } from "child_process";

const nlpProcess = spawn("python3", ["nlp_server.py"], {
  stdio: ["pipe", "pipe", "inherit"],
});

// Send line-delimited JSON requests
nlpProcess.stdin.write(JSON.stringify({ text: "Tag this text" }) + "\n");

// Read line-delimited JSON responses
nlpProcess.stdout.on("data", (data) => {
  const result = JSON.parse(data.toString());
  // result: [{text: "Tag", pos: "VERB"}, {text: "this", pos: "DET"}, ...]
});
```

```python
# nlp_server.py
import sys, json, spacy

nlp = spacy.load("en_core_web_sm")

for line in sys.stdin:
    request = json.loads(line)
    doc = nlp(request["text"])
    result = [{"text": t.text, "pos": t.pos_, "start": t.idx, "end": t.idx + len(t)} for t in doc]
    sys.stdout.write(json.dumps(result) + "\n")
    sys.stdout.flush()  # Critical: Python buffers stdout
```

### Tradeoffs

| Factor | In-Browser JS | External Process (IPC) |
|--------|--------------|----------------------|
| Setup | Zero (npm install) | User installs Python + spaCy |
| Accuracy | ~95% (wink) or rule-based | 97%+ (spaCy) |
| Languages | English mainly | 75+ (spaCy) |
| Mobile | Works | **Does not work** (no child_process) |
| Bundle size | 75 kB – 1 MB | Zero (external) |
| Latency | Sub-ms | IPC overhead per request |
| Reliability | Always available | Process can crash, might not be installed |
| Plugin review | Normal | Requires `isDesktopOnly: true` |

### How Other Obsidian Plugins Do IPC

- **[Shell Commands](https://github.com/Taitava/obsidian-shellcommands)** — `child_process`
  to run arbitrary shell commands, desktop-only.
- **[Interactivity](https://github.com/ichichikin/obsidian-plugin-interactivity)** — Runs
  local scripts (Python, Node, Java) within notes.
- **[Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)** — HTTPS
  server on `localhost:27124` with API key auth (reverse pattern: Obsidian as server).

### IPC as an Optional "Accuracy Mode"

The most practical approach: use in-browser JS (compromise) as the default, with an
**optional** IPC backend for users who want higher accuracy and have Python + spaCy
installed. This keeps `isDesktopOnly: false` since the IPC path is opt-in.

---

## 7. NLP: WebAssembly

### spacy-wasm

[github.com/SyedAhkam/spacy-wasm](https://github.com/SyedAhkam/spacy-wasm)

Uses Pyodide (CPython compiled to WASM) to run spaCy in the browser. Experimental,
51 stars, unmaintained.

- Pyodide core: ~6.4 MB
- With spaCy + model: estimated 10-30+ MB total
- Cold start: 5-10 seconds

**Verdict: Not viable.** Download size and cold start make it impractical for a
plugin that needs keystroke-level responsiveness.

### Other WASM Options

No production-ready WASM-compiled POS taggers exist. Rust NLP libraries (rust-bert)
could theoretically compile to WASM but none have browser POS tagging packages.

---

## 8. NLP: Apple NLTagger via Electron

On macOS, Apple's Natural Language framework provides `NLTagger` with high-accuracy
POS tagging using on-device ML models. Electron's Node.js layer could call it via a
native addon.

### Architecture

```
Swift (NLTagger) ← Objective-C++ bridge (.mm) ← N-API ← Node.js ← Obsidian plugin
```

```swift
import NaturalLanguage

func tagText(_ text: String) -> [(String, String)] {
    let tagger = NLTagger(tagSchemes: [.lexicalClass])
    tagger.string = text
    var results: [(String, String)] = []
    tagger.enumerateTags(
        in: text.startIndex..<text.endIndex,
        unit: .word,
        scheme: .lexicalClass,
        options: [.omitPunctuation, .omitWhitespace]
    ) { tag, range in
        if let tag = tag {
            results.append((String(text[range]), tag.rawValue))
        }
        return true
    }
    return results
}
```

### Practical Considerations

- **macOS only** — needs a JS fallback for Windows/Linux/mobile.
- **Native addon distribution** — Obsidian plugins are single `main.js` files. `.node`
  binaries would need to be distributed alongside, complicating the plugin structure.
- **Build complexity** — requires `node-gyp`, `binding.gyp`, pre-built binaries per
  platform/arch.
- **No existing npm package** wraps NLTagger for Node.js.

**Verdict: Interesting future experiment**, but impractical as a primary approach.
Could be an optional accuracy tier on macOS, similar to the IPC approach.

### References

- [Electron Native Code and Swift (macOS)](https://www.electronjs.org/docs/latest/tutorial/native-code-and-electron-swift-macos)
- [electron-native-code-demos](https://github.com/felixrieseberg/electron-native-code-demos)
- [swift-napi-bindings](https://github.com/LinusU/swift-napi-bindings)

---

## 9. Performance Patterns

### 9.1 Viewport-Only Processing

The single most important optimization. Only process `view.visibleRanges`:

```ts
buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    // visibleRanges excludes folded regions
    const startLine = view.state.doc.lineAt(from).number;
    const endLine = view.state.doc.lineAt(to).number;
    for (let i = startLine; i <= endLine; i++) {
      // tag each visible line
    }
  }
  return builder.finish();
}
```

### 9.2 Line-Level Caching

Cache POS results per line. On single-character typing, only retag the changed line:

```ts
update(update: ViewUpdate) {
  if (update.docChanged) {
    if (update.startState.doc.lines === update.state.doc.lines) {
      // Same line count — check for single-char insert
      let singleChar = true;
      let changedLine = 0;
      update.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
        if (!((fromA === toA) && (toB === fromB + 1))) singleChar = false;
        changedLine = update.view.state.doc.lineAt(toB).number;
      });
      if (singleChar) {
        this.cache[changedLine] = tagLine(update.view, changedLine);
      } else {
        this.rebuildAll(update.view);
      }
    } else {
      this.rebuildAll(update.view); // lines added/removed
    }
  } else if (update.viewportChanged) {
    this.rebuildAll(update.view); // scrolled
  }
}
```

### 9.3 Debouncing

For expensive NLP, debounce at 150-250ms after the last keystroke:

```ts
private scheduleUpdate(view: EditorView) {
  if (this.timer) clearTimeout(this.timer);
  this.timer = setTimeout(() => {
    this.decorations = this.buildDecorations(view);
    view.dispatch({ effects: [] }); // trigger re-read
  }, 200);
}
```

For compromise (~1ms per paragraph), debouncing may be unnecessary. For wink-nlp or
IPC backends, it's essential.

### 9.4 Web Workers

Obsidian's environment does not natively support `new Worker()`. The workaround is
`esbuild-plugin-inline-worker` to bundle worker code as a Blob URL.

```ts
// Worker code (bundled inline by esbuild plugin)
import nlp from "compromise";

self.onmessage = (event) => {
  const { id, text } = event.data;
  const doc = nlp(text);
  const results = doc.json();
  self.postMessage({ id, results });
};
```

**Caveat:** Web Workers in Obsidian run ~6-10x slower than standalone Node.js for
CPU-intensive work ([forum discussion](https://forum.obsidian.md/t/how-to-speed-up-cpu-intensive-tasks-in-an-obsidian-plugin-workers-not-supported/103392)).
For compromise (~1ms per viewport), a Worker is likely unnecessary overhead.

Reference: [obsidian-web-worker-example](https://github.com/RyotaUshio/obsidian-web-worker-example)

### 9.5 Avoiding Markdown Syntax

Raw NLP tagging will highlight markdown syntax characters (`#`, `*`, `[`, etc.) as
words. Use CM6's `syntaxTree` to identify and skip markdown nodes:

```ts
import { syntaxTree } from "@codemirror/language";

syntaxTree(view.state).iterate({
  from, to,
  enter(node) {
    // Skip code blocks, frontmatter, links, etc.
    if (node.type.name.includes("code") ||
        node.type.name === "FrontMatter") {
      return false; // don't descend into children
    }
  }
});
```

---

## 10. Prior Art: nl-syntax-highlighting

[github.com/artisticat1/nl-syntax-highlighting](https://github.com/artisticat1/nl-syntax-highlighting)

The existing Obsidian community plugin that replicates iA Writer's feature. Key
architectural decisions:

### Architecture

| Component | Approach |
|-----------|----------|
| NLP | **compromise** v14.8.1 (~210 kB bundled) |
| CM6 integration | `ViewPlugin.fromClass()` with `decorations` accessor |
| Caching | `decorationsByLine: { [lineNumber]: DecorationSpec[] }` |
| Styling | Dynamic `<style>` injection in `document.head` |
| Settings | Per-POS toggle + color picker, word overrides, CSS class scope |
| Mobile | Works (`isDesktopOnly: false`) |

### How It Queries compromise

```ts
const doc = nlp(lineText);
const adjectives = doc.adjectives();
const nouns = doc.match("#Noun").not("#Pronoun").not("#Possessive");
const adverbs = doc.adverbs();
const verbs = doc.match("#Verb");
const conjunctions = doc.conjunctions();
```

Offsets extracted via `.out("offset")`, with `terms[0].offset.length` to strip
trailing punctuation from highlight ranges.

### Performance Strategy

1. **Viewport-only** — iterates `view.visibleRanges`
2. **Single-char typing** — only retags the affected line
3. **No debouncing** — NLP runs synchronously on every update

### CSS Strategy

Decorations use simple class names (`adjective`, `noun`, etc.). Colors are injected
dynamically so changing a color doesn't require rebuilding decorations:

```ts
// Generated CSS
.adjective { color: #b97a0a }
.noun { color: #ce4924 }
.adverb { color: #c333a7 }
.verb { color: #177eB8 }
.conjunction { color: #01934e }
```

### Weaknesses / Things to Improve

- **Global plugin access** — uses `window.app.plugins.plugins[...]` instead of the
  closure pattern
- **No debouncing** — large paste/find-replace operations retag everything synchronously
- **Generic CSS class names** — `adjective`, `noun`, etc. can collide with other plugins
  or themes. Prefix with `yaae-` or similar.
- **No markdown-awareness** — tags markdown syntax (headings `#`, bold `**`, links `[]()`)
  as words
- **No sentence-level caching** — line-level caching breaks when sentences span lines
- **English only** — no language detection or multi-language support

---

## 11. Recommended Architecture for YAAE

### Phase 1: MVP

```
┌─────────────────────────────────┐
│  Obsidian Plugin (main.ts)      │
│  ├─ registerEditorExtension()   │
│  ├─ Settings (toggle, colors)   │
│  └─ Dynamic <style> injection   │
├─────────────────────────────────┤
│  CM6 ViewPlugin                 │
│  ├─ Viewport-only processing    │
│  ├─ Line-level caching          │
│  └─ Single-char typing shortcut │
├─────────────────────────────────┤
│  compromise (bundled, ~80 kB)   │
│  ├─ POS tagging per line        │
│  └─ Skip markdown syntax nodes  │
└─────────────────────────────────┘
```

- Use **compromise** directly on the main thread
- **ViewPlugin** with viewport-only processing and line-level caching
- **Closure pattern** to pass plugin instance to ViewPlugin
- **Prefixed CSS classes** (`yaae-pos-adjective`, etc.)
- **Markdown-aware** — use `syntaxTree` to skip code blocks, frontmatter, links
- Works on **desktop and mobile** (`isDesktopOnly: false`)

### Phase 2: Style Check

Add filler/redundancy/cliché detection alongside POS highlighting:
- Maintain word lists (can source from open datasets)
- Different visual treatment: gray + strikethrough vs. color
- Same ViewPlugin, separate decoration layer

### Phase 3: Pluggable NLP Backend

Abstract the NLP layer behind an interface:

```ts
interface POSTagger {
  tag(text: string): Promise<Array<{ text: string; pos: string; start: number; end: number }>>;
}

class CompromiseTagger implements POSTagger { ... }  // Default
class WinkNLPTagger implements POSTagger { ... }     // Higher accuracy
class IPCTagger implements POSTagger { ... }          // External process (desktop)
```

- User selects backend in settings
- IPC backend is opt-in, desktop-only (plugin stays `isDesktopOnly: false`)
- Web Worker wrapper for wink-nlp model loading

### Phase 4: Native Acceleration (Experimental)

- Apple NLTagger via N-API on macOS
- Platform detection with JS fallback

---

## Sources

### Obsidian + CM6

- [Obsidian Developer Docs — Editor Extensions](https://docs.obsidian.md/Plugins/Editor/Editor+extensions)
- [Obsidian Developer Docs — registerEditorExtension](https://docs.obsidian.md/Reference/TypeScript+API/Plugin/registerEditorExtension)
- [Obsidian Developer Docs — State Fields](https://docs.obsidian.md/Plugins/Editor/State+fields)
- [Marcus Olsson — View Plugins](https://marcusolsson.github.io/obsidian-plugin-docs/editor/extensions/view-plugins)
- [Marcus Olsson — Decorations](https://marcusolsson.github.io/obsidian-plugin-docs/editor/extensions/decorations)
- [CodeMirror 6 System Guide](https://codemirror.net/docs/guide/)
- [CodeMirror 6 Decoration Example](https://codemirror.net/examples/decoration/)
- [CodeMirror 6 Reference Manual](https://codemirror.net/docs/ref/)
- [Accessing the Vault from a CM Plugin — designdebt.club](https://designdebt.club/accessing-the-vault-from-an-obsidian-codemirror-plugin/)

### NLP Libraries

- [compromise](https://github.com/spencermountain/compromise) — Rule-based NLP
- [wink-nlp](https://github.com/winkjs/wink-nlp) — Statistical NLP
- [wink-eng-lite-web-model](https://github.com/winkjs/wink-eng-lite-web-model)
- [en-pos](https://github.com/FinNLP/en-pos) — Brill TBL tagger (unmaintained)
- [natural](https://naturalnode.github.io/natural/) — Comprehensive NLP toolkit

### IPC & External Process

- [Obsidian Shell Commands Plugin](https://github.com/Taitava/obsidian-shellcommands)
- [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api)
- [spaCy](https://spacy.io/) — Industrial-strength NLP

### Native & WASM

- [Electron Native Code and Swift](https://www.electronjs.org/docs/latest/tutorial/native-code-and-electron-swift-macos)
- [electron-native-code-demos](https://github.com/felixrieseberg/electron-native-code-demos)
- [swift-napi-bindings](https://github.com/LinusU/swift-napi-bindings)
- [spacy-wasm](https://github.com/SyedAhkam/spacy-wasm)

### Prior Art

- [nl-syntax-highlighting](https://github.com/artisticat1/nl-syntax-highlighting) — Existing Obsidian plugin
- [Obsidian Web Worker Example](https://github.com/RyotaUshio/obsidian-web-worker-example)
- [obsidian-cm6-attributes](https://github.com/nothingislost/obsidian-cm6-attributes)
