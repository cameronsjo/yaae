import {
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  EditorView,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import type YaaePlugin from '../../main';
import type { POSTag } from './tagger';
import { CompromiseTagger } from './tagger';
import { WordListMatcher } from './word-lists';
import type { WordListMatch } from './word-lists';
import type { POSCategory } from '../types';

/** Markdown node types to exclude from NLP processing */
const EXCLUDED_NODE_TYPES = new Set([
  'CodeBlock',
  'FencedCode',
  'InlineCode',
  'HyperMD-codeblock',
  'HyperMD-codeblock-begin',
  'HyperMD-codeblock-end',
  'inline-code',
  'CodeText',
  'CodeInfo',
  'CodeMark',
  'FrontMatter',
  'YAMLFrontMatter',
  'hmd-frontmatter',
  'URL',
  'LinkMark',
  'formatting',
  'formatting-code',
  'formatting-code-block',
  'comment',
  'CommentBlock',
  'HTMLTag',
]);

/** Node types that indicate their children should also be excluded */
const EXCLUDED_PARENT_TYPES = new Set([
  'FencedCode',
  'CodeBlock',
  'FrontMatter',
  'YAMLFrontMatter',
  'CommentBlock',
]);

interface LineTags {
  posTags: POSTag[];
  listMatches: WordListMatch[];
}

/**
 * Collect ranges within the visible viewport that should be excluded
 * from NLP processing (code blocks, frontmatter, inline code, etc.)
 */
function getExcludedRanges(
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
      if (EXCLUDED_NODE_TYPES.has(node.type.name)) {
        excluded.push({ from: node.from, to: node.to });
      }
    },
  });

  return mergeRanges(excluded);
}

/** Merge overlapping/adjacent ranges */
function mergeRanges(
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
function isExcluded(
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
  adjective: 'yaae-pos-adjective',
  noun: 'yaae-pos-noun',
  adverb: 'yaae-pos-adverb',
  verb: 'yaae-pos-verb',
  conjunction: 'yaae-pos-conjunction',
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
    decorations: DecorationSet;
    private cache = new Map<number, LineTags>();

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: ViewUpdate) {
      const settings = plugin.settings.proseHighlight;
      if (!settings.enabled) {
        if (this.decorations !== Decoration.none) {
          this.decorations = Decoration.none;
          this.cache.clear();
        }
        return;
      }

      if (update.docChanged) {
        if (
          update.startState.doc.lines === update.state.doc.lines
        ) {
          // Same line count — check for single-character insert
          let changeCount = 0;
          let changedLine = 0;
          let singleCharInsert = true;

          update.changes.iterChangedRanges(
            (_fromA, toA, fromB, toB) => {
              changeCount++;
              if (changeCount > 1) singleCharInsert = false;
              // Single char: old range is empty (fromA===toA) and new range is 1 char
              if (!(toA === _fromA && toB === fromB + 1))
                singleCharInsert = false;
              changedLine = update.view.state.doc.lineAt(toB).number;
            },
          );

          if (singleCharInsert && changeCount === 1) {
            // Only retag the changed line
            this.retagLine(update.view, changedLine);
            this.decorations = this.buildDecorationSet(update.view);
            return;
          }
        }
        // Bulk change or line count changed — full rebuild
        this.cache.clear();
        this.decorations = this.buildDecorations(update.view);
      } else if (update.viewportChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    /** Rebuild: recompile word lists if settings changed */
    recompileIfNeeded() {
      listMatcher.compile(
        plugin.settings.proseHighlight.customWordLists,
      );
    }

    /** Tag a single line and update its cache entry */
    private retagLine(view: EditorView, lineNum: number): void {
      const line = view.state.doc.line(lineNum);
      const excluded = getExcludedRanges(view, line.from, line.to);
      const lineText = view.state.sliceDoc(line.from, line.to);

      // Check if entire line is excluded
      if (
        excluded.length === 1 &&
        excluded[0].from <= line.from &&
        excluded[0].to >= line.to
      ) {
        this.cache.set(lineNum, { posTags: [], listMatches: [] });
        return;
      }

      const tags = tagger.tag(lineText);
      const listMatches = listMatcher.match(lineText);

      // Filter out tags/matches that fall in excluded ranges
      const filteredTags = tags.filter(
        (t) =>
          !isExcluded(line.from + t.start, excluded) &&
          !isExcluded(line.from + t.end - 1, excluded),
      );
      const filteredMatches = listMatches.filter(
        (m) =>
          !isExcluded(line.from + m.start, excluded) &&
          !isExcluded(line.from + m.end - 1, excluded),
      );

      this.cache.set(lineNum, {
        posTags: filteredTags,
        listMatches: filteredMatches,
      });
    }

    /** Build decorations for all visible lines */
    private buildDecorations(view: EditorView): DecorationSet {
      const settings = plugin.settings.proseHighlight;
      if (!settings.enabled) return Decoration.none;

      for (const { from, to } of view.visibleRanges) {
        const startLine = view.state.doc.lineAt(from).number;
        const endLine = view.state.doc.lineAt(to).number;
        for (let i = startLine; i <= endLine; i++) {
          if (!this.cache.has(i)) {
            this.retagLine(view, i);
          }
        }
      }

      return this.buildDecorationSet(view);
    }

    /** Convert cached tags into a DecorationSet */
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
          const cached = this.cache.get(i);
          if (!cached) continue;

          const line = view.state.doc.line(i);

          // Custom list matches first (they take precedence)
          const listCovered = new Set<number>();
          for (const m of cached.listMatches) {
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

          // POS tags — skip if category disabled or position covered by list
          for (const tag of cached.posTags) {
            if (!settings.categories[tag.pos]?.enabled) continue;
            if (listCovered.has(tag.start)) continue;

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
