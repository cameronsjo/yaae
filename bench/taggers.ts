import type { POSTagger } from "../src/prose-highlight/tagger";
import { WinkTagger } from "../src/prose-highlight/wink-tagger";
import { CompromiseTagger } from "./candidates/compromise-tagger";
import { EnPosTagger } from "./candidates/en-pos-tagger";

/**
 * Registry of POS tagger backends under benchmark. `wink` is the shipped
 * tagger, imported from `src/`; the others are bench-only candidates. The
 * dependency direction is one-way — bench imports src, never the reverse,
 * because esbuild follows every import from `main.ts` and would otherwise
 * ship the harness.
 */
export const candidates: Record<string, () => POSTagger> = {
  compromise: () => new CompromiseTagger(),
  wink: () => new WinkTagger(),
  "en-pos": () => new EnPosTagger(),
};
