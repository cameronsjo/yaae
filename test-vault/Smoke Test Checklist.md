---
title: YAAE Smoke Test Checklist
classification: internal
status: draft
---

# YAAE Smoke Test Checklist

Manual verification of every feature claimed in the README.
Open each test document and follow the steps.

## Prerequisites

- [ ] Plugin is enabled in Settings > Community Plugins
- [ ] No errors in Developer Console on load (Ctrl+Shift+I / Cmd+Opt+I)

---

## Prose Highlighting

**Test doc:** [[Prose Highlighting Test]]

### Toggle command

- [ ] Open command palette, run "YAAE: Toggle prose highlighting"
- [ ] **Source Mode:** Words are color-coded by POS (adjectives, nouns, adverbs, verbs, conjunctions)
- [ ] **Live Preview:** Same highlighting appears
- [ ] Toggle OFF: highlighting disappears
- [ ] Toggle ON: highlighting returns

### Reading View

- [ ] Switch to Reading View (Ctrl+E / Cmd+E)
- [ ] If "Highlight in Reading View" is enabled in settings, highlighting appears
- [ ] If disabled, no highlighting in Reading View

### Per-category customization

- [ ] Settings > YAAE > Writing > Parts of Speech
- [ ] Toggle individual POS categories OFF — those words lose highlighting
- [ ] Change a color — affected words update immediately
- [ ] Reset color — reverts to default

### Custom word lists

- [ ] Settings > YAAE > Writing > Custom Word Lists
- [ ] Add a list, enter words (e.g., "YAAE, plugin, Obsidian")
- [ ] Words highlight with the chosen color in the editor
- [ ] Toggle list OFF — words lose highlighting
- [ ] Delete list — words lose highlighting

### PDF export hiding

- [ ] With highlighting ON, export to PDF (Ctrl+P / Cmd+P > Export to PDF)
- [ ] PDF should NOT contain any POS color-coding

---

## Readability

**Test doc:** [[Readability Test]]

### Syntax dimming

- [ ] **Source Mode:** Markdown formatting characters (`**`, `*`, `#`, `>`, `-`) are dimmed
- [ ] Command palette: "YAAE: Toggle syntax dimming" — toggles dimming
- [ ] Status bar shows "Syntax: Dim" or "Syntax: Off"
- [ ] Clicking status bar text toggles the feature
- [ ] Active line formatting is slightly less dimmed (still visible)

### Guttered headings

- [ ] **Source Mode:** `#` markers are outdented into left gutter; heading TEXT aligns with body text
- [ ] All heading levels (H1-H6) have their markers in the gutter
- [ ] Body text, lists, and blockquotes are NOT broken by the extra padding
- [ ] **Live Preview:** When cursor is NOT on heading, no visible gutter markers (just consistent left margin)
- [ ] **Live Preview:** When cursor IS on heading line, `#` appears in the gutter
- [ ] Command palette: "YAAE: Toggle guttered headings" — toggles the feature
- [ ] Setting OFF removes the gutter padding entirely

### Focus mode

- [ ] Command palette: "YAAE: Cycle focus mode"
- [ ] **Sentence mode:** Only the sentence at cursor is fully opaque; surrounding text is dimmed
- [ ] **Paragraph mode:** Only the paragraph at cursor is fully opaque
- [ ] **Off:** All text returns to normal
- [ ] Status bar shows "Focus: Off", "Focus: Sentence", or "Focus: Paragraph"
- [ ] Clicking status bar cycles through modes

### Typewriter scroll

- [ ] Command palette: "YAAE: Toggle typewriter scroll"
- [ ] When ON: cursor stays vertically centered as you type or navigate
- [ ] When OFF: normal scroll behavior returns
- [ ] Extra bottom padding is removed when toggled OFF

---

## Document Management

### Classification taxonomy

**Test docs:** [[Classification - Public]], [[Classification - Confidential]], [[Classification - Restricted]]

- [ ] **Reading View:** Classification banner appears at the top of the document
- [ ] Public = green/blue, Confidential = orange/yellow, Restricted = red
- [ ] Banner text matches the frontmatter `classification` value
- [ ] No banner when `classification` is absent or `showClassificationBanner` is off

### Watermark levels

**Test docs:** [[Watermark - Draft]], [[Watermark - Screaming]]

- [ ] Export to PDF: watermark text appears on each page
- [ ] "Draft" level: subtle diagonal watermark
- [ ] "Screaming" level: large, prominent watermark
- [ ] No watermark when `watermark: off`

### Schema validation

- [ ] Open any test doc, run "YAAE: Validate frontmatter"
- [ ] Valid docs show "Frontmatter valid (core schema)" notice
- [ ] Docs with `tags: [docs/adr]` validate against ADR schema
- [ ] Missing required fields show error notice with field names
- [ ] Smart warnings appear (e.g., "draft without watermark")

### Specialized schemas

**Test docs:** [[Schema - ADR]], [[Schema - Threat Model]], [[Schema - Slides]]

- [ ] ADR validates `adrNumber`, `deciders` fields
- [ ] Threat model validates `system`, `methodology` fields
- [ ] Slides validates `marp`, `theme` fields
- [ ] Invalid values produce clear error messages

### Table of contents

**Test doc:** [[TOC Test]]

- [ ] Run "YAAE: Generate table of contents"
- [ ] TOC is inserted after frontmatter
- [ ] TOC contains all headings with correct nesting
- [ ] Running again replaces the existing TOC (idempotent)
- [ ] Heading links are GitHub-compatible slug format

### CSS class derivation

**Test doc:** [[CSS Class Derivation Test]]

- [ ] Run "YAAE: Apply CSS classes from frontmatter"
- [ ] `cssclass` field in frontmatter is updated with derived classes
- [ ] Classes match the classification, watermark, and PDF export settings

---

## Print Styles

**Test doc:** [[Print Export Test]]

- [ ] Export to PDF and verify each component:
  - [ ] Classification banner appears in header/footer area
  - [ ] Watermark renders across pages
  - [ ] Typography matches the configured preset
  - [ ] TOC renders with correct formatting
  - [ ] Links are styled/stripped/defanged per settings
  - [ ] Code blocks have proper formatting and background
  - [ ] Page breaks at `---` or `<div class="page-break"></div>`
  - [ ] Page numbers appear in footer
  - [ ] Images scale correctly (not overflowing)
  - [ ] Tables have borders and proper column widths
