/**
 * The UPOS → POSCategory mapping now lives in `src/`, because the shipped
 * wink tagger uses it. `bench/accuracy.ts` scores against the same mapping,
 * so it re-exports rather than keeping a second copy: two copies could drift
 * and silently shift every accuracy number.
 */
export { mapUpos } from "../src/prose-highlight/upos-map";
