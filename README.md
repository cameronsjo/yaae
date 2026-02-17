# YAAE — Why Author Anywhere Else

An Obsidian plugin for writers who care about prose. Combines iA Writer-style prose highlighting, readability features, and frontmatter-driven document management into a single plugin.

## Features

### Prose Highlighting

Color-code your writing by part of speech — adjectives, nouns, adverbs, verbs, and conjunctions — to see the structure of your prose at a glance. Inspired by [iA Writer's syntax highlighting](https://ia.net/writer).

- Per-category color customization
- Custom word lists with regex support
- Works in both Editor/Live Preview and Reading View
- Automatically hidden in PDF export

### Readability

- **Syntax dimming** — Reduce opacity of markdown formatting characters (`**`, `*`, `#`, etc.) while keeping them visible
- **Guttered headings** — Outdent `#` markers into the left gutter so heading text aligns with body text
- **Focus mode** — Dim all text except the active sentence or paragraph
- **Typewriter scroll** — Keep the cursor vertically centered as you type

### Document Management

Frontmatter-driven document management with Zod-validated schemas:

- **Classification taxonomy** — Public, Internal, Confidential, Restricted — with color-coded banners in reading view
- **Watermark levels** — Five presets (off → screaming) for draft documents
- **Schema validation** — Auto-validate frontmatter on save with smart warnings (e.g., "draft without watermark", "confidential without reviewers")
- **Specialized schemas** — ADR, threat model, runbook, and slides templates with required field validation
- **Table of contents** — Generate GitHub-compatible TOC from headings, inserted after frontmatter
- **CSS class derivation** — Apply `cssclass` values from frontmatter for PDF export styling

### Print Styles

CSS snippets for Obsidian's PDF export (`@yaae/print-styles`):

- Classification banners and watermarks
- Typography presets
- TOC, links, code blocks, page breaks, page numbers, and image handling

## Installation

### From BRAT (Beta)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat)
2. Add `cameronsjo/yaae` as a beta plugin
3. Enable the plugin in Settings → Community Plugins

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/cameronsjo/yaae/releases)
2. Create `<vault>/.obsidian/plugins/yaae/`
3. Copy the three files into that directory
4. Enable the plugin in Settings → Community Plugins

## Commands

| Command | Description |
|---------|-------------|
| Toggle prose highlighting | Enable/disable part-of-speech coloring |
| Toggle syntax dimming | Dim markdown formatting characters |
| Toggle guttered headings | Outdent heading markers to gutter |
| Cycle focus mode | Off → Sentence → Paragraph |
| Toggle typewriter scroll | Keep cursor vertically centered |
| Validate frontmatter | Check active file against Zod schemas |
| Generate table of contents | Insert/replace TOC from headings |
| Apply CSS classes from frontmatter | Derive and set `cssclass` for PDF export |

## Development

```bash
pnpm install             # Install all workspace dependencies
pnpm run dev             # Watch mode (hot reload)
pnpm run build           # Production plugin bundle
pnpm test                # Run all tests
pnpm run test:watch      # Watch mode tests
pnpm run test:coverage   # Coverage report
```

### Project Structure

```
├── main.ts                   # Plugin entry point
├── src/
│   ├── types.ts              # Shared types and defaults
│   ├── schemas/              # Zod frontmatter schemas
│   ├── document/             # Document management (settings, TOC, banner)
│   ├── prose-highlight/      # POS highlighting engine
│   └── cm6/                  # CodeMirror 6 extensions
├── packages/
│   └── print-styles/         # @yaae/print-styles — PDF export CSS
├── templates/                # Document templates (ADR, threat model, etc.)
└── tests/                    # Vitest tests
```

## License

MIT
