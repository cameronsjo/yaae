# YAAE Feature Analysis → Fix Plan

## Context

Cameron asked for a feature-by-feature implementation analysis of YAAE (efficiency, edge cases) across: Style Settings integration, prose highlighting (mobile), automatic TOC, and PDF export. Three Explore agents mapped the codebase; the GitHub tracker and the M3 Air's copy (`~/claude-mba/Projects/obsidian-plugins/yaae`) supplied history the local checkout lacks.

**Headline findings:**

1. **Local checkout is 6 commits behind origin/main** — remote already has the prose-highlight mobile disable (#34), code-block decoration fix (#31), PDF body bg/text fix via `export.pdf.theme` (#35, `eed1cc0`), and settings refactors.
2. **Style Settings "doesn't seem to work"** because the largest `@settings` section (~30 `--yaae-print-*` PDF knobs) is **inert**: those variables are consumed only by `packages/print-styles/` CSS, which never ships and never reaches `printToPDF()` (CSS snippets are excluded from Obsidian's PDF pipeline — proven in `docs/field-reports/obsidian-pdf-export-architecture.md`). `docs/theming.md:93` falsely claims the package is "bundled into the PDF export pipeline." The non-PDF knobs (POS colors, dimming, gutter, focus) DO work — they're resolved by live CSS.
3. **Automatic TOC is unimplemented**: `autoToc` exists (`src/document/settings.ts:15`, default `false`) with zero consumers — no UI toggle, no event handler. Only the manual `yaae-generate-toc` command exists.
4. **PDF roughness** = dead snippet package + `@page` margin-box chrome (banners/headers/footers/page numbers) silently failing below Chrome 131 (Obsidian's Chrome varies by *installer* date: 120–132 observed) + hardcoded colors (`var()` illegal in `@page`) that themes can't retint. Fixes filed: #28 (runtime-inject everything) + #29 (position:fixed fallback).
5. **Prose highlighting mobile (#32)**: no static platform block; failure is an uncaptured runtime error. CM6 ejects a ViewPlugin whose `update()` throws — matching the "error / won't load" symptom; the #31 parse-race fix may already have cured it. **#33**: gutter is a fixed `4.5rem`, huge on phones.

Scope confirmed with Cameron: full PDF fix (#28+#29), implement auto-TOC, fix #33, diagnose-first on #32 (acceptable gap if unfixable), make Style Settings knobs live.

---

## Phase 0 — Sync (XS)

1. `git pull` on `main` (fast-forward to `e9b9f28`), `pnpm install`, `pnpm test` baseline.
2. Re-read upstream diffs to `main.ts` / `src/document/settings-tab.ts` / `styles.css` / `src/prose-highlight/highlighter-plugin.ts` before touching them — this plan was drafted against the stale tree; `eed1cc0`'s theme rework especially affects Phase 3's appearance work.

## Phase 1 — Auto TOC (S)

**Files:** `src/document/settings-tab.ts`, `main.ts`, `tests/`. Reuse `generateToc` (`src/document/toc-generator.ts:154`) unchanged.

1. Add `autoToc` toggle to the Layout settings section (beside the "TOC depth" slider, `settings-tab.ts:455-467`).
2. Extend the existing `vault.on('modify')` handler (`main.ts:234-241`) — do not add a second listener:
   - Gate: `autoToc` enabled && markdown file && content matches `TOC_PATTERN` (**regenerate-only semantics** — a note opts in by inserting a TOC once via the command; auto mode keeps it fresh).
   - Debounce per-file (~2 s trailing). Loop guard: skip `vault.modify` when regenerated content === current content (`generateToc` is idempotent, so the modify→modify loop terminates on the first identical pass). Reuse the race-guard pattern from `generateTocForCurrentFile` (`main.ts:463-485`).
3. Tests: toggle renders; regenerates only files with an existing TOC block; identical-content write skipped; debounce collapses bursts; per-file `export.pdf.tocDepth` honored.

## Phase 2 — Mobile fixes (S)

**#33 gutter (CSS-only):** add a layered mobile knob in `styles.css` — `body.is-mobile { --yaae-gutter-width: var(--yaae-gutter-width-mobile, 1.75rem); }` + `@settings` entry, following the established knob-layering idiom. Check marker legibility (H4–H6 = 4–6 `#` glyphs) and reduce marker font-size in the same rule if needed.

**#32 prose highlighting (diagnose-first):**

1. Wrap the highlighter ViewPlugin's `update`/decoration build in try/catch: record last error + stack on the plugin instance and degrade to unhighlighted, instead of letting CM6 eject the plugin.
2. Add command "Copy prose highlighting debug info" (Notice + clipboard) so the mobile error is capturable without remote debugging.
3. Re-test on the phone with #31 in place (temporarily lift the `Platform.isMobile` guard via a hidden toggle or dev build). Works → remove guard, close #32. Fails → capture error via the new command, post to #32, keep the guard (accepted gap, root cause one tap away).

## Phase 3 — PDF overhaul (#28 + #29 + live knobs) (L, ~5–7 focused days)

### 3a. Empirical gate — GO/NO-GO on class scoping (first, needs both Macs)

- Temporary dev command `yaae-debug-print-probe`: adds `yaae-probe-body` to `document.body` + `yaae-probe-view` to the live view container; injects `@media print` probe rules (`body.yaae-probe-body h1 {color:red}`, `.yaae-probe-view h1 {color:blue}`, unscoped `h1 {text-decoration:underline}` as positive control); `MutationObserver` on `document.body` dumps the export-time DOM (does `.print` exist? which element carries `cssclasses`? is `.markdown-preview-sizer` present?).
- Export manually on this Mac (<131) and the work Mac (132). Red H1 → body-class scoping works, themes keep a PDF hook. Only underline → drop class scoping; pure state-baked rules (pipeline ships either way — the gate decides selector style only).
- Validates/re-shuffles the position:fixed slot table below. Record findings as a field report.

### 3b. Bundling (S)

- Move surviving CSS from `packages/print-styles/src/` to `src/document/print-css/` (`typography, tables, links, code, page-break, images, toc, copy-safe, signature-block, appearance`). **Drop** `watermark.css` (dead `.print > div` DOM; runtime already generates watermarks) and `landscape.css` (documented no-op).
- esbuild `loader: {'.css': 'text'}` + ambient `declare module '*.css'`; ~10-line vitest transform plugin so tests import the same files. Delete `packages/print-styles/`, `pnpm-workspace.yaml`, snippet block in `scripts/setup-test-vault.sh:57-63,70`; update README tree.

### 3c. Manager consolidation (L)

Replace `DynamicPdfPrintStyleManager` + `PageChromeManager` with one `PrintStyleManager` facade in `src/document/print/` (`index, state, chrome-version, resolve-vars, base-styles, document-styles, chrome-margin-boxes, chrome-fixed`), owning three `<style>` elements:

| id | content | regenerated on |
| --- | --- | --- |
| `yaae-print-base` | bundled static CSS, knob values baked | onload, `css-change` |
| `yaae-print-document` | per-doc: watermark SVGs, fonts, theme, links mode, copy-safe, compact tables, signature block | onload, `active-leaf-change`, `metadataCache.on('changed')` (active file), settings changes |
| `yaae-print-chrome` | banners/headers/footers/page numbers via Chrome-gated strategy | same |

- **State-baked CSS is the correctness path** (proven `<style>`-injection mechanism); body classes (synced from `deriveCssClasses` on leaf/metadata change, tracked `pdf-*` set, never touching user classes) are an extensibility courtesy per the 3a gate. **No frontmatter writing** — that's the pollution #28 removes.
- New listeners fix a real existing bug: frontmatter edits without a leaf change currently leave stale chrome (no `before-print` hook exists in Obsidian's API, so all three elements stay continuously correct instead).
- Keep `src/schemas/css-bridge.ts` (repurposed: runtime class sync + state derivation). Collapse the 8 settings-tab update call sites to one `refresh()`. Keep the `updatePageChromeFromActiveFile` race guards verbatim.

### 3d. Chrome gate + fixed fallback (M)

- `detectChromeMajor()` from UA once at init (injectable for tests); `>=131` → margin boxes (current output, but banner/chrome text styled from resolved knobs instead of hardcoded `10px`/`#888`); `<131` → `position: fixed` strategy.
- Fixed-slot allocation (validated by 3a; `body::before/::after` are the safe anchors replacing the likely-dead `.print`): classification top/bottom → `body::before`/`body::after`; headers → `.markdown-preview-view::before/::after`; footers → `.markdown-preview-sizer::before/::after`. Signature block vs footer-right collision: existing suppression semantics (signature block suppresses bottom banner) carry over; finalize slots in 3a.
- **Page numbers on <131 degrade to nothing — loudly**: settings-tab notice showing the detected Chrome version, `console.info` at init, docs line. Keep `@page { margin: 1in }` (works everywhere) with padding reserved for the fixed banners.

### 3e. Style Settings liveness (S–M) — the "knobs don't work" fix

- `resolve-vars.ts`: knob table mirroring the `styles.css` `:root` defaults; `resolvePrintVars()` = `getComputedStyle(document.body).getPropertyValue(name).trim() || fallback`.
- Bundled CSS keeps `var(--yaae-print-…)` references; generation string-replaces them with resolved values (regex must handle the two-arg `var(--x, fallback)` form). Bake uniformly — makes knobs work inside `@page` too and keeps generation pure/testable.
- Refresh on `css-change` + re-resolve on `active-leaf-change` (belt and braces for Style Settings write timing).
- Remove placebo knobs from `@settings` (`--yaae-print-page-number-bottom/right`). Declare the two orphaned signature-block knobs (`--yaae-print-sig-margin-top/font-size`) in defaults + `@settings`.

### 3f. Removal / migration (S)

- Remove: `yaae-apply-css-classes` command + `applyCssClassesFromFrontmatter()` (`main.ts:160-170,487-520`); old manager exports (watermark generation moves to `document-styles.ts`).
- Add: `yaae-clean-css-classes` command — strips `pdf-*` from `cssclasses` frontmatter (active file + optional vault-wide sweep). Stale classes are harmless, so cleanup is offered, not forced.

### 3g. Tests (M)

- Unit: generation is pure functions — knob resolution fallbacks; zero remaining `var(--yaae-print-` after baking; state→CSS matrix (port `tests/print-styles.test.ts`); both chrome strategies from one fixture (fixed: `position: fixed`, no `counter(page)`); UA parsing (120/128/132); facade lifecycle. Update `css-structure`, `commands`, `main-lifecycle` tests.
- E2E (wdio Chrome 120 = the fallback path): fixed strategy selected; body classes appear/replace on note switch; frontmatter edit without leaf change refreshes CSS; base element carries baked defaults.
- Manual matrix doc: Chrome 128 (fixed chrome, page-number notice) × Chrome 132 (margin boxes) × Style Settings knob change → re-export shows it × dark/auto theme × signature block.

Known risks: body classes may not reach the print DOM (mitigated: correctness is state-baked); fixed-slot selectors unvalidated until 3a; multi-pane export tracks the active leaf (existing limitation, document it).

## Phase 4 — Style Settings coherence + docs (S)

1. Rewrite `docs/theming.md` §PDF (lines ~91–103): runtime-injected reality, Chrome-version behavior table, un-fixable knob list, class-scoping outcome from 3a.
2. **Verify the precedence claim** (`docs/theming.md:8-14` says theme > snippet > Style Settings): Style Settings injects rules late in `<head>`; at equal specificity, later wins — the claim may be backwards. Test empirically in the test vault, correct the doc. This is the contract the theme-side Fable session needs; hand them the corrected doc + `docs/prose-syntax/color-token-brief.md` (already on remote).
3. File/update GitHub issues to match outcomes: close #26 as upstream limitation or document; update #25 (watermark full-page coverage — probe DOM dump may reveal a better anchor), #32/#33 per Phase 2 results.

## Verification

- `pnpm test` after each phase; `pnpm run build` before any vault testing.
- E2E: `pnpm` wdio suite (Chrome 120) exercises the <131 fallback.
- Manual: test vault via `scripts/setup-test-vault.sh`; PDF export smoke on this Mac + work Mac (132); the acceptance test for the original complaint is **change a Style Settings knob → see it in the exported PDF**.
- Mobile: BRAT/sideload build on the phone for Phase 2 (#32 retest, #33 gutter width).

## Suggested order & commits

Phases 0→1→2 are a day of quick wins (each its own conventional commit / small PR). Phase 3 is the big lift — branch `feat/pdf-runtime-injection`, sub-phase commits, 3a's field report early. Phase 4 rides with 3's PR plus a docs commit. Beta-tag (`[beta]`) before the stable release per the release flow.
