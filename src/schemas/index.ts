// Classification taxonomy
export {
  type ClassificationLevel,
  type BuiltinClassificationLevel,
  type ClassificationMeta,
  type CustomClassification,
  CLASSIFICATION_TAXONOMY,
  getClassificationMeta,
  getAllClassificationIds,
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
export { deriveCssClasses, resolveLinksMode } from './css-bridge';
