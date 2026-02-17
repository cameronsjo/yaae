/**
 * Generates a GitHub-compatible Table of Contents from markdown headings.
 * Idempotent: replaces existing TOC block if found, otherwise inserts after frontmatter.
 */

interface TocEntry {
  level: number;
  text: string;
  slug: string;
}

/** Convert heading text to GitHub-compatible anchor slug */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

/** Parse headings from markdown, skipping frontmatter and code blocks */
function parseHeadings(content: string, maxDepth: number): TocEntry[] {
  const lines = content.split('\n');
  const entries: TocEntry[] = [];
  let inFrontmatter = false;
  let inCodeBlock = false;
  let frontmatterClosed = false;

  for (const line of lines) {
    // Track frontmatter
    if (line.trim() === '---') {
      if (!frontmatterClosed) {
        inFrontmatter = !inFrontmatter;
        if (!inFrontmatter) frontmatterClosed = true;
        continue;
      }
    }
    if (inFrontmatter) continue;

    // Track code blocks
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // Match headings
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();

      // Skip the TOC heading itself
      if (text === 'Table of Contents') continue;

      if (level <= maxDepth) {
        entries.push({ level, text, slug: slugify(text) });
      }
    }
  }

  return entries;
}

/** Build the TOC markdown block */
function buildTocBlock(entries: TocEntry[]): string {
  const lines = ['## Table of Contents', ''];

  for (const entry of entries) {
    const indent = '  '.repeat(entry.level - 1);
    lines.push(`${indent}- [${entry.text}](#${entry.slug})`);
  }

  lines.push('', '---');
  return lines.join('\n');
}

/** TOC block detection pattern: ## Table of Contents ... --- */
const TOC_PATTERN = /## Table of Contents\n[\s\S]*?\n---/;

/**
 * Generate or replace the Table of Contents in markdown content.
 * Returns the updated content and the number of TOC entries.
 */
export function generateToc(
  content: string,
  maxDepth: number = 3,
): { content: string; entryCount: number } {
  const entries = parseHeadings(content, maxDepth);
  const tocBlock = buildTocBlock(entries);

  // Check if TOC already exists
  if (TOC_PATTERN.test(content)) {
    return {
      content: content.replace(TOC_PATTERN, tocBlock),
      entryCount: entries.length,
    };
  }

  // Insert after frontmatter closing ---
  const fmClose = content.indexOf('---', content.indexOf('---') + 3);
  if (fmClose !== -1) {
    const insertPos = fmClose + 3;
    const before = content.slice(0, insertPos);
    const after = content.slice(insertPos);
    return {
      content: `${before}\n\n${tocBlock}\n${after}`,
      entryCount: entries.length,
    };
  }

  // No frontmatter, prepend
  return {
    content: `${tocBlock}\n\n${content}`,
    entryCount: entries.length,
  };
}
