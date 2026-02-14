import type { CustomWordList } from '../types';

/** A match from a custom word list */
export interface WordListMatch {
  text: string;
  listName: string;
  cssClass: string;
  start: number;
  end: number;
}

interface CompiledList {
  name: string;
  cssClass: string;
  regex: RegExp;
}

/** Sanitize a list name to a valid CSS class suffix */
export function sanitizeListName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Compiles user-defined word lists into regexes and matches them against text.
 */
export class WordListMatcher {
  private compiled: CompiledList[] = [];

  /** Recompile regexes from the current list definitions */
  compile(lists: CustomWordList[]): void {
    this.compiled = [];
    for (const list of lists) {
      if (!list.enabled || list.words.length === 0) continue;

      // Sort by length descending so longer phrases match first
      const sorted = [...list.words]
        .filter((w) => w.trim().length > 0)
        .sort((a, b) => b.length - a.length);

      if (sorted.length === 0) continue;

      const pattern = sorted.map(escapeRegex).join('|');
      const flags = list.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`\\b(?:${pattern})\\b`, flags);

      this.compiled.push({
        name: list.name,
        cssClass: `yaae-list-${sanitizeListName(list.name)}`,
        regex,
      });
    }
  }

  /** Match all compiled lists against text, returning non-overlapping matches */
  match(text: string): WordListMatch[] {
    const results: WordListMatch[] = [];

    for (const list of this.compiled) {
      // Reset lastIndex for each new text
      list.regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = list.regex.exec(text)) !== null) {
        results.push({
          text: m[0],
          listName: list.name,
          cssClass: list.cssClass,
          start: m.index,
          end: m.index + m[0].length,
        });
      }
    }

    // Sort by position, deduplicate overlaps (first list wins)
    results.sort((a, b) => a.start - b.start);
    return deduplicateOverlaps(results);
  }
}

/** Remove overlapping matches — earlier in the array wins */
function deduplicateOverlaps(matches: WordListMatch[]): WordListMatch[] {
  const result: WordListMatch[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      result.push(m);
      lastEnd = m.end;
    }
  }
  return result;
}
