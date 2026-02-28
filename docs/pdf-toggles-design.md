# PDF Toggles & Customizability — Design Doc

## Two-Layer Toggle Model

Every feature follows the same resolution pattern:

1. **Settings** (global defaults) — applies to all documents
2. **Frontmatter** (per-document) — overrides settings for a specific document

```yaml
# Frontmatter override example
export:
  pdf:
    links: "expand"
```

Configure once in settings, forget about it. Override in frontmatter only when a specific document needs something different.

## Toggle Map

| Toggle           | Type                              | Default  | Global | Per-doc |
|------------------|-----------------------------------|----------|--------|---------|
| **Appearance**   |                                   |          |        |         |
| theme            | `"light"` \| `"dark"` \| `"auto"` | `"light"` | ✓    | ✓       |
| fontFamily       | `"sans"` \| `"serif"` \| `"mono"` \| `"system"` | `"sans"` | ✓ | ✓ |
| fontSize         | number (pt)                       | `11`     | ✓      | ✓       |
| **Text Quality** |                                   |          |        |         |
| copyPasteSafe    | boolean                           | `true`   | ✓      | ✓       |
| **Links**        |                                   |          |        |         |
| links            | `"expand"` \| `"styled"` \| `"plain"` \| `"stripped"` | `"expand"` | ✓ | ✓ |
| **Tables**       |                                   |          |        |         |
| compactTables    | boolean                           | `true`   | ✓      | ✓       |
| **Layout**       |                                   |          |        |         |
| landscape        | boolean                           | `false`  | ✗      | ✓       |
| pageNumbers      | boolean                           | `true`   | ✓      | ✓       |
| skipCover        | boolean                           | `false`  | ✓      | ✓       |
| **Content**      |                                   |          |        |         |
| toc              | boolean                           | `false`  | ✗      | ✓       |
| tocDepth         | 1–6                               | `3`      | ✓      | ✓       |
| lineHeight       | number (1.0–3.0)                  | `1.6`    | ✓      | ✓       |
| **Branding**     |                                   |          |        |         |
| watermark        | enum (5 levels)                   | `"off"`  | ✓ *    | ✓       |
| watermarkText    | string                            | `"DRAFT"` | ✓    | ✓       |
| classification   | string                            | varies   | ✓      | ✓       |
| headerLeft       | string                            | `""`     | ✓      | ✓       |
| headerRight      | string                            | `""`     | ✓      | ✓       |
| footerLeft       | string                            | `""`     | ✓      | ✓       |
| footerRight      | string                            | `""`     | ✓      | ✓       |

\* watermark global default only applies to `status: draft` docs

`landscape` and `toc` are per-doc only — it doesn't make sense to default all documents to landscape or to all have a TOC.

## Links Enum

Replaces the two booleans (`expandLinks`, `plainLinks`) with a single enum:

| Value       | Behavior                                            |
|-------------|-----------------------------------------------------|
| `"expand"`  | URL shown after link text, blue + underlined        |
| `"styled"`  | Link text only, blue + underlined                   |
| `"plain"`   | Link text only, no color or underline, still `<a>`  |
| `"stripped"` | `<a>` tag removed, pure text                       |

Migration strategy: **additive**. Keep `expandLinks`/`plainLinks` working as aliases, add `links` enum as the preferred way. `links` takes precedence if present. Deprecate the booleans over time.

## Font Presets

Named presets that map to safe system font stacks:

| Preset     | Stack                                                                 |
|------------|-----------------------------------------------------------------------|
| `"sans"`   | -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif |
| `"serif"`  | Georgia, "Times New Roman", Times, serif                              |
| `"mono"`   | "SFMono-Regular", Consolas, "Courier New", monospace                  |
| `"system"` | No override — uses whatever the OS/theme provides                     |

If value matches a preset name, expand it. Otherwise treat as raw `font-family` string for advanced users.

## CSS Class Derivation

Each toggle maps to a CSS class for the print-styles package:

| Toggle                  | CSS Class              | Effect                 |
|-------------------------|------------------------|------------------------|
| `theme: "dark"`         | `pdf-theme-dark`       | Force dark colors      |
| `fontFamily: "serif"`   | `pdf-font-serif`       | Serif font stack       |
| `copyPasteSafe: true`   | `pdf-copy-safe`        | Ligatures off          |
| `compactTables: true`   | `pdf-compact-tables`   | Auto-shrink tables     |
| `landscape: true`       | `pdf-landscape`        | `@page` landscape      |
| `links: "plain"`        | `pdf-links-plain`      | Strip link styling     |
| `links: "stripped"`     | `pdf-links-stripped`   | Remove `<a>` tags      |

Same pattern as existing `pdf-watermark-loud`, `pdf-no-links`, etc.

## Settings UI Grouping

```text
── Classification ──
  Default classification, banner toggle, banner position

── PDF Appearance ──
  Theme, font, font size

── PDF Text ──
  Links mode, copy-paste safe, compact tables

── PDF Layout ──
  Page numbers, skip cover, TOC depth

── PDF Branding ──
  Draft watermark, header/footer strings

── Validation ──
  Validate on save
```

## CSS Custom Properties

All hardcoded values in the print CSS pipeline are exposed as `--yaae-print-*` CSS custom properties, overridable via the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin or user CSS snippets.

| Category | Properties |
|----------|-----------|
| Code Blocks | `--yaae-print-code-border-color`, `--yaae-print-code-border-radius`, `--yaae-print-code-padding`, `--yaae-print-code-bg`, `--yaae-print-code-font-size` |
| Links | `--yaae-print-link-url-font-size`, `--yaae-print-link-url-color` |
| Page Numbers | `--yaae-print-page-number-bottom`, `--yaae-print-page-number-right`, `--yaae-print-page-number-font-size`, `--yaae-print-page-number-color` |
| Tables | `--yaae-print-table-font-size`, `--yaae-print-table-cell-padding` |
| TOC | `--yaae-print-toc-indent`, `--yaae-print-toc-item-margin`, `--yaae-print-toc-line-height` |
| Header/Footer | `--yaae-print-header-footer-font-size`, `--yaae-print-header-footer-color` |
| Dark Theme | `--yaae-print-dark-bg`, `--yaae-print-dark-text`, `--yaae-print-dark-heading-color`, `--yaae-print-dark-code-bg`, `--yaae-print-dark-table-border` |
| Banners | `--yaae-print-banner-font-size`, `--yaae-print-banner-letter-spacing`, `--yaae-print-banner-padding` |
| Typography | `--yaae-print-widows`, `--yaae-print-orphans` |

**Not exposed as CSS variables** (handled by dynamic style managers):
- `--print-font-size` and `--print-line-height` — set by `DynamicPdfPrintStyleManager`
- Watermark SVG data URIs — generated dynamically from `watermarkText` setting
- Built-in classification colors — semantic identity, not cosmetic (custom classifications use the color picker UI)

## Resolved Decisions

1. **`stripped` links**: Yes — requires DOM manipulation (MarkdownPostProcessor) to unwrap `<a>` tags. Worth the complexity for security-focused documents.
2. **`copyPasteSafe`**: Stays as a toggle, not always-on.
3. **Signature block**: Deferred — tracked as a bead.
4. **Defanged links** (`hxxps://`, `[.]`): Deferred — tracked as a bead.
