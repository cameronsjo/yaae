import type { POSCategory } from '../../src/types';

// Local copy for this candidate's use. The orchestrator folds this table into
// the shared `bench/upos-map.ts` (written by a parallel task) after merge.

/**
 * Maps a Universal POS (UPOS) tag to a POSCategory, or null if none apply.
 * `AUX` (auxiliary verbs, e.g. "is", "have") maps to `verb` to stay
 * consistent with the primary variant's AUX-is-verb treatment.
 */
export function categoryForUpos(tag: string): POSCategory | null {
  switch (tag) {
    case 'ADJ':
      return 'adjective';
    case 'NOUN':
    case 'PROPN':
      return 'noun';
    case 'ADV':
      return 'adverb';
    case 'VERB':
    case 'AUX':
      return 'verb';
    case 'CCONJ':
    case 'SCONJ':
      return 'conjunction';
    default:
      return null;
  }
}
