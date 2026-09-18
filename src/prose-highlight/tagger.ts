import type { POSCategory } from '../types';

/** A single tagged token with position info */
export interface POSTag {
  text: string;
  pos: POSCategory;
  start: number;
  end: number;
}

/**
 * Interface for pluggable POS tagging backends.
 *
 * This file is the seam and holds no NLP library import. The shipped
 * implementation is `WinkTagger` in `./wink-tagger`; `CompromiseTagger`
 * lives in the bench harness and is never bundled. Keeping a library
 * import out of this file is what makes that true by construction rather
 * than by tree-shaking luck.
 */
export interface POSTagger {
  tag(text: string): POSTag[];
}

/**
 * Maps a term's compromise tag set to a POSCategory, or null if none apply.
 * Precedence (first match wins): adjective, noun (never pronoun/possessive),
 * adverb, verb, conjunction.
 *
 * Used by the bench-only compromise candidate. Kept here beside the seam
 * because the tagger equivalence tests assert against it directly.
 */
export function categoryForTags(tags: readonly string[]): POSCategory | null {
  if (tags.includes('Adjective')) return 'adjective';
  if (tags.includes('Noun') && !tags.includes('Pronoun') && !tags.includes('Possessive')) {
    return 'noun';
  }
  if (tags.includes('Adverb')) return 'adverb';
  if (tags.includes('Verb')) return 'verb';
  if (tags.includes('Conjunction')) return 'conjunction';
  return null;
}
