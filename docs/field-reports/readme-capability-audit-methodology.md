# README Capability Audit Methodology — Field Report

**Date:** 2026-03-26
**Type:** discovery
**Project:** YAAE (cameronsjo/yaae)

## Goal

Verify that every feature claimed in the README actually works — not just that the code exists, but that the feature is observable in a running Obsidian instance. Build test infrastructure to catch regressions and make future verification repeatable.

## What We Tried

### Phase 1: Static Code Analysis

Grepped the codebase for every README claim — command registrations, CSS selectors, CM6 extensions, schema definitions, post-processors. Built a matrix of "claimed vs code exists."

**Result:** Everything had code. All 8 commands registered, all CSS selectors present, all schemas defined. This created a false sense of confidence — 100% of claims had matching code.

### Phase 2: Structural Automated Tests

Added unit tests that verify wiring without running Obsidian:
- **Command registration** — parse `main.ts` for `addCommand` calls, verify all documented commands exist
- **CSS structure** — read `styles.css` as text, verify selectors and properties exist
- **Body class toggles** — test that toggle functions flip the right classes
- **Default settings** — verify defaults match README claims

**Result:** 27 new tests, all passing. Still didn't prove features *work* — just that the code is wired up.

### Phase 3: WebdriverIO E2E Tests

Installed `wdio-obsidian-service` to launch real Obsidian with the plugin installed. Tests create notes, execute commands, inspect DOM.

**Result:** 13 E2E tests, all passing. Confirmed plugin loads, commands execute, body classes toggle, classification banner renders in Reading View, TOC generation works. This was the first layer where "works" means "observable in Obsidian."

### Phase 4: Manual Smoke Test in Test Vault

Created a test vault (`test-vault/`) with 13 seed documents — one per feature — and a checklist doc. Symlinked build output for hot reload. Walked through every feature manually.

**Result:** This is where the real bugs surfaced.

## What Worked

- **Test vault with seed documents** — each document exercises a specific feature with the right frontmatter, headings, and content. Makes retesting fast.
- **Setup script** (`scripts/setup-test-vault.sh`) — idempotent, creates symlinks and `.hotreload` marker. One command to set up.
- **WebdriverIO E2E** — `wdio-obsidian-service` is the real deal. Downloads Obsidian, installs the plugin, provides `browser.executeObsidian()` for API access. Tests run in ~12 seconds.
- **Diagnostic CSS injection** — when watermarks didn't render, injecting `h1 { color: red !important; }` via the plugin's `<style>` element proved that plugin-injected `@media print` works while snippet CSS doesn't. Simple, conclusive.

## What Didn't Work

- **Assuming "code exists" means "works"** — every feature had complete code. Guttered headings had CSS, a command, a toggle, settings UI. Still broken in practice (wrong gutter width, clipping, wrong CSS parent selector for Live Preview).
- **CSS snippets for PDF export** — Obsidian's `printToPDF()` does NOT include CSS from `.obsidian/snippets/`. This means the entire `@yaae/print-styles` package was a dead end for PDF features. Everything must be injected via plugin `<style>` elements.
- **`@page` margin boxes** — the PageChromeManager generates correct CSS, but Obsidian ships Chrome 128 and `@page` margin boxes need Chrome 131+. The feature works on some machines (user's work laptop has Chrome 132) but not others. Varies by Obsidian installer version.

## Gotchas

1. **`em` units in heading CSS resolve to the heading's font size**, not the parent's. A `4em` gutter width on an H1 formatting span is much wider than `4em` on `.cm-content`. Use `rem` for anything that must be consistent across heading levels.

2. **`.is-live-preview` class is on `.markdown-source-view`**, not `.cm-editor`. CSS targeting `.cm-editor:not(.is-live-preview)` silently fails.

3. **Obsidian's frontmatter property is `cssclasses` (plural)**, not `cssclass` (singular). The singular form was deprecated.

4. **The `created` field is required by the Zod schema** with no default. Every test document needs it or validation fails — which blocks the "Apply CSS classes" command.

5. **Chrome version varies across Obsidian installs.** The installer version (not the app version) determines the Electron/Chromium bundle. User's personal Mac: Chrome 128. Work Mac: Chrome 132. Same Obsidian app version, different capabilities.

## Pipeline Overview

The audit follows a verification funnel — each layer catches different classes of bugs:

```
Static analysis    → "Does the code exist?"        → Catches missing/renamed code
Structural tests   → "Is it wired up?"              → Catches broken imports, dead toggles
E2E tests          → "Does it execute in Obsidian?" → Catches runtime errors, API misuse
Manual smoke test  → "Does it look right?"           → Catches CSS bugs, visual regressions, platform issues
```

Each layer found bugs the previous layer missed. The manual smoke test — the most "primitive" method — found the most impactful bugs (guttered headings clipping, watermark selectors, Chrome version mismatch).

## Recommendations

- **Always smoke test CSS features in a real vault.** Structural tests verify selectors exist but can't verify they render. There's no substitute for eyeballs on the output.
- **Inject all print CSS via plugin `<style>` elements.** CSS snippets don't reach PDF export. Don't rely on them for any print feature.
- **Use `rem` for cross-element sizing.** Anywhere a CSS value is shared between elements with different font sizes (headings, body text), `em` will diverge. `rem` stays consistent.
- **Check `navigator.userAgent` for Chrome version** before using newer CSS features. Obsidian's Chrome version varies by installer date.
- **Test vault seed documents should include all required schema fields.** Missing `created`, `classification`, or `tags` causes silent validation failures that block dependent features.

## Key Takeaways

- "Code exists" and "tests pass" are necessary but not sufficient for CSS/visual features — manual verification in the target runtime is irreplaceable
- Obsidian's PDF export pipeline has significant limitations: CSS snippets excluded, Chrome version varies, `@page` margin boxes not yet supported on most installs
- A test vault with seed documents + a setup script is low-cost, high-value infrastructure — invest in it early
- WebdriverIO E2E via `wdio-obsidian-service` fills the gap between unit tests and manual testing — 12-second runs that catch runtime errors
- The verification funnel (static → structural → E2E → manual) should be the standard approach for any Obsidian plugin audit
