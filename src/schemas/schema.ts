import { z } from 'zod';

const coercedDate = z.coerce.date();

const pdfExportSchema = z.object({
  watermark: z.enum(['off', 'whisper', 'heads-up', 'loud', 'screaming']).default('off'),
  links: z.enum(['expand', 'styled', 'plain', 'stripped']).default('expand'),
  theme: z.enum(['light', 'dark', 'auto']).default('light'),
  fontFamily: z.union([z.enum(['sans', 'serif', 'mono', 'system']), z.string()]).default('sans'),
  fontSize: z.number().min(6).max(24).default(11),
  copyPasteSafe: z.boolean().default(true),
  compactTables: z.boolean().default(true),
  landscape: z.boolean().default(false),
  toc: z.boolean().default(false),
  tocDepth: z.number().int().min(1).max(6).default(3),
  skipCover: z.boolean().default(false),
  pageNumbers: z.boolean().default(true),
  headerLeft: z.string().optional(),
  headerRight: z.string().optional(),
  footerLeft: z.string().optional(),
  footerRight: z.string().optional(),
  // Deprecated: use `links` enum instead
  expandLinks: z.boolean().default(true),
  plainLinks: z.boolean().default(false),
}).default({});

const slidesExportSchema = z.object({
  theme: z.string().default('default'),
  paginate: z.boolean().default(true),
  header: z.string().optional(),
  footer: z.string().optional(),
  size: z.string().default('16:9'),
  math: z.enum(['mathjax', 'katex']).optional(),
}).default({});

const exportSchema = z.object({
  pdf: pdfExportSchema,
  slides: slidesExportSchema,
}).default({});

export const docFrontmatterSchema = z.object({
  // Required
  title: z.string().min(1),

  // Classification & Status
  classification: z.string().default('internal'),
  status: z.enum(['draft', 'review', 'final', 'archived']).default('draft'),

  // Metadata
  version: z.string().optional(),
  author: z.string().optional(),
  owner: z.string().optional(),
  reviewers: z.array(z.string()).optional(),

  // Taxonomy
  tags: z.array(z.string()).default([]),
  aliases: z.array(z.string()).optional(),

  // Timestamps
  created: coercedDate,
  updated: coercedDate.optional(),
  reviewDate: coercedDate.optional(),

  // Relations
  related: z.array(z.string()).optional(),
  parent: z.string().optional(),

  // Export
  export: exportSchema,

  // Obsidian-specific
  cssclass: z.union([z.string(), z.array(z.string())]).optional(),
  publish: z.boolean().optional(),
});

export type DocFrontmatter = z.infer<typeof docFrontmatterSchema>;

// --- Specialized Schemas ---

export const adrSchema = docFrontmatterSchema.extend({
  adrNumber: z.number().int(),
  deciders: z.array(z.string()).min(1),
  decision: z.string().optional(),
  supersedes: z.number().int().optional(),
  supersededBy: z.number().int().optional(),
});

export type AdrFrontmatter = z.infer<typeof adrSchema>;

export const threatModelSchema = docFrontmatterSchema.extend({
  system: z.string().min(1),
  methodology: z.enum(['STRIDE', 'PASTA', 'LINDDUN', 'custom']).optional(),
  riskLevel: z.string().optional(),
  lastAssessment: coercedDate.optional(),
  nextReview: coercedDate.optional(),
});

export type ThreatModelFrontmatter = z.infer<typeof threatModelSchema>;

export const runbookSchema = docFrontmatterSchema.extend({
  service: z.string().min(1),
  oncallTeam: z.string().min(1),
  severity: z.enum(['sev1', 'sev2', 'sev3', 'sev4']).optional(),
  estimatedDuration: z.string().optional(),
});

export type RunbookFrontmatter = z.infer<typeof runbookSchema>;

export const slidesSchema = docFrontmatterSchema.extend({
  marp: z.literal(true).optional(),
  audience: z.string().optional(),
  duration: z.string().optional(),
});

export type SlidesFrontmatter = z.infer<typeof slidesSchema>;
