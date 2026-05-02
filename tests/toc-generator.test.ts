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

  it('indents nested headings relative to the shallowest level', () => {
    // Shallowest is H2; H3 nests by one level (2 spaces), H4 by two (4 spaces).
    const content = fm('\n## Parent\n\n### Child\n\n#### Grandchild\n');
    const { content: result } = generateToc(content, 4);
    expect(result).toContain('- [Parent](#parent)');
    expect(result).toContain('  - [Child](#child)');
    expect(result).toContain('    - [Grandchild](#grandchild)');
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

  // --- F1: frontmatter with literal '---' inside a block scalar ---

  it('does not split frontmatter when YAML contains a literal --- block scalar', () => {
    // The `description` block scalar contains a literal '---' line. A naive
    // indexOf('---', n) would find this and insert the TOC mid-frontmatter.
    const content = [
      '---',
      'title: Test',
      'description: |',
      '  ---',
      '  divider in description',
      '---',
      '',
      '## Real Heading',
      '',
    ].join('\n');

    const { content: result } = generateToc(content);

    // Frontmatter must remain intact and unmodified.
    const fmStart = result.indexOf('---');
    const fmEnd = result.indexOf('\n---\n', fmStart + 3);
    expect(fmStart).toBe(0);
    expect(fmEnd).toBeGreaterThan(0);

    const frontmatter = result.slice(fmStart, fmEnd + 4);
    expect(frontmatter).toContain('description: |');
    expect(frontmatter).toContain('  ---');
    expect(frontmatter).toContain('  divider in description');
    // Description block scalar must NOT contain the TOC heading.
    expect(frontmatter).not.toContain('Table of Contents');

    // TOC should appear after the closing fence.
    const tocStart = result.indexOf('## Table of Contents');
    expect(tocStart).toBeGreaterThan(fmEnd);
    expect(result).toContain('- [Real Heading](#real-heading)');
  });

  // --- F2: tilde-fenced code blocks ---

  it('skips headings inside tilde-fenced code blocks', () => {
    const content = fm(
      '\n## Real Heading\n\n~~~markdown\n# Hidden\n## Also Hidden\n~~~\n\n## Another Real\n',
    );
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(2);
    expect(result).toContain('- [Real Heading](#real-heading)');
    expect(result).toContain('- [Another Real](#another-real)');
    // "Hidden" headings should not appear in TOC entries — but they remain in
    // the document body, so check just the TOC region.
    const tocStart = result.indexOf('## Table of Contents');
    const tocEnd = result.indexOf('\n---', tocStart);
    const tocBlock = result.slice(tocStart, tocEnd);
    expect(tocBlock).not.toContain('Hidden');
  });

  // --- F3: slugify strips inline markdown ---

  it('strips inline link syntax when slugifying headings', () => {
    const content = fm('\n## Threat Model [Overview](./tm.md)\n');
    const { content: result } = generateToc(content);
    // Slug should match Obsidian's plain-text anchor: lowercase, hyphenated.
    expect(result).toContain('(#threat-model-overview)');
    // Display text should be the rendered plain text, not the raw link syntax.
    expect(result).toContain('- [Threat Model Overview]');
    // The TOC region itself must not contain link syntax (the body still does).
    const tocStart = result.indexOf('## Table of Contents');
    const tocEnd = result.indexOf('\n---', tocStart);
    const tocBlock = result.slice(tocStart, tocEnd);
    expect(tocBlock).not.toContain('[Overview](./tm.md)');
  });

  it('strips inline code when slugifying headings', () => {
    const content = fm('\n## Using `useEffect` Hook\n');
    const { content: result } = generateToc(content);
    expect(result).toContain('(#using-useeffect-hook)');
    expect(result).toContain('- [Using useEffect Hook]');
  });

  it('strips wikilinks when slugifying headings', () => {
    const content = fm('\n## See [[Other Note|the other note]] for more\n');
    const { content: result } = generateToc(content);
    expect(result).toContain('- [See the other note for more]');
    expect(result).toContain('(#see-the-other-note-for-more)');
  });

  // --- F4: non-contiguous heading levels ---

  it('does not over-indent when document starts at H3', () => {
    // Old behavior: H3 → 4 spaces (assumed H1 was the root). New behavior:
    // shallowest is H3 → no indent.
    const content = fm('\n### First\n\n### Second\n');
    const { content: result } = generateToc(content);
    expect(result).toContain('- [First](#first)');
    expect(result).toContain('- [Second](#second)');
    // No 4-space-indented entries.
    expect(result).not.toMatch(/\n {4}- \[First\]/);
    expect(result).not.toMatch(/\n {4}- \[Second\]/);
  });

  it('indents relative to shallowest level when doc starts at H2', () => {
    // Doc with H2 + H4 (no H3): minLevel=2, H2=depth 0, H4=depth 2.
    const content = fm('\n## Section\n\n#### Detail\n');
    const { content: result } = generateToc(content, 4);
    expect(result).toContain('- [Section](#section)');
    expect(result).toContain('    - [Detail](#detail)');
  });
});
