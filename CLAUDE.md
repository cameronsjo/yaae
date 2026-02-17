# YAAE — Why Author Anywhere Else

An Obsidian plugin. Uses TypeScript, esbuild, Vitest, and pnpm workspaces.

## Commands

```bash
pnpm install             # Install all workspace dependencies
pnpm run dev             # Watch mode (hot reload)
pnpm run build           # Build schemas + production plugin bundle
pnpm run build:schemas   # Build @doc-forge/schemas only
pnpm test                # Run plugin tests
pnpm run test:schemas    # Run schemas package tests
pnpm run test:all        # Run all tests (plugin + schemas)
pnpm run test:watch      # Watch mode tests
pnpm run test:coverage   # Coverage report
```

## Project Structure

```
├── main.ts                          # Plugin entry point
├── src/                             # Plugin source code
│   ├── types.ts                     # Shared types and defaults
│   ├── doc-forge/                   # Doc Forge integration
│   │   ├── settings.ts              # Doc Forge settings interface
│   │   ├── toc-generator.ts         # Table of contents generation
│   │   ├── classification-banner.ts # Reading view classification banner
│   │   └── settings-tab.ts          # Doc Forge settings UI
│   ├── prose-highlight/             # iA Writer-style prose highlighting
│   └── cm6/                         # CodeMirror 6 extensions
├── packages/                        # pnpm workspace packages
│   ├── doc-schemas/                 # @doc-forge/schemas — Zod frontmatter schemas
│   │   ├── src/
│   │   │   ├── classification.ts    # Classification taxonomy (4 levels)
│   │   │   ├── watermark.ts         # Watermark levels (5 presets)
│   │   │   ├── schema.ts            # Core + specialized Zod schemas
│   │   │   ├── validation.ts        # validateMarkdown(), extractFrontmatter()
│   │   │   ├── css-bridge.ts        # deriveCssClasses()
│   │   │   └── index.ts             # Public exports
│   │   └── tests/
│   └── print-styles/                # @doc-forge/print-styles — PDF export CSS
│       └── src/
│           ├── presets/             # classification.css, watermark.css, typography.css
│           └── components/          # toc, links, code, page-break, page-numbers, images
├── templates/                       # Document templates
│   ├── notes/                       # threat-model, adr, one-pager
│   └── slides/                      # tech-talk
├── tests/                           # Plugin Vitest tests
├── styles.css                       # Plugin styles
├── manifest.json                    # Obsidian plugin manifest
├── pnpm-workspace.yaml              # Workspace config
├── esbuild.config.mjs               # Build config
└── vitest.config.ts                 # Test config
```

## Conventions

- Strict TypeScript (`strict: true`)
- Use `registerEvent()` for all Obsidian event handlers (auto-cleanup)
- Type guard `TAbstractFile` before file operations
- Conventional commits: `feat:`, `fix:`, `chore:`, etc.
- Build artifacts (`main.js`, `packages/*/dist/`) are gitignored — CI builds them
- `@doc-forge/schemas` is a workspace dependency (`workspace:*`) bundled by esbuild

## Doc Forge

Frontmatter-driven document management integrated into the plugin:

- **Schemas**: Zod-based frontmatter validation with classification taxonomy and smart warnings
- **Print Styles**: CSS snippets for Obsidian PDF export (classification banners, watermarks, typography)
- **Plugin Commands**: Validate frontmatter, Generate TOC, Apply CSS classes from frontmatter
- **Auto-behaviors**: Validate on save (console-only), classification banner in reading view

## Release Flow

1. **Beta**: Add `[beta]` to commit message → BRAT prerelease
2. **Stable**: Merge Release Please PR → GitHub release with assets
