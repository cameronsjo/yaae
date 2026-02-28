import type { DocFrontmatter } from './schema';

type LinksMode = 'expand' | 'styled' | 'plain' | 'stripped' | 'defanged';

/**
 * Resolve the effective links mode from frontmatter.
 * The `links` enum takes precedence. If it's at default ('expand'),
 * fall back to deprecated boolean fields for backwards compatibility.
 */
export function resolveLinksMode(pdf: DocFrontmatter['export']['pdf']): LinksMode {
  // If links is explicitly set to a non-default value, use it
  if (pdf.links && pdf.links !== 'expand') {
    return pdf.links;
  }

  // Fall back to deprecated booleans
  if (pdf.plainLinks) {
    console.debug('[yaae] Resolved links mode from deprecated plainLinks boolean → plain');
    return 'plain';
  }
  if (pdf.expandLinks === false) {
    console.debug('[yaae] Resolved links mode from deprecated expandLinks boolean → styled');
    return 'styled';
  }

  return pdf.links ?? 'expand';
}

export function deriveCssClasses(frontmatter: DocFrontmatter): string[] {
  const classes: string[] = [];

  // Classification
  if (frontmatter.classification) {
    classes.push(`pdf-${frontmatter.classification}`);
  }

  // Status
  if (frontmatter.status) {
    classes.push(`pdf-${frontmatter.status}`);
  }

  // Watermark
  const watermark = frontmatter.export?.pdf?.watermark;
  if (watermark && watermark !== 'off') {
    classes.push(`pdf-watermark-${watermark}`);
  }

  const pdf = frontmatter.export?.pdf;
  if (pdf) {
    // Links
    const linksMode = resolveLinksMode(pdf);
    if (linksMode === 'styled') classes.push('pdf-links-styled');
    if (linksMode === 'plain') classes.push('pdf-links-plain');
    if (linksMode === 'stripped') classes.push('pdf-links-stripped');
    if (linksMode === 'defanged') classes.push('pdf-links-defanged');

    // Theme
    if (pdf.theme === 'dark') classes.push('pdf-theme-dark');
    if (pdf.theme === 'auto') classes.push('pdf-theme-auto');

    // Font family (only named presets get classes; custom strings use dynamic styles)
    if (pdf.fontFamily === 'sans') classes.push('pdf-font-sans');
    if (pdf.fontFamily === 'serif') classes.push('pdf-font-serif');
    if (pdf.fontFamily === 'mono') classes.push('pdf-font-mono');

    // Copy-paste safe (default true, so class is present by default)
    if (pdf.copyPasteSafe !== false) classes.push('pdf-copy-safe');

    // Compact tables (default true, so class is present by default)
    if (pdf.compactTables !== false) classes.push('pdf-compact-tables');

    // Landscape
    if (pdf.landscape) classes.push('pdf-landscape');

    // Skip cover page number
    if (pdf.skipCover) classes.push('pdf-skip-cover');

    // TOC
    if (pdf.toc) classes.push('pdf-toc');

    // Page numbers (default true — class disables them)
    if (pdf.pageNumbers === false) classes.push('pdf-no-page-numbers');

    // Signature block
    if (pdf.signatureBlock) classes.push('pdf-signature-block');
  }

  return classes;
}
