/**
 * Generates a GitHub-compatible Table of Contents from markdown headings.
 * Idempotent: replaces existing TOC block if found, otherwise inserts after frontmatter.
 *
 * #26 — TOC anchor links (`[Section](#section)`) render as clickable links in exported
 * PDFs but do NOT navigate to the target heading. This is an Obsidian PDF export
 * limitation: Chromium's print-to-PDF pipeline does not resolve intra-document anchor
 * links. The TOC is still useful as a visual index of section hierarchy. If Chromium's
 * print engine adds anchor support in the future, the links will work without changes.
 */

import { extractFrontmatter } from "../schemas";

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
   .replace(/\[\^[^\]]+\]/g, "")
   // Image links: ![alt](url) → alt
   .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
   // Wikilink with display: [[target|display]] → display
   .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
   // Plain wikilink: [[target]] → target
   .replace(/\[\[([^\]]+)\]\]/g, "$1")
   // Inline link: [text](url) → text
   .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
   // Inline code: `code` → code
   .replace(/`([^`]+)`/g, "$1")
   // Inline math: $expr$ → expr
   .replace(/\$([^$]+)\$/g, "$1")
   // Bold/italic markers: **text** / *text* / __text__ / _text_
   .replace(/(\*\*|__)(.+?)\1/g, "$2")
   .replace(/(\*|_)([^*_]+?)\1/g, "$2")
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
  .replace(/[^\w\s-]/g, "")
  .replace(/\s+/g, "-")
  .replace(/^-+|-+$/g, "");
}

/**
 * Strip one trailing `\r` so CRLF content compares cleanly. All boundary
 * checks (`---`, the TOC heading) go through this — raw `===` against lines
 * from `split('\n')` never matches on Windows line endings, which silently
 * disabled TOC detection for CRLF-authored notes.
 */
function stripCr(line: string): string {
 return line.endsWith("\r") ? line.slice(0, -1) : line;
}

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
 if (lines.length === 0 || stripCr(lines[0]) !== "---") return -1;

 for (let i = 1; i < lines.length; i++) {
  if (stripCr(lines[i]) === "---") return i;
 }
 return -1;
}

/**
 * True when line 0 opens frontmatter (`---`) that never closes. The document
 * is in an indeterminate state — usually mid-edit, with the body about to be
 * fenced off as YAML — so TOC writers must refuse to touch it: scanning the
 * preamble as body would fabricate TOC entries from YAML `#` comments and
 * splice a TOC block into what the author intends as frontmatter.
 */
function hasUnclosedFrontmatter(lines: string[]): boolean {
 return (
  lines.length > 0 &&
  stripCr(lines[0]) === "---" &&
  findFrontmatterCloseLine(lines) === -1
 );
}

/** A body line (outside frontmatter and code fences) with its char offset. */
interface BodyLine {
 /** Comparison-ready text (trailing \r stripped). */
 line: string;
 /** Char offset of the line start within the original content. */
 start: number;
 /** Raw line length including any \r, excluding the \n. */
 rawLength: number;
}

/**
 * Collect body lines — outside frontmatter, outside fenced code blocks —
 * with character offsets. This is the single source of truth for the fence
 * and frontmatter rules shared by heading parsing and TOC-block detection:
 * a fence-handling fix applied to one consumer and not the other would
 * reopen the fenced-sample corruption hole (a TOC spliced into a code block
 * that merely *documents* a TOC). Returns null for unclosed frontmatter —
 * indeterminate documents have no scannable body.
 *
 * Fence rule: a `~~~` line inside a backtick fence (or vice versa) must NOT
 * close the outer block, so we track which marker opened the fence and only
 * close on a matching marker.
 */
