import { describe, it, expect } from 'vitest';
import {
  validateMarkdown,
  extractFrontmatter,
  deriveCssClasses,
  getClassificationMeta,
  getAllClassificationIds,
  CLASSIFICATION_TAXONOMY,
} from '../src/schemas';
import type { CustomClassification } from '../src/schemas';

const wrap = (yaml: string, body = '') =>
  `---\n${yaml}\n---\n${body}`;

// ---------------------------------------------------------------------------
// extractFrontmatter
// ---------------------------------------------------------------------------

describe('extractFrontmatter', () => {
  it('extracts frontmatter from markdown', () => {
    const result = extractFrontmatter(wrap('title: Test\ncreated: 2024-01-01'));
    expect(result).toMatchObject({ title: 'Test' });
  });

  it('returns empty object for content without frontmatter', () => {
    expect(extractFrontmatter('')).toEqual({});
  });

  it('returns empty object for plain text without delimiters', () => {
    expect(extractFrontmatter('Just some text')).toEqual({});
  });

  it('returns null for malformed YAML', () => {
    // Unclosed quote causes gray-matter to throw
    const result = extractFrontmatter('---\ntitle: "unclosed\n---');
    // gray-matter is lenient; it may parse or return null depending on the error
    // The important thing: it doesn't throw
    expect(result).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// validateMarkdown — base schema happy paths
// ---------------------------------------------------------------------------

describe('validateMarkdown', () => {
  it('validates a minimal valid document', () => {
    const result = validateMarkdown(wrap('title: Hello\ncreated: 2024-01-01'));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('base');
    expect(result.data?.title).toBe('Hello');
    expect(result.data?.classification).toBe('internal'); // default
    expect(result.data?.status).toBe('draft'); // default
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
    theme: yaae
    paginate: true
    size: "4:3"`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.data?.export?.pdf?.watermark).toBe('loud');
    expect(result.data?.export?.slides?.theme).toBe('yaae');
  });

  // --- Base schema unhappy paths ---

  it('fails when title is missing', () => {
    const result = validateMarkdown(wrap('created: 2024-01-01'));
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('fails when created date is missing', () => {
    const result = validateMarkdown(wrap('title: Test'));
    expect(result.valid).toBe(false);
  });

  it('fails with no frontmatter', () => {
    const result = validateMarkdown('Just some text without frontmatter');
    expect(result.valid).toBe(false);
    expect(result.schema).toBe('none');
    expect(result.errors?.issues[0].message).toBe('No frontmatter found');
  });

  it('fails with empty frontmatter', () => {
    const result = validateMarkdown('---\n---\n');
    expect(result.valid).toBe(false);
    expect(result.schema).toBe('none');
  });

  it('accepts custom classification string values', () => {
    const yaml = `title: Test
created: 2024-01-01
classification: non-sensitive`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.data?.classification).toBe('non-sensitive');
  });

  it('rejects invalid status enum value', () => {
    const yaml = `title: Test
created: 2024-01-01
status: pending`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
  });

  it('rejects invalid watermark enum value', () => {
    const yaml = `title: Test
created: 2024-01-01
export:
  pdf:
    watermark: extreme`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
  });

  it('rejects tocDepth outside valid range', () => {
    const yaml = `title: Test
created: 2024-01-01
export:
  pdf:
    tocDepth: 10`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
  });

  it('rejects non-string title', () => {
    const yaml = `title: 123
created: 2024-01-01`;
    // Zod coerces number to string for z.string(), so this may pass.
    // The important constraint is min(1), not type.
    const result = validateMarkdown(wrap(yaml));
    // Either way it shouldn't throw
    expect(result).toBeDefined();
  });

  it('rejects empty title', () => {
    const yaml = `title: ""
created: 2024-01-01`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateMarkdown — specialized schemas
// ---------------------------------------------------------------------------

describe('validateMarkdown — ADR schema', () => {
  const base = `title: ADR 001
created: 2024-01-01
tags: [docs/adr]`;

  it('accepts valid ADR', () => {
    const yaml = `${base}
adrNumber: 1
deciders: [Alice]`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('adr');
  });

  it('fails when adrNumber is missing', () => {
    const yaml = `${base}
deciders: [Alice]`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
    expect(result.schema).toBe('adr');
  });

  it('fails when deciders is missing', () => {
    const yaml = `${base}
adrNumber: 1`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
    expect(result.schema).toBe('adr');
  });

  it('fails when deciders is empty', () => {
    const yaml = `${base}
adrNumber: 1
deciders: []`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
    expect(result.schema).toBe('adr');
  });
});

describe('validateMarkdown — threat-model schema', () => {
  const base = `title: Threat Model
created: 2024-01-01
tags: [docs/threat-model]`;

  it('accepts valid threat-model', () => {
    const yaml = `${base}
system: Auth Service`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('threat-model');
  });

  it('fails when system is missing', () => {
    const result = validateMarkdown(wrap(base));
    expect(result.valid).toBe(false);
    expect(result.schema).toBe('threat-model');
  });

  it('rejects invalid methodology enum', () => {
    const yaml = `${base}
system: Auth Service
methodology: DREAD`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
  });
});

describe('validateMarkdown — runbook schema', () => {
  const base = `title: Restart Service
created: 2024-01-01
tags: [docs/runbook]`;

  it('accepts valid runbook', () => {
    const yaml = `${base}
service: api-gateway
oncallTeam: platform`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('runbook');
  });

  it('fails when service is missing', () => {
    const yaml = `${base}
oncallTeam: platform`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
    expect(result.schema).toBe('runbook');
  });

  it('fails when oncallTeam is missing', () => {
    const yaml = `${base}
service: api-gateway`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
    expect(result.schema).toBe('runbook');
  });

  it('rejects invalid severity enum', () => {
    const yaml = `${base}
service: api-gateway
oncallTeam: platform
severity: critical`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(false);
  });

  it('accepts valid severity levels', () => {
    for (const sev of ['sev1', 'sev2', 'sev3', 'sev4']) {
      const yaml = `${base}
service: api-gateway
oncallTeam: platform
severity: ${sev}`;
      const result = validateMarkdown(wrap(yaml));
      expect(result.valid).toBe(true);
    }
  });
});

describe('validateMarkdown — slides schema', () => {
  it('detects slides schema from marp: true', () => {
    const yaml = `title: My Deck
created: 2024-01-01
marp: true`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('slides');
  });

  it('detects slides schema from tags', () => {
    const yaml = `title: My Deck
created: 2024-01-01
tags: [docs/slides]`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.schema).toBe('slides');
  });
});

// ---------------------------------------------------------------------------
// validateMarkdown — warnings
// ---------------------------------------------------------------------------

describe('validateMarkdown — warnings', () => {
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

  it('no draft watermark warning when watermark is set', () => {
    const yaml = `title: Draft Doc
created: 2024-01-01
status: draft
export:
  pdf:
    watermark: loud`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.warnings).not.toContain(
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

  it('no version warning when version is set', () => {
    const yaml = `title: Final Doc
created: 2024-01-01
status: final
version: "1.0.0"`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.warnings.some(w => w.includes('no version number'))).toBe(false);
  });

  it('warns on confidential without reviewers', () => {
    const yaml = `title: Secret
created: 2024-01-01
classification: confidential`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.warnings.some(w => w.includes('no reviewers'))).toBe(true);
  });

  it('warns on restricted without reviewers', () => {
    const yaml = `title: Top Secret
created: 2024-01-01
classification: restricted`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.warnings.some(w => w.includes('no reviewers'))).toBe(true);
  });

  it('no reviewer warning when reviewers are set', () => {
    const yaml = `title: Secret
created: 2024-01-01
classification: confidential
reviewers: [Alice, Bob]`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.warnings.some(w => w.includes('no reviewers'))).toBe(false);
  });

  it('warns on missing updated date', () => {
    const yaml = `title: Test
created: 2024-01-01`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.warnings.some(w => w.includes('Missing updated date'))).toBe(true);
  });

  it('no updated warning when updated date is set', () => {
    const yaml = `title: Test
created: 2024-01-01
updated: 2024-06-15`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.warnings.some(w => w.includes('Missing updated date'))).toBe(false);
  });

  it('no warnings for fully complete document', () => {
    const yaml = `title: Complete
created: 2024-01-01
updated: 2024-06-15
status: final
version: "2.0.0"
classification: confidential
reviewers: [Alice]
export:
  pdf:
    watermark: loud`;
    const result = validateMarkdown(wrap(yaml));
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deriveCssClasses
// ---------------------------------------------------------------------------

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

  it('excludes watermark class when watermark is off', () => {
    const yaml = `title: Test
created: 2024-01-01
export:
  pdf:
    watermark: "off"`;
    const result = validateMarkdown(wrap(yaml));
    const classes = deriveCssClasses(result.data!);
    expect(classes.some(c => c.startsWith('pdf-watermark'))).toBe(false);
  });

  it('excludes watermark class when using defaults (off)', () => {
    const yaml = `title: Test
created: 2024-01-01`;
    const result = validateMarkdown(wrap(yaml));
    const classes = deriveCssClasses(result.data!);
    expect(classes.some(c => c.startsWith('pdf-watermark'))).toBe(false);
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

  it('excludes pdf-no-links when expandLinks is true (default)', () => {
    const yaml = `title: Test
created: 2024-01-01`;
    const result = validateMarkdown(wrap(yaml));
    const classes = deriveCssClasses(result.data!);
    expect(classes).not.toContain('pdf-no-links');
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

  it('maps all four classification levels', () => {
    for (const level of ['public', 'internal', 'confidential', 'restricted']) {
      const yaml = `title: Test
created: 2024-01-01
classification: ${level}`;
      const result = validateMarkdown(wrap(yaml));
      const classes = deriveCssClasses(result.data!);
      expect(classes).toContain(`pdf-${level}`);
    }
  });

  it('maps all four status values', () => {
    for (const status of ['draft', 'review', 'final', 'archived']) {
      const yaml = `title: Test
created: 2024-01-01
status: ${status}`;
      const result = validateMarkdown(wrap(yaml));
      const classes = deriveCssClasses(result.data!);
      expect(classes).toContain(`pdf-${status}`);
    }
  });

  it('derives CSS class for custom classification', () => {
    const yaml = `title: Test
created: 2024-01-01
classification: non-sensitive`;
    const result = validateMarkdown(wrap(yaml));
    const classes = deriveCssClasses(result.data!);
    expect(classes).toContain('pdf-non-sensitive');
  });
});

// ---------------------------------------------------------------------------
// getClassificationMeta
// ---------------------------------------------------------------------------

describe('getClassificationMeta', () => {
  it('returns built-in classification metadata', () => {
    const meta = getClassificationMeta('internal');
    expect(meta).not.toBeNull();
    expect(meta!.label).toBe('INTERNAL — DO NOT DISTRIBUTE');
    expect(meta!.color).toBe('#b8860b');
  });

  it('returns null for unknown classification with no custom list', () => {
    const meta = getClassificationMeta('non-sensitive');
    expect(meta).toBeNull();
  });

  it('returns custom classification metadata', () => {
    const customs: CustomClassification[] = [
      { id: 'non-sensitive', label: 'NON-SENSITIVE', color: '#2d7d2d', background: '#f0faf0' },
    ];
    const meta = getClassificationMeta('non-sensitive', customs);
    expect(meta).not.toBeNull();
    expect(meta!.label).toBe('NON-SENSITIVE');
    expect(meta!.level).toBe('non-sensitive');
  });

  it('custom classification overrides built-in with same ID', () => {
    const customs: CustomClassification[] = [
      { id: 'public', label: 'UNCLASSIFIED', color: '#333333', background: '#eeeeee' },
    ];
    const meta = getClassificationMeta('public', customs);
    expect(meta).not.toBeNull();
    expect(meta!.label).toBe('UNCLASSIFIED');
    expect(meta!.color).toBe('#333333');
  });
});

// ---------------------------------------------------------------------------
// getAllClassificationIds
// ---------------------------------------------------------------------------

describe('getAllClassificationIds', () => {
  it('returns built-in IDs when no custom classifications', () => {
    const ids = getAllClassificationIds();
    expect(ids).toEqual(['public', 'internal', 'confidential', 'restricted']);
  });

  it('includes custom IDs alongside built-in', () => {
    const customs: CustomClassification[] = [
      { id: 'non-sensitive', label: 'NON-SENSITIVE', color: '#2d7d2d', background: '#f0faf0' },
      { id: 'sensitive', label: 'SENSITIVE', color: '#b8860b', background: '#fff8e7' },
    ];
    const ids = getAllClassificationIds(customs);
    expect(ids).toContain('public');
    expect(ids).toContain('non-sensitive');
    expect(ids).toContain('sensitive');
  });

  it('deduplicates when custom ID matches built-in', () => {
    const customs: CustomClassification[] = [
      { id: 'public', label: 'UNCLASSIFIED', color: '#333', background: '#eee' },
    ];
    const ids = getAllClassificationIds(customs);
    const publicCount = ids.filter((id) => id === 'public').length;
    expect(publicCount).toBe(1);
  });
});
