import { describe, it, expect } from 'vitest';
import { generateToc } from '../src/document/toc-generator';

const fm = (body: string) =>
  `---\ntitle: Test\ncreated: 2024-01-01\n---\n${body}`;

describe('generateToc', () => {
  // --- Happy paths ---

  it('generates TOC from simple headings', () => {
    const content = fm('\n## Introduction\n\n## Methods\n\n## Results\n');
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(3);
    expect(result).toContain('## Table of Contents');
    expect(result).toContain('- [Introduction](#introduction)');
    expect(result).toContain('- [Methods](#methods)');
    expect(result).toContain('- [Results](#results)');
  });

  it('respects maxDepth parameter', () => {
    const content = fm('\n## H2\n\n### H3\n\n#### H4\n');
    const { entryCount: all } = generateToc(content, 6);
    expect(all).toBe(3);

    const { entryCount: limited } = generateToc(content, 2);
    expect(limited).toBe(1);
  });

  it('defaults maxDepth to 3', () => {
    const content = fm('\n## H2\n\n### H3\n\n#### H4\n');
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(2); // H2 + H3, not H4
  });

  it('indents nested headings', () => {
    const content = fm('\n## Parent\n\n### Child\n\n#### Grandchild\n');
    const { content: result } = generateToc(content, 4);
    expect(result).toContain('  - [Parent](#parent)');
    expect(result).toContain('    - [Child](#child)');
    expect(result).toContain('      - [Grandchild](#grandchild)');
  });

  it('inserts TOC after frontmatter', () => {
    const content = fm('\n## Hello\n');
    const { content: result } = generateToc(content);
    // TOC should appear between frontmatter and body
    const fmEnd = result.indexOf('---', result.indexOf('---') + 3);
    const tocStart = result.indexOf('## Table of Contents');
    const bodyHeading = result.indexOf('## Hello');
    expect(tocStart).toBeGreaterThan(fmEnd);
    expect(bodyHeading).toBeGreaterThan(tocStart);
  });

  it('prepends TOC when no frontmatter', () => {
    const content = '## Hello\n\n## World\n';
    const { content: result } = generateToc(content);
    expect(result.startsWith('## Table of Contents')).toBe(true);
    expect(result).toContain('## Hello');
  });

  // --- Idempotent replacement ---

  it('replaces existing TOC block', () => {
    const content = fm(`
## Table of Contents

  - [Old Entry](#old-entry)

---

## New Section

## Another Section
`);
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(2);
    expect(result).not.toContain('Old Entry');
    expect(result).toContain('- [New Section](#new-section)');
    expect(result).toContain('- [Another Section](#another-section)');
  });

  it('is idempotent — running twice produces same output', () => {
    const content = fm('\n## Alpha\n\n## Beta\n');
    const { content: first } = generateToc(content);
    const { content: second } = generateToc(first);
    expect(second).toBe(first);
  });

  // --- Skipping logic ---

  it('skips headings inside code blocks', () => {
    const content = fm('\n## Real Heading\n\n```\n## Fake Heading\n```\n\n## Another Real\n');
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(2);
  });

  it('skips headings inside frontmatter', () => {
    // Frontmatter can have keys that look like headings (they don't, but test the skip)
    const content = `---\ntitle: Test\ncreated: 2024-01-01\n---\n\n## Real Heading\n`;
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(1);
  });

  it('skips the "Table of Contents" heading itself', () => {
    const content = fm('\n## Table of Contents\n\n## Introduction\n');
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(1);
  });

  // --- Slugification ---

  it('slugifies headings with special characters', () => {
    const content = fm('\n## Hello, World!\n');
    const { content: result } = generateToc(content);
    expect(result).toContain('(#hello-world)');
  });

  it('slugifies headings with multiple spaces', () => {
    const content = fm('\n## Foo   Bar\n');
    const { content: result } = generateToc(content);
    expect(result).toContain('(#foo-bar)');
  });

  // --- Edge cases ---

  it('handles content with no headings', () => {
    const content = fm('\nJust a paragraph with no headings.\n');
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(0);
  });

  it('returns entry count of zero for empty body', () => {
    const content = fm('');
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(0);
  });

  it('handles h1 headings', () => {
    const content = fm('\n# Top Level\n');
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(1);
    expect(result).toContain('- [Top Level](#top-level)');
  });
});