function collectBodyLines(content: string): BodyLine[] | null {
 const lines = content.split("\n");
 if (hasUnclosedFrontmatter(lines)) return null;
 const fmCloseLine = findFrontmatterCloseLine(lines);

 const body: BodyLine[] = [];
 let activeFence: "```" | "~~~" | null = null;
 let offset = 0;

 for (let i = 0; i < lines.length; i++) {
  const raw = lines[i];
  const start = offset;
  offset += raw.length + 1; // +1 for the '\n' consumed by split

  if (i <= fmCloseLine) continue;

  const line = stripCr(raw);
  const fenceMatch = line.trimStart().match(/^(```+|~~~+)/);
  if (fenceMatch) {
   const marker = fenceMatch[1].startsWith("`") ? "```" : "~~~";
   if (activeFence === null) activeFence = marker;
   else if (activeFence === marker) activeFence = null;
   continue;
  }
  if (activeFence !== null) continue;

  body.push({ line, start, rawLength: raw.length });
 }
 return body;
}

/** Parse headings from markdown, skipping frontmatter and code blocks */
function parseHeadings(content: string, maxDepth: number): TocEntry[] {
 const body = collectBodyLines(content);
 if (body === null) return [];

 const entries: TocEntry[] = [];
 for (const { line } of body) {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (match) {
   const level = match[1].length;
   const rawText = match[2].trim();
   const displayText = stripInlineMarkdown(rawText);

   // Skip the TOC heading itself
   if (displayText === "Table of Contents") continue;

   if (level <= maxDepth) {
    entries.push({ level, text: displayText, slug: slugify(rawText) });
   }
  }
 }

 return entries;
}

/** Build the TOC markdown block */
function buildTocBlock(entries: TocEntry[]): string {
 const lines = ["## Table of Contents", ""];

 // Indent relative to the shallowest heading we saw — H1 then H3 with no H2
 // should still nest by one level, not by two.
 const minLevel =
  entries.length > 0 ? Math.min(...entries.map((e) => e.level)) : 1;

 for (const entry of entries) {
  const depth = Math.max(0, entry.level - minLevel);
  const indent = "  ".repeat(depth);
  lines.push(`${indent}- [${entry.text}](#${entry.slug})`);
 }

 lines.push("", "---");
 return lines.join("\n");
}

/** Character span of an existing TOC block within the content. */
interface TocBlockSpan {
 start: number;
 end: number;
}

/**
 * Locate the generated TOC block — the `## Table of Contents` heading line
 * through its terminating `---` line — in body position only. Fenced samples
 * (a note documenting this plugin) and frontmatter content never match, and
 * indeterminate (unclosed-frontmatter) documents scan as having no block.
 * Returns character offsets, or null when no TOC block exists.
 */
function findTocBlock(content: string): TocBlockSpan | null {
 const body = collectBodyLines(content);
 if (body === null) return null;

 let blockStart = -1;
 for (const { line, start, rawLength } of body) {
  if (blockStart === -1) {
   if (line === "## Table of Contents") blockStart = start;
  } else if (line === "---") {
   return { start: blockStart, end: start + rawLength };
  }
 }
 return null;
}

/**
 * True when the content already contains a generated TOC block (in body
 * position — fenced samples don't count). Auto-TOC uses this as its opt-in
 * gate: only notes that inserted a TOC once (via the generate command) are
 * kept fresh automatically.
 */
export function hasToc(content: string): boolean {
 return findTocBlock(content) !== null;
}

/**
 * Resolve the TOC depth for a document: the per-file frontmatter override
 * (`export.pdf.tocDepth`) wins over the supplied settings default. Shared by
 * the manual generate command and auto-TOC so the precedence rule lives in
 * one place.
 *
 * Reads the RAW frontmatter and range-checks locally (mirroring the schema's
 * 1-6 integer constraint) rather than routing through full document
 * validation: the Zod schema fills tocDepth with a default (so validated
 * output can't distinguish "author wrote it" from "schema filled it in"),
 * and requiring whole-document validity would silently drop an explicit
 * override whenever an unrelated field (say, a missing title) fails.
 */
export function resolveTocDepth(content: string, defaultDepth: number): number {
 const raw = extractFrontmatter(content) as {
  export?: { pdf?: { tocDepth?: unknown } };
 } | null;
 const value = raw?.export?.pdf?.tocDepth;
 if (value == null) return defaultDepth;
 const depth = typeof value === "number" ? value : Number(value);
 return Number.isInteger(depth) && depth >= 1 && depth <= 6
  ? depth
  : defaultDepth;
}

/**
 * Generate or replace the Table of Contents in markdown content.
 * Returns the updated content and the number of TOC entries.
 */
export function generateToc(
 content: string,
 maxDepth: number = 3,
): { content: string; entryCount: number } {
 // Indeterminate frontmatter (opened at line 0, never closed — usually
 // mid-edit): refuse to modify. The manual command reports 0 entries; the
 // auto path sees unchanged content and skips its write.
 const lines = content.split("\n");
 if (hasUnclosedFrontmatter(lines)) {
  return { content, entryCount: 0 };
 }

 const entries = parseHeadings(content, maxDepth);
 const tocBlock = buildTocBlock(entries);

 // Replace an existing TOC block (fence/frontmatter-aware span)
 const existing = findTocBlock(content);
 if (existing) {
  return {
   content:
    content.slice(0, existing.start) + tocBlock + content.slice(existing.end),
   entryCount: entries.length,
  };
 }

 // Insert after frontmatter close, if any
 const fmCloseLine = findFrontmatterCloseLine(lines);
 if (fmCloseLine !== -1) {
  const before = lines.slice(0, fmCloseLine + 1).join("\n");
  const after = lines.slice(fmCloseLine + 1).join("\n");
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
