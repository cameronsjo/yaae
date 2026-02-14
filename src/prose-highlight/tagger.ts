import nlp from 'compromise';
import type { POSCategory } from '../types';

/** A single tagged token with position info */
export interface POSTag {
  text: string;
  pos: POSCategory;
  start: number;
  end: number;
}

/** Interface for pluggable POS tagging backends */
export interface POSTagger {
  tag(text: string): POSTag[];
}

interface CompromiseOffset {
  offset: { start: number; length: number };
  text: string;
  terms: Array<{ text: string; offset: { start: number; length: number } }>;
}

/**
 * POS tagger backed by the compromise NLP library.
 * Rule-based, ~80 kB, runs synchronously on the main thread.
 */
export class CompromiseTagger implements POSTagger {
  tag(text: string): POSTag[] {
    if (!text.trim()) return [];

    const doc = nlp(text);
    const results: POSTag[] = [];

    const queries: Array<{ match: string; exclude?: string; pos: POSCategory }> = [
      { match: '#Adjective', pos: 'adjective' },
      { match: '#Noun', exclude: '#Pronoun #Possessive', pos: 'noun' },
      { match: '#Adverb', pos: 'adverb' },
      { match: '#Verb', pos: 'verb' },
      { match: '#Conjunction', pos: 'conjunction' },
    ];

    for (const q of queries) {
      let matched = doc.match(q.match);
      if (q.exclude) {
        matched = matched.not(q.exclude);
      }

      const offsets = matched.out('offset') as unknown as CompromiseOffset[];
      for (const entry of offsets) {
        for (const term of entry.terms) {
          const start = term.offset.start;
          const end = start + term.offset.length;
          if (end > start) {
            results.push({ text: term.text, pos: q.pos, start, end });
          }
        }
      }
    }

    // Sort by start position, deduplicate overlaps (first match wins)
    results.sort((a, b) => a.start - b.start);
    return deduplicateOverlaps(results);
  }
}

/** Remove overlapping tags — earlier in the array wins */
function deduplicateOverlaps(tags: POSTag[]): POSTag[] {
  const result: POSTag[] = [];
  let lastEnd = -1;
  for (const tag of tags) {
    if (tag.start >= lastEnd) {
      result.push(tag);
      lastEnd = tag.end;
    }
  }
  return result;
}
