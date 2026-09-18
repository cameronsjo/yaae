import { describe, it, expect } from 'vitest';
import nlp from 'compromise';
import { proseSampleLines } from './fixtures/prose-sample';
import { CompromiseTagger } from '../src/prose-highlight/tagger';
import type { POSTag } from '../src/prose-highlight/tagger';
import type { POSCategory } from '../src/types';

/**
 * Test-only reference implementation: the original five-query CompromiseTagger
 * (one `match()`/`not()` pass per POS category), copied verbatim from
 * `src/prose-highlight/tagger.ts` before the single-pass rewrite. Kept here
 * so the rewrite can be checked against the old behavior line by line.
 */
interface CompromiseOffset {
  offset: { start: number; length: number };
  text: string;
  terms: Array<{ text: string; offset: { start: number; length: number } }>;
}

function legacyTag(text: string): POSTag[] {
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

  results.sort((a, b) => a.start - b.start);
  return deduplicateOverlaps(results);
}

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

const fixtureLines = proseSampleLines();

/**
 * Terms the legacy tagger mistagged as nouns because its noun exclusion,
 * `.not('#Pronoun #Possessive')`, is a two-term *sequence* match rather
 * than a per-term exclusion — a lone pronoun or possessive never matches
 * that sequence, so it fell through as a noun. The rewrite fixes this via
 * `categoryForTags`, so any bare pronoun or possessive diverges from the
 * legacy output by design, wherever it occurs in the fixture. Confirmed by
 * a full line-by-line diff of legacy vs. rewrite output across the fixture:
 * every divergence is one of these terms tagged `noun` by the legacy
 * tagger and correctly excluded by the rewrite; no other category of diff
 * (wrong category, dropped term, etc.) occurs anywhere in the fixture.
 */
const KNOWN_LEGACY_DIVERGENCES: Array<{ term: string; reason: string }> = [
  { term: 'her', reason: 'possessive/object pronoun mistagged noun by legacy sequence-match' },
  { term: 'she', reason: 'subject pronoun mistagged noun by legacy sequence-match' },
  { term: 'She', reason: 'subject pronoun mistagged noun by legacy sequence-match' },
  { term: 'it', reason: 'subject/object pronoun mistagged noun by legacy sequence-match' },
  { term: 'itself', reason: 'reflexive pronoun mistagged noun by legacy sequence-match' },
  { term: 'I', reason: 'subject pronoun mistagged noun by legacy sequence-match' },
  { term: 'its', reason: 'possessive pronoun mistagged noun by legacy sequence-match' },
  { term: 'they', reason: 'subject pronoun mistagged noun by legacy sequence-match' },
  { term: 'them', reason: 'object pronoun mistagged noun by legacy sequence-match' },
];

const EXCLUDED_TERMS = new Set(KNOWN_LEGACY_DIVERGENCES.map((d) => d.term));

describe('CompromiseTagger equivalence with legacy five-query implementation', () => {
  const tagger = new CompromiseTagger();

  it.each(fixtureLines.map((line, i) => [i, line] as const))(
    'line %i matches legacy output (excluding known pronoun/possessive divergences)',
    (_i, line) => {
      const actual = tagger.tag(line);
      const legacy = legacyTag(line);

      const filteredActual = actual.filter((t) => !EXCLUDED_TERMS.has(t.text));
      const filteredLegacy = legacy.filter((t) => !EXCLUDED_TERMS.has(t.text));

      expect(filteredActual).toEqual(filteredLegacy);
    }
  );
});
