# YAAE — Why Author Anywhere Else

An Obsidian plugin. Uses TypeScript, esbuild, Vitest, and pnpm.

## Commands

```bash
pnpm install             # Install dependencies
pnpm run dev             # Watch mode (hot reload)
pnpm run build           # Production plugin bundle
pnpm test                # Run all tests
pnpm run test:watch      # Watch mode tests
pnpm run test:coverage   # Coverage report
```

```bash
bash scripts/mutate-structural-tests.sh   # Prove the structural tests can fail
```

## Structural tests

Several suites (`main-lifecycle`, `commands`, `auto-toc`, `prose-highlight-debug`)
check wiring by matching `main.ts` and `highlighter-plugin.ts` **as text**, because
those files pull in CM6 imports that need browser DOM globals. Two consequences
worth knowing before editing them:

- They are sensitive to formatting, not just behavior. A quote-style reformat in
  `31c2418` reddened 15 of them at once while nothing broke, and CI stayed red for
  two weeks (#51). Every quoted literal in a pattern is therefore written
  `["']…["']` so a future formatter cannot repeat it.
- A pattern of the form `/ANCHOR[\s\S]*?TARGET/` run against a whole file will
  happily match a `TARGET` that lives somewhere else entirely. That is how the
  reading-view mobile gate ended up unguarded: deleting it left the suite green.
  Bound such assertions by position (`indexOf` from the anchor, asserted to fall
  before a known-inside marker) rather than by a lazy scan.

`scripts/mutate-structural-tests.sh` deletes each pinned behavior in turn and
fails if the suite stays green. Run it after changing one of these tests.

## Project Structure

```
├── main.ts                          # Plugin entry point
├── src/                             # Plugin source code
│   ├── types.ts                     # Shared types and defaults
│   ├── schemas/                     # Zod frontmatter schemas
│   │   ├── classification.ts        # Classification taxonomy (4 levels)
│   │   ├── watermark.ts             # Watermark levels (5 presets)
│   │   ├── schema.ts                # Core + specialized Zod schemas
│   │   ├── validation.ts            # validateMarkdown(), extractFrontmatter()
│   │   ├── css-bridge.ts            # deriveCssClasses()
│   │   └── index.ts                 # Public exports
│   ├── document/                    # Document management integration
│   │   ├── settings.ts              # Document settings interface
│   │   ├── toc-generator.ts         # Table of contents generation
│   │   ├── classification-banner.ts # Reading view classification banner
│   │   ├── settings-tab.ts          # Document settings UI
│   │   └── print-css/               # PDF export CSS (bundled as text, runtime-injected)
│   ├── prose-highlight/             # iA Writer-style prose highlighting
│   └── cm6/                         # CodeMirror 6 extensions
├── templates/                       # Document templates
│   ├── notes/                       # threat-model, adr, one-pager
│   └── slides/                      # tech-talk
├── tests/                           # Vitest tests
├── styles.css                       # Plugin styles
├── manifest.json                    # Obsidian plugin manifest
├── esbuild.config.mjs               # Build config
└── vitest.config.ts                 # Test config
```

## Conventions

- Strict TypeScript (`strict: true`)
- Use `registerEvent()` for all Obsidian event handlers (auto-cleanup)
- Type guard `TAbstractFile` before file operations
- Conventional commits: `feat:`, `fix:`, `chore:`, etc.
- Build artifacts (`main.js`) are gitignored — CI builds them
- Schemas live in `src/schemas/` and are bundled directly by esbuild
- Print CSS lives in `src/document/print-css/` and is bundled as raw text
  (esbuild `loader: { '.css': 'text' }`) — CSS snippets never reach
  Obsidian's `printToPDF()`, so all print CSS is runtime-injected

## Document Management

Frontmatter-driven document management integrated into the plugin:

- **Schemas**: Zod-based frontmatter validation with classification taxonomy and smart warnings
- **Print Styles**: runtime-injected `<style>` CSS for Obsidian PDF export (classification banners, watermarks, typography)
- **Plugin Commands**: Validate frontmatter, Generate TOC, Apply CSS classes from frontmatter
- **Auto-behaviors**: Validate on save (console-only), classification banner in reading view, automatic TOC updates (opt-in per note by inserting a TOC once; debounced regeneration on save)

## Release Flow

1. **Beta**: Add `[beta]` to commit message → BRAT prerelease
2. **Stable**: Merge Release Please PR → GitHub release with assets
