---
title: Prose Highlighting Test
classification: internal
---

# Prose Highlighting Test

## Simple Prose

The quick brown fox jumps over the lazy dog. She quickly ran through the beautiful garden while the birds sang melodiously above the ancient trees.

## Mixed Parts of Speech

Brilliant engineers carefully design elegant solutions. The complex algorithm efficiently processes massive datasets. We slowly understood the fundamental problem.

## Conjunctions

The team worked hard, but the deadline was tight. Although they finished early, the client wanted more features and the scope expanded significantly.

## Edge Cases

### Single word lines

Running.

Quickly.

Beautiful.

### Markdown formatting

**Bold text** with *italic emphasis* and `inline code` should handle gracefully.

> Blockquotes should also highlight properly within the quoted text.

- List items with adjectives like **gorgeous** and adverbs like *swiftly*
- Another item with verbs: running, jumping, swimming

### Code blocks (should NOT highlight)

```javascript
const beautiful = "this should not be highlighted";
function quickly() { return true; }
```

### Links and special content

Visit [the amazing website](https://example.com) for more beautiful details.

The word "beautiful" in quotes and (parenthetical beautiful) contexts.
