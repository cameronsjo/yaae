import { describe, it, expect } from 'vitest';
import { validateMarkdown, extractFrontmatter, deriveCssClasses } from '../src';

const wrap = (yaml: string, body = '') =>
  `---\n${yaml}\n---\n${body}`;

describe('extractFrontmatter', () => {
  it('extracts frontmatter from markdown', () => {
    const result = extractFrontmatter(wrap('title: Test\ncreated: 2024-01-01'));
    expect(result).toMatchObject({ title: 'Test' });
  });

  it('returns null for invalid content', () => {
    expect(extractFrontmatter('')).toEqual({});
  });
});

describe('validateMarkdown', () => {
  it('validates a minimal valid document', () => {
    const result = validateMarkdown(wrap('title: Hello\ncreated: 2024-01-01'));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('base');
    expect(result.data?.title).toBe('Hello');
    expect(result.data?.classification).toBe('internal'); // default
    expect(result.data?.status).toBe('draft'); // default
  });

  it('fails when title is missing', () => {
    const result = validateMarkdown(wrap('created: 2024-01-01'));
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('fails when created date is missing', () => {
    const result = validateMarkdown(wrap('title: Test'));
    expect(result.valid).toBe(false);
  });

  it('detects ADR schema from tags', () => {
    const yaml = `title: ADR 001
created: 2024-01-01
tags: [docs/adr]
adrNumber: 1
deciders: [Alice]`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('adr');
  });

  it('detects threat-model schema from tags', () => {
    const yaml = `title: Threat Model
created: 2024-01-01
tags: [docs/threat-model]
system: Auth Service`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('threat-model');
  });

  it('detects slides schema from marp: true', () => {
    const yaml = `title: My Deck
created: 2024-01-01
marp: true`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('slides');
  });

  it('warns on draft without watermark', () => {
    const yaml = `title: Draft Doc
created: 2024-01-01
status: draft`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain(
      'Draft status but watermark is off — consider adding a watermark.'
    );
  });

  it('warns on final without version', () => {
    const yaml = `title: Final Doc
created: 2024-01-01
status: final`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.warnings.some(w => w.includes('no version number'))).toBe(true);
  });

  it('warns on confidential without reviewers', () => {
    const yaml = `title: Secret
created: 2024-01-01
classification: confidential`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.warnings.some(w => w.includes('no reviewers'))).toBe(true);
  });

  it('warns on missing updated date', () => {
    const yaml = `title: Test
created: 2024-01-01`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.warnings.some(w => w.includes('Missing updated date'))).toBe(true);
  });

  it('accepts full export config', () => {
    const yaml = `title: Full
created: 2024-01-01
export:
  pdf:
    watermark: loud
    expandLinks: false
    toc: true
    tocDepth: 4
    skipCover: true
    pageNumbers: true
    headerLeft: "Acme Corp"
    footerRight: "Page {page}"
  slides:
    theme: doc-forge
    paginate: true
    size: "4:3"`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.data?.export?.pdf?.watermark).toBe('loud');
    expect(result.data?.export?.slides?.theme).toBe('doc-forge');
  });
});

describe('deriveCssClasses', () => {
  it('derives classes from defaults', () => {
    const result = validateMarkdown(wrap('title: Test\ncreated: 2024-01-01'));
    expect(result.valid).toBe(true);
    const classes = deriveCssClasses(result.data!);
    expect(classes).toContain('pdf-internal');
    expect(classes).toContain('pdf-draft');
  });

  it('includes watermark class when set', () => {
    const yaml = `title: Test
created: 2024-01-01
export:
  pdf:
    watermark: loud`;
    const result = validateMarkdown(wrap(yaml));
    const classes = deriveCssClasses(result.data!);
    expect(classes).toContain('pdf-watermark-loud');
  });

  it('includes pdf-no-links when expandLinks is false', () => {
    const yaml = `title: Test
created: 2024-01-01
export:
  pdf:
    expandLinks: false`;
    const result = validateMarkdown(wrap(yaml));
    const classes = deriveCssClasses(result.data!);
    expect(classes).toContain('pdf-no-links');
  });

  it('includes pdf-skip-cover when set', () => {
    const yaml = `title: Test
created: 2024-01-01
export:
  pdf:
    skipCover: true`;
    const result = validateMarkdown(wrap(yaml));
    const classes = deriveCssClasses(result.data!);
    expect(classes).toContain('pdf-skip-cover');
  });

  it('includes pdf-toc when toc enabled', () => {
    const yaml = `title: Test
created: 2024-01-01
export:
  pdf:
    toc: true`;
    const result = validateMarkdown(wrap(yaml));
    const classes = deriveCssClasses(result.data!);
    expect(classes).toContain('pdf-toc');
  });
});
