export type ClassificationLevel = 'public' | 'internal' | 'confidential' | 'restricted';

export interface ClassificationMeta {
  level: ClassificationLevel;
  label: string;
  color: string;
  background: string;
}

export const CLASSIFICATION_TAXONOMY: Record<ClassificationLevel, ClassificationMeta> = {
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
