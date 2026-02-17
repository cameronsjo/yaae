import type { WatermarkLevel } from '../schemas';
import type { CustomClassification } from '../schemas/classification';

export interface DocumentSettings {
  defaultClassification: string;
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
  customClassifications: CustomClassification[];
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
  customClassifications: [],
};
