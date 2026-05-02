# Theming YAAE

YAAE exposes its visual tunables as CSS custom properties. Theme authors and
snippet writers can override any of them without fighting plugin specificity.

## How to override

Three ways, in order of precedence:

1. **Theme CSS** — `body.theme-dark { --yaae-pos-noun-color-dark: #ff8866; }` in
   your theme file. Higher specificity than the plugin's defaults; cleanest path.
2. **CSS snippet** — same as above, dropped into `.obsidian/snippets/yours.css`.
3. **Style Settings plugin** — install it; YAAE registers all knobs via the
   `@settings` block in `styles.css`. Pick colors and sizes through Obsidian UI.

The plugin itself does not edit the unsuffixed variable names below at runtime
(except a one-shot migration for users who customized POS colors before the
light/dark refactor). That means your `body.theme-dark` overrides win.

## Variable layering

Each themable color uses a layered pattern:

```css
body { --yaae-pos-noun-color: var(--yaae-pos-noun-color-light, #ce4924); }
body.theme-dark { --yaae-pos-noun-color: var(--yaae-pos-noun-color-dark, #e87a5f); }
```

- `--yaae-pos-noun-color` — the **public** name feature CSS reads. Don't
  override this directly unless you want to force the same color across light
  and dark themes.
- `--yaae-pos-noun-color-light` / `-dark` — the **knobs**. Override these to
  recolor per-theme.

## Editor — Prose Highlighting

Five POS categories. Defaults inspired by iA Writer for light, brighter
desaturated equivalents for dark.

| Variable                                | Default (light) | Default (dark) |
| --------------------------------------- | --------------- | -------------- |
| `--yaae-pos-adjective-color-{light,dark}`  | `#b97a0a`      | `#f0b150`      |
| `--yaae-pos-noun-color-{light,dark}`       | `#ce4924`      | `#e87a5f`      |
| `--yaae-pos-adverb-color-{light,dark}`     | `#c333a7`      | `#e07cc8`      |
| `--yaae-pos-verb-color-{light,dark}`       | `#177eb8`      | `#5cb0e8`      |
| `--yaae-pos-conjunction-color-{light,dark}`| `#01934e`      | `#4cc887`      |

## Editor — Focus Mode

| Variable                            | Default                |
| ----------------------------------- | ---------------------- |
| `--yaae-dimmed-color-{light,dark}`  | `var(--text-faint)`    |
| `--yaae-dimmed-transition`          | `0.15s`                |

The dimmed color falls through to Obsidian's `--text-faint`, which themes
already paint correctly per mode. Override only if you want a non-faint hue.

## Editor — Syntax Dimming and Headings

| Variable                                  | Default |
| ----------------------------------------- | ------- |
| `--yaae-syntax-dimming-opacity`           | `0.3`   |
| `--yaae-syntax-dimming-active-opacity`    | `0.7`   |
| `--yaae-gutter-width`                     | `4.5rem`|

These don't have light/dark variants — they're scalar tunables, not colors.

## Reading View — Classification Banner

Banner colors come from the active classification's `color`/`background`
(plus optional `colorDark`/`backgroundDark`) and flow through inline custom
properties on the banner element:

```css
.yaae-classification-banner {
  background: var(--yaae-banner-bg);
  color: var(--yaae-banner-color);
  border: 1px solid var(--yaae-banner-color);
}

body.theme-dark .yaae-classification-banner {
  background: var(--yaae-banner-bg-dark, var(--yaae-banner-bg));
  color: var(--yaae-banner-color-dark, var(--yaae-banner-color));
  border-color: var(--yaae-banner-color-dark, var(--yaae-banner-color));
}
```

Theme authors can override the banner styles entirely by targeting
`.yaae-classification-banner` (and its `body.theme-dark` variant).

## PDF Print Styles

Print styles live in `packages/print-styles/` and are bundled into Obsidian's
PDF export pipeline. They expose ~30 tunables under the `PDF Print Styles`
heading in the Style Settings plugin (`code`, `links`, `page-numbers`, `tables`,
`toc`, `header-footer`, `dark`, `banner`, `typography` sub-sections).

PDF dark mode uses three classes — `pdf-theme-light`, `pdf-theme-dark`,
`pdf-theme-auto` — set by document frontmatter `export.pdf.theme`. The
`pdf-theme-auto` class respects `@media (prefers-color-scheme: dark)` at print
time. `@page` margin boxes (classification banner, page numbers) cannot read
CSS custom properties, so banner colors are baked in at generation time based
on the active theme.
