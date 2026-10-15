import type { POSCategory } from "../types";

/**
 * Maps a Universal Dependencies POS tag (UPOS) to a yaae POS category.
 * Returns null for UPOS tags yaae does not highlight (DET, PRON, NUM, etc.).
 */
// Null-prototype: a plain object literal inherits from Object.prototype, so a
// lookup of "constructor" or "toString" returns a function rather than
// undefined, and the `?? null` below would not catch it. wink's `its.pos`
// only emits UPOS tags today, so this is defence rather than a live bug.
const UPOS_TO_CATEGORY: Record<string, POSCategory> = Object.assign(Object.create(null), {
  ADJ: "adjective",
  NOUN: "noun",
  PROPN: "noun",
  ADV: "adverb",
  VERB: "verb",
  CCONJ: "conjunction",
  SCONJ: "conjunction",
});

export function mapUpos(
  upos: string,
  opts: { auxIsVerb: boolean },
): POSCategory | null {
  if (opts.auxIsVerb && upos === "AUX") return "verb";
  return UPOS_TO_CATEGORY[upos] ?? null;
}
