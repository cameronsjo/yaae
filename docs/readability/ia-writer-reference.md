# iA Writer — Markdown Readability & Focus Reference

iA Writer is widely regarded as the gold standard for Markdown editing UX. This document captures the key design patterns worth studying for YAAE.

## Philosophy: "Style, Don't Hide"

iA Writer's core principle is to **keep all Markdown formatting characters visible** but make them visually subdued through styling and color.

> "Don't hide the formatting characters; just style/color them."
> — iA (["Markdown and the Slow Fade of the Formatting Fetish"](https://ia.net/topics/markdown-and-the-slow-fade-of-the-formatting-fetish))

This stands in contrast to two other common approaches:

| Approach | Example Editors | iA's Critique |
|---|---|---|
| **Full WYSIWYG** | Google Docs, Notion | Loses the plain-text portability of Markdown |
| **Show/hide on cursor** | Obsidian (default), Typora | Causes "the jiggle" — distracting text reflow as characters appear/disappear, especially around images and links |
| **Always visible + styled** | **iA Writer** | Characters remain stable; the writer is never surprised by layout shifts |

John Gruber (Markdown's creator) endorsed this approach directly:

> "iA Writer is just beautiful. To me, it's the gold standard for Markdown syntax styling — great colors, real italic and bold styling for *italic* and **bold** spans, and, my very favorite touch, outdented #'s for headings."
> — [Daring Fireball (2021)](https://daringfireball.net/2021/03/ia_writer)

---

## Guttered / Outdented Headings

The most distinctive visual feature is how iA Writer handles `#` heading markers.

### What It Looks Like

```
        Body text sits at this alignment.
        Body text continues here.
   ##   Heading Text Also Starts Here
        More body text at the same left edge.
  ###   A Sub-Heading, Still Aligned
        And more body text.
```

- The `#` hash characters are **pushed into the left margin** (outdented into a gutter)
- The heading text stays **left-aligned with body text**
- Document structure is visible without disrupting prose alignment

### Why It Works

This is a classic typographic technique called a **hanging indent** (or **outdent**). It gives the document clear visual hierarchy while maintaining a clean left text edge — the eye can scan the gutter to see structure without the heading markers disrupting the reading flow.

### CSS Implementation

The effect can be achieved in CSS with:

```css
/* Create gutter space on the container */
.editor-content {
  padding-left: 2.5em;
}

/* Pull heading markers into the gutter */
.cm-header .cm-formatting-header {
  display: inline-block;
  width: 2.5em;
  margin-left: -2.5em;
  text-align: right;
  color: var(--text-muted); /* dim the # characters */
}
```

Key techniques:
- `padding-left` on the text container creates the gutter
- Negative `margin-left` or negative `text-indent` pushes markers into the gutter
- Alternatively, a `::before` pseudo-element with `inline-block` and fixed width

---

## Inline Syntax Styling

For inline formatting like `**bold**` and `*italic*`:

| Element | Visible? | Styling |
|---|---|---|
| `**` / `__` around bold | Yes | Dimmed color, text between is **real bold** |
| `*` / `_` around italic | Yes | Dimmed color, text between is *real italic* |
| `[text](url)` links | Yes | Brackets and URL dimmed, link text highlighted |
| `- ` list markers | Yes | Dimmed/colored |
| `` ` `` code backticks | Yes | Dimmed, code content styled |

### "Auto-Markdown"

iA Writer calls this **Auto-Markdown** — the editor gives instant visual feedback on whether formatting is correct. If you type `**bold` without the closing `**`, it won't render as bold, making syntax errors immediately obvious.

### Why Not Hide Characters?

iA argues that hiding characters causes several problems:

1. **"The Jiggle"** — Text reflows when characters appear/disappear at cursor position, especially with images and links
2. **Lost context** — Writers can't see what markup they've applied without placing the cursor
3. **False WYSIWYG** — Pretending to be WYSIWYG while still being plain text creates a confusing middle ground
4. **Formatting errors** — Harder to spot unclosed or malformed syntax

---

## Focus Mode

Focus Mode highlights only the text you're actively working on and **fades everything else to grey**. Three distinct modes are available.

### Sentence Focus

- The sentence at the cursor displays at **full contrast**
- All surrounding text is **dimmed to medium grey** (~40-50% opacity feel)
- As the cursor moves between sentences, the highlight follows
- Sentence boundaries are determined by punctuation (`.` `!` `?`)

```
This text would be dimmed to grey.
This is also dimmed and recessive.
THIS SENTENCE IS AT FULL CONTRAST BECAUSE THE CURSOR IS HERE.
Back to dimmed grey for this text.
More faded text down here.
```

### Paragraph Focus

- The entire paragraph at the cursor displays at **full contrast**
- All other paragraphs are **dimmed/faded**
- Moving the cursor to a different paragraph shifts the highlight
- Useful when you want more context than sentence focus provides

### Typewriter Mode

Typewriter mode is fundamentally different from the other two — it's about **scroll position**, not text dimming:

- The **cursor stays vertically centered** on screen at all times
- As you type or navigate, the **document scrolls** to keep the cursor at the viewport middle
- Mimics a mechanical typewriter where the carriage stays fixed
- Can be enabled **independently** of Sentence/Paragraph focus
- Can also be **combined** with either focus mode

### Dimming Implementation

The dimming works by manipulating text color:

| State | Light Mode | Dark Mode |
|---|---|---|
| **Active text** | Full black (`#000` or near) | Full white (`#fff` or near) |
| **Inactive text** | Medium grey (`~#aaa`) | Dark grey (`~#555`) |

This is essentially a **color shift** on the non-focused text spans — not a CSS `opacity` change on the container (which would also dim backgrounds and borders).

### UX Recommendations from iA

- Focus Mode is for the **writing/creation phase**; turn it off during editing
- Works best in **full-screen mode** to eliminate other distractions
- Combining focus modes with Typewriter scrolling can cause screen jumping during text selection
- Supports both light and dark themes

---

## Syntax Control (Separate Feature)

Distinct from Focus Mode, iA Writer has **Syntax Control** — a linguistic analysis tool.

### What It Does

Highlights parts of speech to aid editing:

- **Adjectives** — highlighted in one color
- **Nouns** — highlighted in another
- **Adverbs** — highlighted (useful for spotting overuse)
- **Verbs** — highlighted
- **Conjunctions** — highlighted
- **Prepositions** — highlighted

### How It Works

- Toggle individual parts of speech on/off
- Selected parts are shown at full contrast
- Everything else is **dimmed** (same dimming principle as Focus Mode)
- Lets the writer process text in chunks, spotting patterns like adverb overuse

This feature is less relevant to YAAE (it requires NLP / part-of-speech tagging), but the **dimming mechanism** is the same as Focus Mode and worth noting.

---

## Summary of Design Patterns for YAAE

| Feature | Complexity | Value |
|---|---|---|
| Guttered/outdented `#` headings | Low (CSS only) | High — clean visual hierarchy |
| Dimmed syntax characters | Medium (CodeMirror decorations) | High — readable prose without hiding syntax |
| Real bold/italic with visible markers | Medium (CodeMirror styling) | High — instant formatting feedback |
| Sentence Focus | Medium-High (sentence detection + decorations) | High — enhanced writing flow |
| Paragraph Focus | Medium (paragraph detection + decorations) | Medium — broader context than sentence |
| Typewriter scrolling | Medium (scroll management) | Medium — personal preference |
| Syntax Control (parts of speech) | Very High (NLP required) | Low priority — out of scope |

---

## Sources

- [Markdown and the Slow Fade of the Formatting Fetish — iA](https://ia.net/topics/markdown-and-the-slow-fade-of-the-formatting-fetish)
- [Daring Fireball: iA Writer — John Gruber](https://daringfireball.net/2021/03/ia_writer)
- [iA Writer Markdown Guide](https://ia.net/writer/support/basics/markdown-guide)
- [iA Writer Focus Mode](https://ia.net/writer/support/editor/focus-mode)
- [iA Writer: Write With Focus](https://ia.net/writer/how-to/write-with-focus)
- [iA Writer Settings](https://ia.net/writer/support/basics/settings)
- [Replacing iA Writer with Obsidian — Anders Noren](https://andersnoren.se/replacing-ia-writer-with-obsidian/)
- [Using iA Writer as an End-to-End Writing System — Decoding](https://decoding.io/2023/12/using-ia-writer-as-an-end-to-end-writing-system/)
- [How I Use iA Writer Pro Syntax Control — Sayz Lim](https://sayzlim.net/editing-ia-writer-pro-syntax-control/)
- [iA Writer Markdown Reference — Markdown Guide](https://www.markdownguide.org/tools/ia-writer/)
- [Font-independent pixel-perfect negative CSS text-indents — Ctrl blog](https://www.ctrl.blog/entry/css-negative-text-indent.html)
