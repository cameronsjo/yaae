import winkNLP from 'wink-nlp';
import type { ItemToken } from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import type { POSTag, POSTagger } from '../../src/prose-highlight/tagger';
import { mapUpos } from '../upos-map';

const nlp = winkNLP(model);
const its = nlp.its;

/**
 * POS tagger backed by wink-nlp (default pipeline, `wink-eng-lite-web-model`).
 *
 * wink-nlp does not report token offsets directly. Offsets are reconstructed
 * by walking each token's `precedingSpaces + value` from a running cursor;
 * this is lossless for ordinary prose (verified against the fixture corpus)
 * but falls back to `text.indexOf(value, cursor)` per token when the
 * reconstructed slice doesn't match, so a token that isn't reproduced
 * losslessly (e.g. a normalized quote or ligature) still gets a correct
 * offset instead of a silently wrong one.
 */
export class WinkTagger implements POSTagger {
  tag(text: string): POSTag[] {
    if (!text.trim()) return [];

    const doc = nlp.readDoc(text);
    const results: POSTag[] = [];
    let cursor = 0;

    doc.tokens().each((token: ItemToken) => {
      const value = token.out(its.value) as string;
      const preceding = token.out(its.precedingSpaces) as string;
      const upos = token.out(its.pos) as string;

      let start = cursor + preceding.length;
      let end = start + value.length;

      if (text.slice(start, end) !== value) {
        const found = text.indexOf(value, cursor);
        if (found < 0) {
          // Token isn't recoverable in the source text at all; skip it
          // rather than emit a wrong offset.
          cursor = end;
          return;
        }
        start = found;
        end = found + value.length;
      }

      cursor = end;

      const pos = mapUpos(upos, { auxIsVerb: true });
      if (!pos) return;

      results.push({ text: value, pos, start, end });
    });

    results.sort((a, b) => a.start - b.start);
    return results;
  }
}
