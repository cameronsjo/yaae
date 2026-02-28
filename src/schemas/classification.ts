export type BuiltinClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';

/** @deprecated Use string type for classification to support custom levels */
export type ClassificationLevel = BuiltinClassificationLevel;

export interface ClassificationMeta {
  level: string;
  label: string;
  color: string;
  background: string;
}

/** User-defined classification entry */
export interface CustomClassification {
  id: string;
  label: string;
  color: string;
  background: string;
}

export const CLASSIFICATION_TAXONOMY: Record<BuiltinClassificationLevel, ClassificationMeta> = {
  public: {
    level: 'public',
    label: 'PUBLIC',
    color: '#2d7d2d',
    background: '#f0faf0',
  },
  internal: {
    level: 'internal',
    label: 'INTERNAL — DO NOT DISTRIBUTE',
    color: '#b8860b',
    background: '#fff8e7',
  },
  confidential: {
    level: 'confidential',
    label: 'CONFIDENTIAL',
    color: '#c41e1e',
    background: '#fff5f5',
  },
  restricted: {
    level: 'restricted',
    label: 'RESTRICTED — AUTHORIZED PERSONNEL ONLY',
    color: '#8b0000',
    background: '#ffe0e0',
  },
};

/**
 * Look up classification metadata by level ID.
 * Custom classifications take precedence over built-in ones.
 */
export function getClassificationMeta(
  level: string,
  customClassifications: CustomClassification[] = [],
): ClassificationMeta | null {
  // Custom classifications override built-ins
  const custom = customClassifications.find((c) => c.id === level);
  if (custom) {
    return {
      level: custom.id,
      label: custom.label,
      color: custom.color,
      background: custom.background,
    };
  }

  // Fall back to built-in taxonomy
  if (Object.hasOwn(CLASSIFICATION_TAXONOMY, level)) {
    return CLASSIFICATION_TAXONOMY[level as BuiltinClassificationLevel];
  }

  return null;
}

/**
 * Get all known classification IDs (built-in + custom).
 */
export function getAllClassificationIds(
  customClassifications: CustomClassification[] = [],
): string[] {
  const builtinIds = Object.keys(CLASSIFICATION_TAXONOMY);
  const customIds = customClassifications.map((c) => c.id);
  // Custom IDs can shadow built-in ones; deduplicate
  return [...new Set([...builtinIds, ...customIds])];
}
