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
| signatureBlock   | boolean                           | `false`  | ✗      | ✓       |
| **Branding**     |                                   |          |        |         |
| watermark        | enum (5 levels)                   | `"off"`  | ✓ *    | ✓       |
| classification   | string                            | varies   | ✓      | ✓       |
| headerLeft       | string                            | `""`     | ✓      | ✓       |
| headerRight      | string                            | `""`     | ✓      | ✓       |
| footerLeft       | string                            | `""`     | ✓      | ✓       |
| footerRight      | string                            | `""`     | ✓      | ✓       |

\* watermark global default only applies to `status: draft` docs

`landscape`, `toc`, and `signatureBlock` are per-doc only — it doesn't make sense to default all documents to landscape or to all have signature blocks.

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
| `links: "stripped"`     | `pdf-links-stripped`    | Remove `<a>` tags      |
| `signatureBlock: true`  | `pdf-signature`        | Render sign-off area   |

Same pattern as existing `pdf-watermark-loud`, `pdf-no-links`, etc.

## Settings UI Grouping

```
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

## Open Questions

1. **`stripped` links**: Requires DOM manipulation (MarkdownPostProcessor or pre-export hook), unlike all other toggles which are pure CSS. Is `plain` (CSS-only, visually identical) sufficient?

2. **Signature block content**: Blank lines for pen signatures, or structured frontmatter fields (`preparedBy`, `approvedBy`, `date`)?

3. **`copyPasteSafe` as always-on**: Ligature-free text is visually identical at print sizes. Consider baking into base print CSS instead of exposing as a toggle.
