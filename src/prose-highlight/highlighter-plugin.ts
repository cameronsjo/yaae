import {
  ViewPlugin,
  type ViewUpdate,
  Decoration,
  type DecorationSet,
  type EditorView,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type YaaePlugin from "../../main";
import type { POSTag } from "./tagger";
import { CompromiseTagger } from "./tagger";
import { WordListMatcher } from "./word-lists";
import type { WordListMatch } from "./word-lists";
import type { POSCategory } from "../types";
import { recordProseHighlightError } from "./debug";

/** Markdown node types to exclude from NLP processing */
const EXCLUDED_NODE_TYPES = new Set([
  "CodeBlock",
  "FencedCode",
  "InlineCode",
  "HyperMD-codeblock",
  "HyperMD-codeblock-begin",
  "HyperMD-codeblock-end",
  "inline-code",
  "CodeText",
  "CodeInfo",
  "CodeMark",
  "FrontMatter",
  "YAMLFrontMatter",
  "hmd-frontmatter",
  "URL",
  "LinkMark",
  "formatting",
  "formatting-code",
  "formatting-code-block",
  "comment",
  "CommentBlock",
  "HTMLTag",
  // Table headers — structural, not prose
  "HyperMD-table-title",
  "HyperMD-table-title-line",
  "table-header",
  "TableHeader",
]);

/** Node types that indicate their children should also be excluded */
const EXCLUDED_PARENT_TYPES = new Set([
  "FencedCode",
  "CodeBlock",
  "FrontMatter",
  "YAMLFrontMatter",
  "CommentBlock",
]);

/**
 * A markdown ATX heading line (`#`..`######` then a space), tolerating up to
 * three leading spaces (CommonMark; four+ is a code indent) and any depth of
 * blockquote markers (`> # H`, `>> ## H`). By default POS highlighting skips
 * these — heading text is chrome, not prose, and a tinted word inside an h2
 * reads as a glitch (Artificer #40). The trailing `\s` is required: a bare
 * `#foo` with no space is not a heading.
 *
 * Setext headings (a title line underlined by `===`/`---`) are NOT detected
 * here: the title's heading-ness depends on the *next* line, but the editor
 * retags one line at a time (the single-char-insert fast path), so a
 * neighbor-dependent check can't stay correct incrementally. Reading View
 * renders setext as real <h1>/<h2> and skips it via buildSkipSelectors, so
 * the gap is editor-only and accepted.
 */
const HEADING_LINE = /^ {0,3}(?:> ?)*#{1,6}\s/;

/** True when a source line is an ATX heading (skipped by default, #40). */
export function isHeadingLine(lineText: string): boolean {
  return HEADING_LINE.test(lineText);
}

/**
 * Case-insensitive substrings that mark a node family as non-prose. Catches
 * HyperMD/Lezer naming variants (casing, `hmd-*` forms) that the exact-match
 * Set above does not enumerate — e.g. `formatting-code`, `hmd-codeblock`,
 * `CodeText` all contain `code`. Kept to code/frontmatter/comment families so
 * structural nodes (`Document`, `Paragraph`, …) are never swept in.
 */
const EXCLUDED_NAME_SUBSTRINGS = ["code", "frontmatter", "comment"];

/**
 * Whether a syntax-tree node name marks content that must not be tagged.
 * Exact-match against the enumerated set, then a substring allowlist so
 * unenumerated code/frontmatter/comment variants are still excluded.
 */
export function isExcludedNodeType(name: string): boolean {
  if (EXCLUDED_NODE_TYPES.has(name)) return true;
  const lower = name.toLowerCase();
  return EXCLUDED_NAME_SUBSTRINGS.some((s) => lower.includes(s));
}

interface LineTags {
  posTags: POSTag[];
  listMatches: WordListMatch[];
}

/** Default capacity of the content-keyed tag cache (see LineTagCache). */
const DEFAULT_CACHE_CAPACITY = 4096;

/**
 * LRU cache from line TEXT (not line number) to its unfiltered POS/list-match
 * tags. Keying by content — not position — means an Enter, paste, or undo
 * that shifts line numbers around unchanged text is still a cache hit: the
 * tags are a pure function of the text, so identical lines legitimately share
 * one entry. Exclusion (code blocks, headings, etc.) is NOT applied here; it
 * depends on the line's position in the syntax tree, so it's applied by the
 * caller at decoration-build time instead.
 *
 * LRU by ACCESS order: a `get()` hit re-inserts the key so it counts as
 * recently used, not just recently written. `Map` iteration order is
 * insertion order, so the first key is always the least recently used one.
 */
export class LineTagCache {
  private readonly capacity: number;
  private readonly map = new Map<string, LineTags>();

  constructor(capacity: number = DEFAULT_CACHE_CAPACITY) {
    this.capacity = capacity;
  }

  get size(): number {
    return this.map.size;
  }

  get(text: string): LineTags | undefined {
    const tags = this.map.get(text);
    if (tags === undefined) return undefined;
    // Re-insert to mark as most recently accessed.
    this.map.delete(text);
    this.map.set(text, tags);
    return tags;
  }

  set(text: string, tags: LineTags): void {
    this.map.delete(text);
    this.map.set(text, tags);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }
}

/**
 * Collect ranges within the visible viewport that should be excluded
 * from NLP processing (code blocks, frontmatter, inline code, etc.)
 */
export function getExcludedRanges(
  view: EditorView,
  from: number,
  to: number,
): Array<{ from: number; to: number }> {
  const excluded: Array<{ from: number; to: number }> = [];
  const tree = syntaxTree(view.state);

  tree.iterate({
    from,
    to,
    enter(node) {
      if (EXCLUDED_PARENT_TYPES.has(node.type.name)) {
        excluded.push({ from: node.from, to: node.to });
        return false; // don't descend
      }
      if (isExcludedNodeType(node.type.name)) {
        excluded.push({ from: node.from, to: node.to });
      }
    },
  });

  return mergeRanges(excluded);
}

/** Merge overlapping/adjacent ranges */
export function mergeRanges(
  ranges: Array<{ from: number; to: number }>,
): Array<{ from: number; to: number }> {
  if (ranges.length === 0) return [];
  ranges.sort((a, b) => a.from - b.from);
  const merged = [ranges[0]];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    if (ranges[i].from <= last.to) {
      last.to = Math.max(last.to, ranges[i].to);
    } else {
      merged.push(ranges[i]);
    }
  }
  return merged;
}

