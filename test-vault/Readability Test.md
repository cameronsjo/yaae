---
title: Readability Test
classification: internal
---

# Heading Level 1

Body text should align with heading text when guttered headings are enabled. The `#` marker should sit in the left gutter, not inline with the text.

## Heading Level 2

More body text here. Check that the `##` markers are outdented into the gutter while this paragraph text stays aligned with the heading text above.

### Heading Level 3

Still more text. Each heading level's markers should be in the gutter.

#### Heading Level 4

Getting deeper into headings.

##### Heading Level 5

Almost at the bottom.

###### Heading Level 6

The deepest heading level.

## Syntax Dimming Test

The **bold markers** should be dimmed. The *italic markers* should be dimmed. The ~~strikethrough markers~~ should be dimmed.

- List markers should be dimmed
- Another list item
  - Nested list marker

> Blockquote markers should be dimmed

1. Ordered list numbers
2. Should also be dimmed

## Focus Mode Test

This is the first sentence of the first paragraph. This is the second sentence. This is the third sentence, which is a bit longer to test wrapping behavior.

This is a new paragraph. It has multiple sentences too. The focus mode should dim everything except the active sentence or paragraph depending on the mode.

Here is yet another paragraph to verify the dimming effect. When in sentence mode, only one sentence should be bright. When in paragraph mode, the entire paragraph should be bright.

## Typewriter Scroll Test

Type below this line to test typewriter scroll. The cursor should stay centered.

Line 1
Line 2
Line 3
Line 4
Line 5
Line 6
Line 7
Line 8
Line 9
Line 10
Line 11
Line 12
Line 13
Line 14
Line 15
Line 16
Line 17
Line 18
Line 19
Line 20

## Mixed Content (Guttered Headings Edge Cases)

### Lists after headings

- Item one
- Item two
  - Nested item

### Blockquotes after headings

> This blockquote should not be affected by guttered heading padding.

### Code after headings

```python
def hello():
    print("code blocks should be unaffected")
```

### Tables after headings

| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |
