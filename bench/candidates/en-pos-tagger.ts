import { Tag } from 'en-pos';
import type { POSCategory } from '../../src/types';
import type { POSTag, POSTagger } from '../../src/prose-highlight/tagger';

/**
 * Maps a Penn Treebank tag (as produced by en-pos) to a POSCategory, or
 * null if none apply. `MD` (modal auxiliary, e.g. "can", "should") maps to
 * `verb` to stay consistent with the AUX-is-verb treatment used elsewhere.
 * `IN` (mostly prepositions, plus some subordinating conjunctions) is
 * excluded rather than mapped to `conjunction`, since most `IN` tokens are
 * prepositions.
 */
export function categoryForPennTag(tag: string): POSCategory | null {
  if (tag.startsWith('JJ')) return 'adjective';
  if (tag.startsWith('NN')) return 'noun';
  if (tag.startsWith('RB')) return 'adverb';
  if (tag.startsWith('VB') || tag === 'MD') return 'verb';
  if (tag === 'CC') return 'conjunction';
  return null;
}

/**
 * POS tagger backed by en-pos (Penn Treebank tagset, rule-based
 * initial-tag-and-smooth Brill tagger).
 *
 * Tokenizes with `Intl.Segmenter('en', { granularity: 'word' })` to get
 * word-like segments with their source offsets, then passes just the token
 * strings to en-pos for tagging. Segmenter offsets are exact by
 * construction, so no reconstruction/fallback is needed here (unlike
 * `WinkTagger`).
 */
export class EnPosTagger implements POSTagger {
  private segmenter = new Intl.Segmenter('en', { granularity: 'word' });

  tag(text: string): POSTag[] {
    if (!text.trim()) return [];

    const segments = Array.from(this.segmenter.segment(text)).filter((s) => s.isWordLike);
    if (segments.length === 0) return [];

    const tokens = segments.map((s) => s.segment);
    const result = new Tag(tokens).initial().smooth();

    const results: POSTag[] = [];
    for (let i = 0; i < segments.length; i++) {
      const pos = categoryForPennTag(result.tags[i]);
      if (!pos) continue;

      const segment = segments[i];
      results.push({
        text: segment.segment,
        pos,
        start: segment.index,
        end: segment.index + segment.segment.length,
      });
    }

    return results;
  }
}
