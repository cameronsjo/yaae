import { CompromiseTagger, type POSTagger } from "../src/prose-highlight/tagger";
import { WinkTagger } from "./candidates/wink-tagger";
import { EnPosTagger } from "./candidates/en-pos-tagger";

/**
 * Registry of POS tagger backends under benchmark. Later bake-off tasks
 * add more entries here (e.g. a WASM or worker-backed tagger).
 */
export const candidates: Record<string, () => POSTagger> = {
  compromise: () => new CompromiseTagger(),
  wink: () => new WinkTagger(),
  "en-pos": () => new EnPosTagger(),
};
