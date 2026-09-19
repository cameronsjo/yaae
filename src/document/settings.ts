import type { WatermarkLevel, CustomClassification } from "../schemas";

export type LinksMode = "expand" | "styled" | "plain" | "stripped" | "defanged";
export type ThemeMode = "light" | "dark" | "auto";
export type FontPreset = "sans" | "serif" | "mono" | "system";

/**
 * Per-level watermark preset overrides. Every field is optional — absent
 * fields inherit from the hardcoded defaults in WATERMARK_PRESETS.
 * Users configure these via the plugin's data.json (advanced settings).
 */
export interface WatermarkPresetOverride {
 opacity?: number;
 fontSize?: number;
 fontWeight?: number;
 tileSize?: number;
 rotation?: number;
}

export type WatermarkPresetOverrides = Partial<
 Record<WatermarkLevel, WatermarkPresetOverride>
>;

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
 bannerPosition: "top" | "both";
 customClassifications: CustomClassification[];
 /** Optional per-level watermark preset overrides (#27). */
 watermarkPresets: WatermarkPresetOverrides;
 // Deprecated: use `links` instead
 expandLinks: boolean;
 plainLinks: boolean;
}

export const DEFAULT_DOCUMENT_SETTINGS: DocumentSettings = {
 defaultClassification: "internal",
 defaultWatermarkForDrafts: "heads-up",
 watermarkText: "DRAFT",
 defaultHeaderLeft: "",
 defaultHeaderRight: "",
 defaultFooterLeft: "",
 defaultFooterRight: "",
 autoToc: false,
 tocDepth: 3,
 links: "expand",
 theme: "light",
 fontFamily: "sans",
 fontSize: 11,
 copyPasteSafe: true,
 compactTables: true,
 pageNumbers: true,
 lineHeight: 1.5,
 validateOnSave: true,
 showClassificationBanner: false,
 bannerPosition: "top",
 customClassifications: [],
 watermarkPresets: {},
 expandLinks: true,
 plainLinks: false,
};
