import winkNLP from 'wink-nlp';
import type { ItemToken } from 'wink-nlp';
import model from 'wink-eng-lite-web-model';
import type { POSTag, POSTagger } from './tagger';
import { mapUpos } from './upos-map';

type WinkInstance = ReturnType<typeof winkNLP>;

let instance: WinkInstance | null = null;

/**
 * Builds the wink pipeline on first use and reuses it after.
 *
 * `winkNLP(model)` parses a 3.6 MB model. At module scope that cost lands at
 * every Obsidian launch on every platform, including mobile, where prose
 * highlighting is gated off and no tag is ever requested. Deferring it to the
 * first `tag()` call keeps the `POSTagger` seam synchronous and costs nothing
 * once the pipeline exists.
 */
function getNlp(): WinkInstance {
  instance ??= winkNLP(model);
  return instance;
}

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

    const nlp = getNlp();
    const its = nlp.its;
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
          // Token isn't recoverable in the source text at all (wink
          // normalized it): skip it rather than emit a wrong offset. The
          // cursor still advances by the reconstructed length, the best
          // estimate of where the source text resumes; the next token's
          // slice check catches any drift and falls back to indexOf.
          // Never observed on tested input (the candidates bench suite).
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
