import type { ClassificationLevel, WatermarkLevel } from '@doc-forge/schemas';

export interface DocForgeSettings {
  defaultClassification: ClassificationLevel;
  defaultWatermarkForDrafts: WatermarkLevel;
  defaultHeaderLeft: string;
  defaultHeaderRight: string;
  defaultFooterLeft: string;
  defaultFooterRight: string;
  autoToc: boolean;
  tocDepth: number;
  expandLinks: boolean;
  pageNumbers: boolean;
  validateOnSave: boolean;
  showClassificationBanner: boolean;
  bannerPosition: 'top' | 'both';
}

export const DEFAULT_DOC_FORGE_SETTINGS: DocForgeSettings = {
  defaultClassification: 'internal',
  defaultWatermarkForDrafts: 'heads-up',
  defaultHeaderLeft: '',
  defaultHeaderRight: '',
  defaultFooterLeft: '',
  defaultFooterRight: '',
  autoToc: false,
  tocDepth: 3,
  expandLinks: true,
  pageNumbers: true,
  validateOnSave: true,
  showClassificationBanner: true,
  bannerPosition: 'top',
};
