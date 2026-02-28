import type { WatermarkLevel, CustomClassification } from '../schemas';

export type LinksMode = 'expand' | 'styled' | 'plain' | 'stripped' | 'defanged';
export type ThemeMode = 'light' | 'dark' | 'auto';
export type FontPreset = 'sans' | 'serif' | 'mono' | 'system';

export interface DocumentSettings {
  defaultClassification: string;
  defaultWatermarkForDrafts: WatermarkLevel;
  watermarkText: string;
  defaultHeaderLeft: string;
  defaultHeaderRight: string;
  defaultFooterLeft: string;
  defaultFooterRight: string;
  autoToc: boolean;
  tocDepth: number;
  links: LinksMode;
  theme: ThemeMode;
  fontFamily: FontPreset | string;
  fontSize: number;
  copyPasteSafe: boolean;
  compactTables: boolean;
  pageNumbers: boolean;
  lineHeight: number;
  validateOnSave: boolean;
  showClassificationBanner: boolean;
  bannerPosition: 'top' | 'both';
  customClassifications: CustomClassification[];
  // Deprecated: use `links` instead
  expandLinks: boolean;
  plainLinks: boolean;
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
  defaultClassification: 'internal',
  defaultWatermarkForDrafts: 'heads-up',
  watermarkText: 'DRAFT',
  defaultHeaderLeft: '',
  defaultHeaderRight: '',
  defaultFooterLeft: '',
  defaultFooterRight: '',
  autoToc: false,
  tocDepth: 3,
  links: 'expand',
  theme: 'light',
  fontFamily: 'sans',
  fontSize: 11,
  copyPasteSafe: true,
  compactTables: true,
  pageNumbers: true,
  lineHeight: 1.6,
  validateOnSave: true,
  showClassificationBanner: true,
  bannerPosition: 'top',
  customClassifications: [],
  expandLinks: true,
  plainLinks: false,
};
