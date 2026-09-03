/**
 * Print pipeline state — one struct capturing everything the three style
 * elements render from. Built by main.ts from settings + the active
 * document's frontmatter; generation stays pure functions of this state.
 */

import type { CustomClassification } from "../../schemas/classification";
import type {
  DocumentSettings,
  LinksMode,
  ThemeMode,
  FontPreset,
} from "../settings";
import type { WatermarkLevel, DocFrontmatter } from "../../schemas";
import { resolveLinksMode } from "../../schemas";
import type { WatermarkPresetOverrides } from "../settings";

export interface PrintDocumentState {
  // Chrome (banners / headers / footers / page numbers)
  classification: string | null;
  customClassifications: CustomClassification[];
  headerLeft: string;
  headerRight: string;
  footerLeft: string;
  footerRight: string;
  pageNumbers: boolean;
  signatureBlock: boolean;
  bannerPosition: "top" | "both";
  showClassificationBanner: boolean;
  /** Theme mode — global setting unless export.pdf.theme overrides. */
  theme: ThemeMode;

  // Document appearance (state-baked; body classes are a courtesy layer)
  fontFamily: FontPreset | string;
  fontSize: number;
  lineHeight: number;
  /** Active watermark level for THIS document ('off' = none). */
  watermark: WatermarkLevel;
  watermarkText: string;
  /** Per-level watermark preset overrides from settings (#27). */
  watermarkPresets: WatermarkPresetOverrides;
  linksMode: LinksMode;
  copyPasteSafe: boolean;
  compactTables: boolean;
}

/** The active document's frontmatter, in both raw and validated forms. */
export interface ActiveDocFrontmatter {
  /** Raw gray-matter output — presence checks (was a key actually written?). */
  raw: Record<string, unknown> | null;
  /** Schema-validated data — value reads (range-checked, coerced). */
  validated: DocFrontmatter | undefined;
}

/**
 * Merge settings defaults with the active document's frontmatter overrides.
 *
 * Every per-document override is PRESENCE-GATED on the raw frontmatter: the
 * Zod schema fills defaults for absent fields (fontSize 11, copyPasteSafe
 * true, …), so reading validated values directly would let schema defaults
 * shadow the user's settings — the placebo-slider bug class. A field
 * overrides only when the author actually wrote it; its VALUE then comes
 * from the validated (range-checked) form.
 */
export function buildPrintDocumentState(
  settings: DocumentSettings,
  doc?: ActiveDocFrontmatter,
): PrintDocumentState {
  const state: PrintDocumentState = {
    classification: settings.defaultClassification,
    customClassifications: settings.customClassifications,
    headerLeft: settings.defaultHeaderLeft,
    headerRight: settings.defaultHeaderRight,
    footerLeft: settings.defaultFooterLeft,
    footerRight: settings.defaultFooterRight,
    pageNumbers: settings.pageNumbers,
    signatureBlock: false,
    bannerPosition: settings.bannerPosition,
    showClassificationBanner: settings.showClassificationBanner,
    theme: settings.theme,
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    watermark: "off",
    watermarkText: settings.watermarkText,
    watermarkPresets: settings.watermarkPresets,
    linksMode: settings.links,
    copyPasteSafe: settings.copyPasteSafe,
    compactTables: settings.compactTables,
  };

  if (!doc?.validated) return state;
  const v = doc.validated;
  const raw = doc.raw ?? {};
  const rawPdf =
    isRecord(raw.export) && isRecord(raw.export.pdf) ? raw.export.pdf : {};
  const vPdf = v.export?.pdf;

  // Presence-gated like every pdf field: the schema defaults classification
  // to 'internal', so reading the validated value unconditionally would let
  // that default shadow the user's defaultClassification setting on any note
  // without an explicit classification key — silently wrong banners on the
  // security-classification feature itself.
  if ("classification" in raw && v.classification) {
    state.classification = v.classification;
  }
  if (vPdf) {
    if ("theme" in rawPdf && vPdf.theme) state.theme = vPdf.theme as ThemeMode;
    if ("signatureBlock" in rawPdf)
      state.signatureBlock = vPdf.signatureBlock === true;
    if ("fontFamily" in rawPdf && vPdf.fontFamily)
      state.fontFamily = vPdf.fontFamily;
    if ("fontSize" in rawPdf && typeof vPdf.fontSize === "number")
      state.fontSize = vPdf.fontSize;
    if ("lineHeight" in rawPdf && typeof vPdf.lineHeight === "number")
      state.lineHeight = vPdf.lineHeight;
    if ("copyPasteSafe" in rawPdf)
      state.copyPasteSafe = vPdf.copyPasteSafe !== false;
    if ("compactTables" in rawPdf)
      state.compactTables = vPdf.compactTables !== false;
    if ("pageNumbers" in rawPdf) state.pageNumbers = vPdf.pageNumbers !== false;
    if ("headerLeft" in rawPdf && typeof vPdf.headerLeft === "string")
      state.headerLeft = vPdf.headerLeft;
    if ("headerRight" in rawPdf && typeof vPdf.headerRight === "string")
      state.headerRight = vPdf.headerRight;
    if ("footerLeft" in rawPdf && typeof vPdf.footerLeft === "string")
      state.footerLeft = vPdf.footerLeft;
    if ("footerRight" in rawPdf && typeof vPdf.footerRight === "string")
      state.footerRight = vPdf.footerRight;
    if (
      "watermarkText" in rawPdf &&
      typeof vPdf.watermarkText === "string" &&
      vPdf.watermarkText
    ) {
      state.watermarkText = vPdf.watermarkText;
    }
    // Links mode carries a deprecated-boolean migration; resolveLinksMode
    // owns that rule. Presence = any of the three legacy/current keys.
    if (
      "links" in rawPdf ||
      "plainLinks" in rawPdf ||
      "expandLinks" in rawPdf
    ) {
      state.linksMode = resolveLinksMode(vPdf);
    }
  }

  // Watermark: explicit frontmatter wins; else an EXPLICIT draft status
  // engages the "default watermark for drafts" setting. The status check is
  // raw-gated on purpose — the schema defaults status to 'draft', and
  // watermarking every unstamped note would be a surprise.
  if ("watermark" in rawPdf && vPdf?.watermark) {
    state.watermark = vPdf.watermark;
  } else if (raw.status === "draft") {
    state.watermark = settings.defaultWatermarkForDrafts;
  }

  return state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