/** Check if a position falls within any excluded range */
export function isExcluded(
  pos: number,
  excluded: Array<{ from: number; to: number }>,
): boolean {
  for (const range of excluded) {
    if (pos >= range.from && pos < range.to) return true;
    if (range.from > pos) break; // sorted, no point continuing
  }
  return false;
}

/** POS category → CSS class */
const POS_CLASS: Record<POSCategory, string> = {
  adjective: "yaae-pos-adjective",
  noun: "yaae-pos-noun",
  adverb: "yaae-pos-adverb",
  verb: "yaae-pos-verb",
  conjunction: "yaae-pos-conjunction",
};

/** Pre-built decoration marks (shared across all instances) */
const POS_MARKS: Record<POSCategory, Decoration> = {
  adjective: Decoration.mark({ class: POS_CLASS.adjective }),
  noun: Decoration.mark({ class: POS_CLASS.noun }),
  adverb: Decoration.mark({ class: POS_CLASS.adverb }),
  verb: Decoration.mark({ class: POS_CLASS.verb }),
  conjunction: Decoration.mark({ class: POS_CLASS.conjunction }),
};

/**
 * Factory function that creates the CM6 ViewPlugin extension.
 * Closes over the Obsidian plugin instance for settings access.
 */
export function createHighlighterExtension(plugin: YaaePlugin) {
  const tagger = new CompromiseTagger();
  const listMatcher = new WordListMatcher();

  // Compile initial word lists
  listMatcher.compile(plugin.settings.proseHighlight.customWordLists);

  class ProseHighlighter {
    // Initialized at declaration: the constructor assigns inside try/catch,
    // which TS's definite-assignment analysis treats as maybe-skipped.
    decorations: DecorationSet = Decoration.none;
    private cache = new LineTagCache();

    constructor(view: EditorView) {
      // A throw here would keep the ViewPlugin from ever installing (#32).
      // Degrade to unhighlighted and record the error for the debug command.
      // buildDecorations populates the cache via tagsFor before throwing,
      // so the reset's cache.clear() is load-bearing even at construction.
      try {
        this.decorations = this.buildDecorations(view);
      } catch (err) {
        recordProseHighlightError(err, "decoration-build");
        this.resetHighlighting();
      }
    }

    update(update: ViewUpdate) {
      // CM6 ejects a ViewPlugin whose update() throws — the whole feature
      // then silently dies, which is the reported mobile symptom (#32).
      // Catch, record for the debug command, and degrade to unhighlighted;
      // the next update gets a fresh try against a cleared cache.
      try {
        this.applyUpdate(update);
      } catch (err) {
        recordProseHighlightError(err, "update");
        this.resetHighlighting();
      }
    }

    /** Degrade to unhighlighted: no decorations, empty tag cache. */
    private resetHighlighting(): void {
      this.decorations = Decoration.none;
      this.cache.clear();
    }

    private applyUpdate(update: ViewUpdate) {
      const settings = plugin.settings.proseHighlight;
      if (!settings.enabled) {
        if (this.decorations !== Decoration.none) {
          this.resetHighlighting();
        }
        return;
      }

      if (update.docChanged) {
        if (update.startState.doc.lines === update.state.doc.lines) {
          // Same line count — check for single-character insert
          let changeCount = 0;
          let singleCharInsert = true;

          update.changes.iterChangedRanges((_fromA, toA, fromB, toB) => {
            changeCount++;
            if (changeCount > 1) singleCharInsert = false;
            // Single char: old range is empty (fromA===toA) and new range is 1 char
            if (!(toA === _fromA && toB === fromB + 1))
              singleCharInsert = false;
          });

          if (singleCharInsert && changeCount === 1) {
            // The changed line's text is different from before, so it's a
            // plain cache miss — tagsFor() (called from buildDecorationSet)
            // tags and stores it. No cache invalidation needed: the cache is
            // keyed by content, so every OTHER line's entry is still valid.
            this.decorations = this.buildDecorationSet(update.view);
            return;
          }
        }
        // Bulk change or line count changed — full rebuild, but the cache is
        // NOT cleared: it's keyed by line content, so unchanged lines (most
        // of the document, even across an Enter/paste/undo) are still hits.
        this.decorations = this.buildDecorationSet(update.view);
      } else if (syntaxTree(update.startState) !== syntaxTree(update.state)) {
        // Markdown parses asynchronously: on first paint the code-block region
        // is often unparsed, so getExcludedRanges() returns nothing yet.
        // Exclusion is now applied at decoration-emit time (buildDecorationSet),
        // not baked into the cached tags, so a parse-progress update needs no
        // cache invalidation or retagging — just re-run exclusion with the
        // now-more-complete syntax tree.
        this.decorations = this.buildDecorationSet(update.view);
      } else if (update.viewportChanged) {
        this.decorations = this.buildDecorationSet(update.view);
      }
    }

    /** Rebuild: recompile word lists if settings changed */
    recompileIfNeeded() {
      listMatcher.compile(plugin.settings.proseHighlight.customWordLists);
    }

    /**
     * Look up a line's UNFILTERED tags by content, tagging and caching on a
     * miss. Pure function of `text` — no exclusion or heading logic here;
     * that depends on the line's position in the document/syntax tree and is
     * applied by the caller (buildDecorationSet) at emit time instead.
     */
    private tagsFor(text: string): LineTags {
      const cached = this.cache.get(text);
      if (cached) return cached;

      const tags: LineTags = {
        posTags: tagger.tag(text),
        listMatches: listMatcher.match(text),
      };
      this.cache.set(text, tags);
      return tags;
    }

    /** Build decorations for all visible lines */
    private buildDecorations(view: EditorView): DecorationSet {
      const settings = plugin.settings.proseHighlight;
      if (!settings.enabled) return Decoration.none;
      return this.buildDecorationSet(view);
    }

    /**
     * Tag (from cache or fresh) and emit decorations for every visible line.
     * Exclusion (code blocks, frontmatter, etc.) and the heading-line skip
     * are both applied HERE, per line, rather than baked into the cached
     * tags — the cache is a pure function of line text, so it stays valid
     * across a syntax-tree update that changes what's excluded.
     */
    private buildDecorationSet(view: EditorView): DecorationSet {
      const settings = plugin.settings.proseHighlight;
      const builder = new RangeSetBuilder<Decoration>();

      // Collect all decoration ranges, sorted by document position
      const ranges: Array<{
        from: number;
        to: number;
        deco: Decoration;
      }> = [];

      for (const { from, to } of view.visibleRanges) {
        const startLine = view.state.doc.lineAt(from).number;
        const endLine = view.state.doc.lineAt(to).number;

        for (let i = startLine; i <= endLine; i++) {
          const line = view.state.doc.line(i);
          const lineText = view.state.sliceDoc(line.from, line.to);

          // Skip heading lines unless the user opted in — decided from the
          // line text alone, before the getExcludedRanges tree traversal.
          if (
            !settings.highlightInsideHeadings &&
            isHeadingLine(lineText)
          ) {
            continue;
          }

          const excluded = getExcludedRanges(view, line.from, line.to);

          // Whole line excluded (e.g. inside a fenced code block) — skip it.
          if (
            excluded.length === 1 &&
            excluded[0].from <= line.from &&
            excluded[0].to >= line.to
          ) {
            continue;
          }

          const cached = this.tagsFor(lineText);

          // Custom list matches first (they take precedence)
          const listCovered = new Set<number>();
          for (const m of cached.listMatches) {
            if (
              isExcluded(line.from + m.start, excluded) ||
              isExcluded(line.from + m.end - 1, excluded)
            ) {
              continue;
            }
            const absFrom = line.from + m.start;
            const absTo = line.from + m.end;
            if (absFrom >= from && absTo <= to) {
              ranges.push({
                from: absFrom,
                to: absTo,
                deco: Decoration.mark({ class: m.cssClass }),
              });
              // Mark these positions as covered
              for (let p = m.start; p < m.end; p++) {
                listCovered.add(p);
              }
            }
          }

          // POS tags — skip if category disabled, position covered by list,
          // or the tag falls in an excluded range.
          for (const tag of cached.posTags) {
            if (!settings.categories[tag.pos]?.enabled) continue;
            if (listCovered.has(tag.start)) continue;
            if (
              isExcluded(line.from + tag.start, excluded) ||
              isExcluded(line.from + tag.end - 1, excluded)
            ) {
              continue;
            }

            const absFrom = line.from + tag.start;
            const absTo = line.from + tag.end;
            if (absFrom >= from && absTo <= to) {
              ranges.push({
                from: absFrom,
                to: absTo,
                deco: POS_MARKS[tag.pos],
              });
            }
          }
        }
      }

      // Sort by from position (required by RangeSetBuilder)
      ranges.sort((a, b) => a.from - b.from || a.to - b.to);
      for (const r of ranges) {
        builder.add(r.from, r.to, r.deco);
      }

      return builder.finish();
    }
  }

  return ViewPlugin.fromClass(ProseHighlighter, {
    decorations: (v) => v.decorations,
  });
}
