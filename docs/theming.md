# Theming YAAE — theming contract v1

YAAE exposes its visual tunables as CSS custom properties. Theme authors and
snippet writers can override any of them without fighting plugin specificity.

> **Contract v1** (2026-07-05). This document is a two-sided interface: the
> Artificer Obsidian theme's ADR 0035
> (`artificer-design-system/docs/decisions/0035-obsidian-yaae-layered-variable-contract.md`)
> cites it as the normative model, and that theme's `doctor:vault` check greps
> for the ten POS knob declarations. The layered variable model below ships in
> plugin ≥ 0.1.0 (beta.95). Breaking changes to variable names or layering
> bump the contract version.

## How to override — the precedence ladder

From weakest to strongest (later wins):

```
plugin fallback hexes  <  theme knob supply  <  user snippet  <  Style Settings
```

1. **Plugin fallbacks** — the hex defaults baked into `styles.css` `var()`
   fallbacks. Lose to everything.
2. **Theme CSS** — `body.theme-dark { --yaae-pos-noun-color-dark: #ff8866; }`
   in a theme. Themes load before snippets and Style Settings, so they lose
   to both.
3. **CSS snippet** — same rule in `.obsidian/snippets/yours.css`. Snippets
   load after the theme.
4. **Style Settings plugin** — YAAE registers all knobs via the `@settings`
   block in `styles.css`. Style Settings emits under
   `body.css-settings-manager` in a style element loaded after the theme, so
   it outranks theme CSS. Highest tier.

(Verified against live load order by the Artificer theme session, 2026-07-05.
An earlier revision of this doc had the ladder inverted.)

**Hard contract line: the plugin never writes POS color values at runtime.**
Suffixed-knob overrides from any tier always win over plugin defaults.

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

**How it actually works:** Obsidian's `printToPDF()` includes plugin `<style>`
elements only — CSS snippets never reach it, and `var()` is illegal inside
`@page` margin boxes. So YAAE generates all print CSS at runtime into three
injected style elements, with every `--yaae-print-*` knob value **baked in at
generation time**:

| Element | Content | Regenerated on |
|---|---|---|
| `yaae-print-base` | bundled static print CSS | load, `css-change` |
| `yaae-print-document` | active document's state-baked rules | note switch, frontmatter edit, settings |
| `yaae-print-chrome` | banners / headers / footers / page numbers | same |

Changing a knob in Style Settings (or a theme/snippet override) is picked up
on the next `css-change` event — the following export reflects it, no plugin
reload needed. The `--yaae-print-*` knobs work at every tier of the ladder
above because they're read through the live cascade before baking.

**Chrome version matters.** Obsidian's Chrome major comes from the Electron
*installer* date (observed 120–132 across machines):

| Chrome | Banner/header/footer chrome | Page numbers |
|---|---|---|
| ≥ 131 | native `@page` margin boxes | `counter(page)` works |
| < 131 | `position: fixed` pseudo-elements | **unavailable** — the settings tab and console say so with the detected version |

**PDF theming** uses `export.pdf.theme` frontmatter (`light`/`dark`/`auto`).
The active document's appearance is **state-baked** — generated for the open
note without depending on `pdf-*` classes reaching the print DOM. The plugin
also mirrors the state as `pdf-*` classes on `<body>` as an extensibility
hook; whether class-scoped `@media print` selectors survive into the export
DOM is under empirical test (the temporary "Toggle print probe" command —
issue #28). Until that verdict lands, treat state-baked rules as the only
guaranteed path and `pdf-*` classes as best-effort.

`@page` margin boxes cannot read custom properties, so classification banner
colors are baked at generation from the classification's palette
(`colorDark`/`backgroundDark` for dark, a nested `prefers-color-scheme`
override for `auto` — the `and`-combined media query form is silently dropped
by Chromium's print engine).
