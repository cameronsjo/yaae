import type { POSCategory } from "../types";

/**
 * Maps a Universal Dependencies POS tag (UPOS) to a yaae POS category.
 * Returns null for UPOS tags yaae does not highlight (DET, PRON, NUM, etc.).
 */
const UPOS_TO_CATEGORY: Record<string, POSCategory> = {
  ADJ: "adjective",
  NOUN: "noun",
  PROPN: "noun",
  ADV: "adverb",
  VERB: "verb",
  CCONJ: "conjunction",
  SCONJ: "conjunction",
};

export function mapUpos(
  upos: string,
  opts: { auxIsVerb: boolean },
): POSCategory | null {
  if (opts.auxIsVerb && upos === "AUX") return "verb";
  return UPOS_TO_CATEGORY[upos] ?? null;
}
