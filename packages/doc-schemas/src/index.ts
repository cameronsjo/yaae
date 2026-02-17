// Classification taxonomy
export {
  type ClassificationLevel,
  type ClassificationMeta,
  CLASSIFICATION_TAXONOMY,
} from './classification';

// Watermark levels
export {
  type WatermarkLevel,
  type WatermarkMeta,
  WATERMARK_LEVELS,
} from './watermark';

// Schemas and types
export {
  docFrontmatterSchema,
  type DocFrontmatter,
  adrSchema,
  type AdrFrontmatter,
  threatModelSchema,
  type ThreatModelFrontmatter,
  runbookSchema,
  type RunbookFrontmatter,
  slidesSchema,
  type SlidesFrontmatter,
} from './schema';

// Validation
export {
  type ValidationResult,
  validateMarkdown,
  extractFrontmatter,
} from './validation';

// CSS bridge
export { deriveCssClasses } from './css-bridge';
