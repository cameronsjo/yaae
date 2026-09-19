/**
 * Watermark SVG generation. background-image on the view container is the
 * one watermark mechanism Obsidian's PDF export preserves (no pseudo-
 * elements, no .print > div — see the PDF export architecture field report).
 */

import type { FontPreset } from "../settings";
import type { WatermarkPresetOverrides } from "../settings";

/**
 * Per-level watermark presets — an opacity-only ramp (same tile size, font,
 * rotation across levels). Intensity increases whisper → screaming.
 *
 * Users can override individual values per level via
 * DocumentSettings.watermarkPresets (#27).
 */
export const WATERMARK_PRESETS = {
 whisper: {
  opacity: 0.03,
  fontSize: 100,
  fontWeight: 700,
  tileSize: 400,
  rotation: -35,
 },
 "heads-up": {
  opacity: 0.07,
  fontSize: 100,
  fontWeight: 700,
  tileSize: 400,
  rotation: -35,
 },
 loud: {
  opacity: 0.14,
  fontSize: 100,
  fontWeight: 700,
  tileSize: 400,
  rotation: -35,
 },
 screaming: {
  opacity: 0.25,
  fontSize: 100,
  fontWeight: 700,
  tileSize: 400,
  rotation: -35,
 },
} as const;

export type WatermarkPresetLevel = keyof typeof WATERMARK_PRESETS;

/** Map named font presets to SVG-safe font-family values. */
export const FONT_PRESET_SVG: Record<FontPreset, string> = {
 sans: "sans-serif",
 serif: "Georgia, Times New Roman, serif",
 mono: "Consolas, Courier New, monospace",
 system: "sans-serif",
};

/** Escape all XML-special characters for safe embedding in SVG attributes and text. */
function escapeXml(value: string): string {
 return value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");
}

/**
 * Build a tiling SVG data URI for the watermark overlay.
 * The text is URL-encoded so special characters (quotes, ampersands) are safe.
 */
export function buildWatermarkDataUri(
 level: WatermarkPresetLevel,
 text: string,
 fontFamily = "sans-serif",
 overrides?: WatermarkPresetOverrides,
): string {
 const base = WATERMARK_PRESETS[level];
 const levelOverrides = overrides?.[level] ?? {};
 const p = { ...base, ...levelOverrides };
 const half = p.tileSize / 2;
 const encoded = escapeXml(text);
 const escapedFont = escapeXml(fontFamily);

 const svg =
  `<svg xmlns='http://www.w3.org/2000/svg' width='${p.tileSize}' height='${p.tileSize}'>` +
  `<text x='50%' y='50%' text-anchor='middle' dominant-baseline='middle' ` +
  `font-family='${escapedFont}' font-size='${p.fontSize}' font-weight='${p.fontWeight}' ` +
  `fill='rgba(0,0,0,${p.opacity})' ` +
  `transform='rotate(${p.rotation},${half},${half})'>` +
  `${encoded}</text></svg>`;

 return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
