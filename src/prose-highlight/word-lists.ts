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

/**
 * Build a map from each list's display name to a unique sanitized class
 * suffix. Two lists whose names sanitize to the same value (e.g. `"My List"`
 * and `"my-list"`) would otherwise share a class — POSStyleManager would
 * emit two `color` rules and the second would silently win, leaving one
 * list visually unstyled. Collisions get a numeric suffix: `my-list`,
 * `my-list-2`, `my-list-3`, …
 *
 * Empty results (whitespace-only names that sanitize to `""`) are returned
 * as `""` so callers keep their existing skip-on-empty behavior.
 */
export function buildUniqueClassSuffixes(
  names: readonly string[],
): string[] {
  const used = new Set<string>();
  const suffixes: string[] = [];

  for (const name of names) {
    const base = sanitizeListName(name);
    if (!base) {
      suffixes.push('');
      continue;
    }

    if (!used.has(base)) {
      used.add(base);
      suffixes.push(base);
      continue;
    }

    let n = 2;
    while (used.has(`${base}-${n}`)) n++;
    const unique = `${base}-${n}`;
    used.add(unique);
    suffixes.push(unique);
  }

  return suffixes;
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

    // Compute unique class suffixes once so collisions get distinct classes
    // instead of silently sharing one (and fighting over the color rule).
    const suffixes = buildUniqueClassSuffixes(lists.map((l) => l.name));

    for (let i = 0; i < lists.length; i++) {
      const list = lists[i];
      if (!list.enabled || list.words.length === 0) continue;

      // Sort by length descending so longer phrases match first
      const sorted = [...list.words]
        .filter((w) => w.trim().length > 0)
        .sort((a, b) => b.length - a.length);

      if (sorted.length === 0) continue;

      const suffix = suffixes[i];
      if (!suffix) continue;

      const pattern = sorted.map(escapeRegex).join('|');
      const flags = list.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`\\b(?:${pattern})\\b`, flags);

      this.compiled.push({
        name: list.name,
        cssClass: `yaae-list-${suffix}`,
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
