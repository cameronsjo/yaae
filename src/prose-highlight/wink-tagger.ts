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
 * Measured on an M3 Air under Node 24 (`scripts/measure-tagger-startup.sh`),
 * reaching a first tag costs ~55 ms and splits three ways: ~22 ms for the two
 * imports, ~33 ms for `winkNLP(model)`, and ~1 ms to tag.
 *
 * This getter defers the ~33 ms. The ~22 ms of imports is NOT deferred — both
 * `import` statements above are static, so they still run when Obsidian loads
 * the plugin. Making those dynamic would force the seam async, and the
 * reading-view post-processor cannot await.
 *
 * Deferring the larger share still matters most on mobile, where prose
 * highlighting is gated off and no tag is ever requested, so the pipeline is
 * never built at all.
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
          // normalized it): skip it rather than emit a wrong offset, and
          // leave the cursor where it is. Advancing it by the reconstructed
          // length would be a guess, and a guess that overshoots strands
          // every later token — their real positions would sit behind the
          // cursor, so `indexOf(value, cursor)` would miss them too and the
          // rest of the line would silently lose highlighting. The cursor
          // still points at a position proven correct by the previous token,
          // so the next `indexOf` searches forward from known-good ground.
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
