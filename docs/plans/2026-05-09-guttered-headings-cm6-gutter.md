# Fix: Guttered Headings Should Render in a Real Gutter

## Context

The "Guttered headings" feature (toggled via `gutteredHeadings: true`, body class `yaae-guttered-headings`) is meant to push `#` heading markers into the **left gutter — outside the editor content area** — so heading text aligns with body text.

The current implementation is pure CSS (`styles.css:554-566`):
- Adds `padding-left: var(--yaae-gutter-width)` to `.cm-content`
- Negative-margins `.cm-formatting-header` spans into that padding

This means the `#` lives **inside `.cm-content`'s left padding**. When a theme draws a border, background, or visual edge on `.cm-content` (or any container around it), the `#` ends up *inside* that boundary rather than in the gutter — exactly what the screenshot shows.

The right tool for this is a CodeMirror 6 **gutter** — first-class DOM rendered *outside* `.cm-content` (this is how line numbers work). Theme-agnostic by construction.

User decisions confirmed:
- Use a real CM6 gutter (not CSS tweaks)
- Must work across themes

## Approach

Replace the CSS-only implementation with a CM6 gutter extension, registered through a `Compartment` for hot-toggle (mirrors the existing `focusCompartment` pattern in `main.ts:28,92-98,353-368`).

The gutter renders `#`, `##`, … markers next to lines that begin with a Markdown heading. It does so in **both Source Mode and Live Preview** (the old CSS was Source-Mode-only because Live Preview hides the `#` token; a real gutter is independent of in-document tokens, so this becomes a side-benefit).

## Files

### NEW — `src/cm6/guttered-headings.ts`

CM6 extension built on `gutter()` and `GutterMarker` from `@codemirror/view`:

- `class HeadingMarker extends GutterMarker` — `toDOM()` returns a `<span class="yaae-heading-gutter-marker">` with `#`-repeated text; `eq()` compares level for marker reuse
- `lineMarker(view, line)` — read line text via `view.state.doc.lineAt(line.from).text`, regex-test `^(#{1,6})\s`, return new `HeadingMarker(level)` or `null`
- `initialSpacer: () => new HeadingMarker(6)` — reserves width for `######` so the gutter doesn't jitter when scrolling between heading and non-heading regions
- Exported as `gutteredHeadingsExtension(): Extension`
- Use `class: 'yaae-heading-gutter'` so we can style it in CSS

### MODIFY — `main.ts`

- Import `gutteredHeadingsExtension`
- Add `const headingsCompartment = new Compartment();` next to `focusCompartment` (line 28)
- In `onload()` (after the `focusCompartment` registration, ~line 92): `this.registerEditorExtension([headingsCompartment.of(this.settings.gutteredHeadings ? gutteredHeadingsExtension() : [])]);`
- Add `reconfigureGutteredHeadings()` mirroring `reconfigureFocus()` (line 353)
- Update `toggleGutteredHeadings()` (line 377): replace `applyBodyClasses()` call with `reconfigureGutteredHeadings()`
- Remove `BODY_CLASS_GUTTERED_HEADINGS` constant (line 26) and its branch in `applyBodyClasses()` (line 347-350) — `applyBodyClasses` now only handles syntax dimming
- Settings tab toggle (line 658-659) needs to call the reconfigure path too

### MODIFY — `styles.css`

- **Remove** lines 543-566 (old `.yaae-guttered-headings` rules)
- **Keep** `--yaae-gutter-width: 4.5rem` at line 398 — repurpose it for the gutter element width
- **Add** rules for the new gutter:
  ```css
  .cm-gutterElement.yaae-heading-gutter,
  .cm-gutter.yaae-heading-gutter { width: var(--yaae-gutter-width); }
  .yaae-heading-gutter-marker {
    display: inline-block;
    width: 100%;
    text-align: right;
    padding-right: 0.5rem;
    box-sizing: border-box;
    color: var(--text-faint);
    font-family: var(--font-monospace);
  }
  ```
  (Exact selector chain confirmed during implementation against actual CM6 DOM.)

### MODIFY — `tests/css-structure.test.ts` (lines 16-32)

Replace the old `.yaae-guttered-headings .cm-content` and `.cm-formatting-header` regex assertions with checks for `.yaae-heading-gutter` / `.yaae-heading-gutter-marker`. The test only verifies presence of the rules, not their behavior.

### MODIFY — `e2e/specs/smoke.e2e.ts` (lines 76-107)

Update the heading-formatting check: instead of asserting `.cm-formatting-header` width, assert that toggling the setting causes a `.cm-gutter.yaae-heading-gutter` to appear/disappear in the editor DOM, and that lines starting with `#` get a corresponding `.cm-gutterElement` containing a `.yaae-heading-gutter-marker`.

## Reused Infrastructure

- **Compartment toggle pattern** — `focusCompartment` (main.ts:28, 92-98, 353-368) is the exact template
- **Settings persistence** — `gutteredHeadings: boolean` already exists in `src/types.ts:77,86`, no schema change
- **Command + setting toggle wiring** — `toggleGutteredHeadings` (main.ts:377-381) and the settings tab toggle (main.ts:653-660) already exist; only their bodies change

## Out of Scope

- Reading View — `#` markers don't exist in rendered Reading View; gutter is editor-only
- Custom marker glyphs (e.g., `H1`, `§1`) — current behavior is `#`-repeated text, keep parity
- Per-heading-level styling (e.g., dim deeper levels) — can layer on later via `.yaae-heading-gutter-marker[data-level="3"]`

## Verification

1. `pnpm run build` — type-checks and bundles cleanly
2. `pnpm test` — `tests/css-structure.test.ts` passes against the new selectors
3. Manual in `test-vault`:
   - Open a doc with `#`/`##`/`###` headings
   - Inspect DOM: confirm a `.cm-gutter.yaae-heading-gutter` element exists *outside* `.cm-content`
   - Toggle "Guttered headings" via command palette → gutter appears/disappears live (no editor reload)
   - Switch between Source Mode and Live Preview → markers render in both
   - Apply a theme that borders `.cm-content` (e.g., the user's current setup from the screenshot) → confirm `#` is now outside that border
4. `pnpm run e2e` (or scoped smoke spec) — updated assertions pass
