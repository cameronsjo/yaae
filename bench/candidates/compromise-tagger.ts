import nlp from 'compromise';
import { categoryForTags, type POSTag, type POSTagger } from '../../src/prose-highlight/tagger';

interface CompromiseTerm {
  text: string;
  tags: string[];
  offset: { start: number; length: number };
}

interface CompromiseSentence {
  offset: { start: number; length: number };
  text: string;
  terms: CompromiseTerm[];
}

/**
 * POS tagger backed by the compromise NLP library. Bench only — this was the
 * shipped tagger until wink-nlp replaced it, and it lives here so that
 * `compromise` is a devDependency no `src/` file can import.
 *
 * Single pass: parses the text once via `nlp(text).json({ offset: true })`
 * and classifies each term directly from its tag set (see
 * `categoryForTags`), instead of running one `match()`/`not()` query per
 * category. This also fixes a defect in the old five-query approach: its
 * noun exclusion, `.not('#Pronoun #Possessive')`, is a two-term *sequence*
 * match, so a lone pronoun or possessive (`He`, `his`) was never excluded
 * and got tagged as a noun.
 */
export class CompromiseTagger implements POSTagger {
  tag(text: string): POSTag[] {
    if (!text.trim()) return [];

    const sentences = nlp(text).json({ offset: true }) as unknown as CompromiseSentence[];
    const results: POSTag[] = [];

    for (const sentence of sentences) {
      for (const term of sentence.terms) {
        if (!term.text) continue;

        const pos = categoryForTags(term.tags);
        if (!pos) continue;

        const start = term.offset.start;
        const end = start + term.offset.length;
        if (end <= start) continue;

        // compromise's per-term offset is normally lossless; fall back to a
        // scan from the term's reported start if it ever isn't.
        if (text.slice(start, end) === term.text) {
          results.push({ text: term.text, pos, start, end });
        } else {
          const found = text.indexOf(term.text, start);
          if (found >= 0) {
            results.push({ text: term.text, pos, start: found, end: found + term.text.length });
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
