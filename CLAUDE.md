# YAAE — Why Author Anywhere Else

An Obsidian plugin. Uses TypeScript, esbuild, and Vitest.

## Commands

```bash
npm run dev          # Watch mode (hot reload)
npm run build        # Production build
npm test             # Run tests
npm run test:watch   # Watch mode tests
npm run test:coverage # Coverage report
```

## Project Structure

```
├── main.ts                       # Plugin entry point
├── src/                          # Source code
│   └── types.ts                  # Shared types and defaults
├── tests/                        # Vitest tests
│   ├── __mocks__/obsidian.ts     # Obsidian API mock
│   └── setup.ts                  # Test setup (browser globals)
├── styles.css                    # Plugin styles
├── manifest.json                 # Obsidian plugin manifest
├── versions.json                 # Version → minAppVersion mapping
├── esbuild.config.mjs            # Build config
├── vitest.config.ts              # Test config
├── release-please-config.json    # Release automation
└── .github/workflows/            # CI, release-please, beta-release
```

## Conventions

- Strict TypeScript (`strict: true`)
- Use `registerEvent()` for all Obsidian event handlers (auto-cleanup)
- Type guard `TAbstractFile` before file operations
- Conventional commits: `feat:`, `fix:`, `chore:`, etc.
- Build artifacts (`main.js`) are gitignored — CI builds them

## Release Flow

1. **Beta**: Add `[beta]` to commit message → BRAT prerelease
2. **Stable**: Merge Release Please PR → GitHub release with assets
