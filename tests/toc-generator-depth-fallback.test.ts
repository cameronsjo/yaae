import { describe, it, expect } from 'vitest';
import { hasToc, resolveTocDepth } from '../src/document/toc-generator';

/**
 * `resolveTocDepth` reads the RAW frontmatter value and range-checks it
 * locally (integer 1-6, mirroring the schema constraint) — deliberately NOT
 * routing through full document validation, so an explicit override is
 * honored even when an unrelated required field (e.g. `title`) is missing.
 * These tests cover the fallback branch (invalid values → settings default)
 * and the decoupling from whole-document validity.
 */

describe('resolveTocDepth — validation fallback branch', () => {
  it('falls back to the default when the override is out of the schema range (>6)', () => {
    const content =
      '---\ntitle: Test\ncreated: 2024-01-01\nexport:\n  pdf:\n    tocDepth: 9\n---\n\n## H\n';
    expect(resolveTocDepth(content, 4)).toBe(4);
  });

  it('falls back to the default when the override is out of the schema range (<1)', () => {
    const content =
      '---\ntitle: Test\ncreated: 2024-01-01\nexport:\n  pdf:\n    tocDepth: 0\n---\n\n## H\n';
    expect(resolveTocDepth(content, 5)).toBe(5);
  });

  it('falls back to the default when the override is not a number', () => {
    const content =
      '---\ntitle: Test\ncreated: 2024-01-01\nexport:\n  pdf:\n    tocDepth: "deep"\n---\n\n## H\n';
    expect(resolveTocDepth(content, 3)).toBe(3);
  });

  it('honors a valid override even when an unrelated required field is missing', () => {
    // `title` is required by the full document schema, but the tocDepth
    // override is validated locally — a mid-draft note missing its title
    // still gets the depth its author explicitly asked for.
    const content =
      '---\ncreated: 2024-01-01\nexport:\n  pdf:\n    tocDepth: 2\n---\n\n## H\n';
    expect(resolveTocDepth(content, 6)).toBe(2);
  });

  it('honors a numeric-string override (YAML quoted number)', () => {
    const content =
      '---\ntitle: Test\nexport:\n  pdf:\n    tocDepth: "2"\n---\n\n## H\n';
    expect(resolveTocDepth(content, 6)).toBe(2);
  });

  it('falls back on a fractional override', () => {
    const content =
      '---\ntitle: Test\nexport:\n  pdf:\n    tocDepth: 2.5\n---\n\n## H\n';
    expect(resolveTocDepth(content, 4)).toBe(4);
  });

  it('falls back to the default when frontmatter YAML is malformed', () => {
    // gray-matter throws on genuinely malformed YAML; extractFrontmatter's
    // catch returns null, which resolveTocDepth treats as "no override".
    const content = '---\ntitle: Test\nexport: [unterminated\n---\n\n## H\n';
    expect(resolveTocDepth(content, 2)).toBe(2);
  });
});

describe('hasToc — boundary cases', () => {
  it('returns false for a heading with no closing rule', () => {
    const content = '## Table of Contents\n\n- [Entry](#entry)\n\n## Body\n';
    expect(hasToc(content)).toBe(false);
  });

  it('returns false when only the closing rule is present without the heading', () => {
    const content = '## Body\n\n---\n';
    expect(hasToc(content)).toBe(false);
  });

  it('returns false for an empty document', () => {
    expect(hasToc('')).toBe(false);
  });

  it('is case-sensitive on the TOC heading text', () => {
    const content = '## table of contents\n\n- [x](#x)\n\n---\n';
    expect(hasToc(content)).toBe(false);
  });
});
