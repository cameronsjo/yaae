---
title: Print Export Test
classification: confidential
status: draft
author: Test Author
created: "2026-03-26"
export:
  pdf:
    watermark: heads-up
    toc: true
    tocDepth: 2
    links: styled
    copyPasteSafe: true
    compactTables: true
    fontFamily: sans
    theme: light
    pageNumbers: true
    signatureBlock: false
---

## Table of Contents

---

## Typography Test

This paragraph tests the typography preset. The font should match the `sans` family setting. Line height, paragraph spacing, and heading sizes should all look polished.

**Bold text**, *italic text*, ~~strikethrough~~, `inline code`, and [a link](https://example.com).

## Code Block Test

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}

const result = greet("World");
console.log(result);
```

## Table Test

| Feature | Status | Priority |
|---------|--------|----------|
| Prose highlighting | Done | High |
| Guttered headings | Needs testing | Medium |
| Focus mode | Done | Medium |
| Print styles | Done | High |

## Image Test

> Note: Add an image to the test vault to verify image scaling in PDF export.

## Page Break Test

Content before the break.

<div class="page-break"></div>

Content after the break. This should appear on a new page in the PDF.

## Links Test

- Styled link: [Example](https://example.com)
- Internal link: [[Smoke Test Checklist]]
- Bare URL: https://example.com/bare-url-test

## List Test

1. First ordered item
2. Second ordered item
   - Nested unordered
   - Another nested
3. Third ordered item

## Blockquote Test

> This is a blockquote that should render nicely in the PDF export with proper indentation and styling.

## Final Section

This is the last section. Page numbers should be visible in the footer. The classification banner should appear in the header/footer area. The watermark should be visible on every page.
