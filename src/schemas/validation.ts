import matter from 'gray-matter';
import { z } from 'zod';
import {
  docFrontmatterSchema,
  adrSchema,
  threatModelSchema,
  runbookSchema,
  slidesSchema,
  type DocFrontmatter,
} from './schema';

export interface ValidationResult {
  valid: boolean;
  data?: DocFrontmatter;
  errors?: z.ZodError;
  warnings: string[];
  schema: string;
}

type SchemaEntry = {
  name: string;
  match: (tags: string[]) => boolean;
  schema: z.ZodType;
};

const SPECIALIZED_SCHEMAS: SchemaEntry[] = [
  {
    name: 'adr',
    match: (tags) => tags.includes('docs/adr'),
    schema: adrSchema,
  },
  {
    name: 'threat-model',
    match: (tags) => tags.includes('docs/threat-model'),
    schema: threatModelSchema,
  },
  {
    name: 'runbook',
    match: (tags) => tags.includes('docs/runbook'),
    schema: runbookSchema,
  },
  {
    name: 'slides',
    match: (tags) => tags.includes('docs/slides'),
    schema: slidesSchema,
  },
];

function detectSchema(data: Record<string, unknown>): SchemaEntry | null {
  const tags = Array.isArray(data.tags) ? data.tags as string[] : [];

  // Slides can also be detected by marp: true
  if (data.marp === true && !tags.includes('docs/slides')) {
    return SPECIALIZED_SCHEMAS.find((s) => s.name === 'slides')!;
  }

  for (const entry of SPECIALIZED_SCHEMAS) {
    if (entry.match(tags)) return entry;
  }

  return null;
}

function computeWarnings(data: DocFrontmatter): string[] {
  const warnings: string[] = [];

  if (data.status === 'draft' && data.export?.pdf?.watermark === 'off') {
    warnings.push('Draft status but watermark is off — consider adding a watermark.');
  }

  if (data.status === 'final' && !data.version) {
    warnings.push('Final status but no version number set.');
  }

  if (
    (data.classification === 'confidential' || data.classification === 'restricted') &&
    (!data.reviewers || data.reviewers.length === 0)
  ) {
    warnings.push(`${data.classification} classification but no reviewers listed.`);
  }

  if (!data.updated) {
    warnings.push('Missing updated date.');
  }

  return warnings;
}

export function extractFrontmatter(content: string): Record<string, unknown> | null {
  try {
    const { data } = matter(content);
    return data;
  } catch {
    return null;
  }
}

export function validateMarkdown(content: string): ValidationResult {
  const raw = extractFrontmatter(content);

  if (!raw || Object.keys(raw).length === 0) {
    return {
      valid: false,
      warnings: [],
      schema: 'none',
      errors: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: 'No frontmatter found',
          path: [],
        },
      ]),
    };
  }

  const specialized = detectSchema(raw);
  const schemaName = specialized?.name ?? 'base';
  const schema = specialized?.schema ?? docFrontmatterSchema;

  const result = schema.safeParse(raw);

  if (!result.success) {
    return {
      valid: false,
      errors: result.error,
      warnings: [],
      schema: schemaName,
    };
  }

  const data = result.data as DocFrontmatter;
  const warnings = computeWarnings(data);

  return {
    valid: true,
    data,
    warnings,
    schema: schemaName,
  };
}
