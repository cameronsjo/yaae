import type { ClassificationLevel, WatermarkLevel } from '../schemas';

export interface DocumentSettings {
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

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
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
