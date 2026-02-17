import type { DocFrontmatter } from './schema';

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

  // Link expansion
  if (frontmatter.export?.pdf?.expandLinks === false) {
    classes.push('pdf-no-links');
  }

  // Plain links (strip link styling in print)
  if (frontmatter.export?.pdf?.plainLinks) {
    classes.push('pdf-plain-links');
  }

  // Skip cover page number
  if (frontmatter.export?.pdf?.skipCover) {
    classes.push('pdf-skip-cover');
  }

  // TOC
  if (frontmatter.export?.pdf?.toc) {
    classes.push('pdf-toc');
  }

  return classes;
}
