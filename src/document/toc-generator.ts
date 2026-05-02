/**
 * Generates a GitHub-compatible Table of Contents from markdown headings.
 * Idempotent: replaces existing TOC block if found, otherwise inserts after frontmatter.
 */

interface TocEntry {
  level: number;
  text: string;
  slug: string;
}

/**
 * Strip markdown inline syntax to recover plain rendered text. Used for both
 * slug generation and TOC display so anchors and labels match what Obsidian
 * actually renders for the heading.
 */
function stripInlineMarkdown(text: string): string {
  return (
    text
      // Footnote references: [^1] → ''
      .replace(/\[\^[^\]]+\]/g, '')
      // Image links: ![alt](url) → alt
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Wikilink with display: [[target|display]] → display
      .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, '$1')
      // Plain wikilink: [[target]] → target
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      // Inline link: [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Inline code: `code` → code
      .replace(/`([^`]+)`/g, '$1')
      // Inline math: $expr$ → expr
      .replace(/\$([^$]+)\$/g, '$1')
      // Bold/italic markers: **text** / *text* / __text__ / _text_
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(\*|_)([^*_]+?)\1/g, '$2')
      .trim()
  );
}

/**
 * Convert heading text to an Obsidian-compatible anchor slug.
 *
 * Obsidian's heading anchors lowercase the text, replace whitespace runs
 * with single hyphens, and strip non-alphanumeric characters except hyphens.
 * Inline markdown is stripped first so headings like `## Foo [bar](./b.md)`
 * produce `foo-bar`, not a broken anchor with link punctuation embedded.
 */
function slugify(text: string): string {
  return stripInlineMarkdown(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Parse headings from markdown, skipping frontmatter and code blocks */
function parseHeadings(content: string, maxDepth: number): TocEntry[] {
  const lines = content.split('\n');
  const entries: TocEntry[] = [];
  let inFrontmatter = false;
  let activeFence: '```' | '~~~' | null = null;
  let frontmatterClosed = false;

  for (const line of lines) {
    // Track frontmatter — open and close markers must be exactly `---` with
    // no leading whitespace, otherwise an indented `---` inside a YAML block
    // scalar (e.g. `description: |\n  ---`) would be misread as a fence.
    if (line === '---') {
      if (!frontmatterClosed) {
        inFrontmatter = !inFrontmatter;
        if (!inFrontmatter) frontmatterClosed = true;
        continue;
      }
    }
    if (inFrontmatter) continue;

    // Track code blocks. A `~~~` line inside a backtick fence (or vice versa)
    // must NOT close the outer block, so track which marker opened the fence
    // and only close on a matching marker.
    const fenceMatch = line.trimStart().match(/^(```+|~~~+)/);
    if (fenceMatch) {
      const marker = fenceMatch[1].startsWith('`') ? '```' : '~~~';
      if (activeFence === null) activeFence = marker;
      else if (activeFence === marker) activeFence = null;
      continue;
    }
    if (activeFence !== null) continue;

    // Match headings
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();
      const displayText = stripInlineMarkdown(rawText);

      // Skip the TOC heading itself
      if (displayText === 'Table of Contents') continue;

      if (level <= maxDepth) {
        entries.push({ level, text: displayText, slug: slugify(rawText) });
      }
    }
  }

  return entries;
}

/** Build the TOC markdown block */
function buildTocBlock(entries: TocEntry[]): string {
  const lines = ['## Table of Contents', ''];

  // Indent relative to the shallowest heading we saw — H1 then H3 with no H2
  // should still nest by one level, not by two.
  const minLevel =
    entries.length > 0 ? Math.min(...entries.map((e) => e.level)) : 1;

  for (const entry of entries) {
    const depth = Math.max(0, entry.level - minLevel);
    const indent = '  '.repeat(depth);
    lines.push(`${indent}- [${entry.text}](#${entry.slug})`);
  }

  lines.push('', '---');
  return lines.join('\n');
}

/** TOC block detection pattern: ## Table of Contents ... --- */
const TOC_PATTERN = /## Table of Contents\n[\s\S]*?\n---/;

/**
 * Locate the line index of the frontmatter close marker (`---`).
 *
 * Walks line-by-line so block scalars containing literal `---` (e.g.
 * `description: |\n  ---\n  divider\n`) don't trick us into treating an
 * embedded `---` as the close marker. The open and close markers must be
 * exactly `---` with no leading whitespace — indented content inside a YAML
 * block scalar is part of the value, not a fence. Returns `-1` if no
 * frontmatter is present (or if the block never closes).
 */
function findFrontmatterCloseLine(lines: string[]): number {
  if (lines.length === 0 || lines[0] !== '---') return -1;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') return i;
  }
  return -1;
}

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

  // Insert after frontmatter close, if any
  const lines = content.split('\n');
  const fmCloseLine = findFrontmatterCloseLine(lines);
  if (fmCloseLine !== -1) {
    const before = lines.slice(0, fmCloseLine + 1).join('\n');
    const after = lines.slice(fmCloseLine + 1).join('\n');
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
