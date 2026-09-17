import { CompromiseTagger, type POSTagger } from "../src/prose-highlight/tagger";

/**
 * Registry of POS tagger backends under benchmark. Later bake-off tasks
 * add more entries here (e.g. a WASM or worker-backed tagger).
 */
export const candidates: Record<string, () => POSTagger> = {
  compromise: () => new CompromiseTagger(),
};
