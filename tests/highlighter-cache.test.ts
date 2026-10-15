import { describe, it, expect, beforeEach } from "vitest";
import { LineTagCache } from "../src/prose-highlight/highlighter-plugin";
import type { POSTagger, POSTag } from "../src/prose-highlight/tagger";

/**
 * A counting fake tagger: records how many times `tag()` is called per
 * distinct text, so tests can assert the cache — not the tagger — decides
 * whether re-tagging happens.
 */
class CountingTagger implements POSTagger {
  calls = 0;
  tag(_text: string): POSTag[] {
    this.calls++;
    return [];
  }
}

describe("LineTagCache", () => {
  let tagger: CountingTagger;

  beforeEach(() => {
    tagger = new CountingTagger();
  });

  function tagAndStore(cache: LineTagCache, text: string) {
    const cached = cache.get(text);
    if (cached) return cached;
    tagger.tag(text);
    const tags = { posTags: [], listMatches: [] };
    cache.set(text, tags);
    return tags;
  }

  it("tags the same text only once", () => {
    const cache = new LineTagCache(10);
    tagAndStore(cache, "This is beautiful prose.");
    tagAndStore(cache, "This is beautiful prose.");
    expect(tagger.calls).toBe(1);
  });

  it("keyed by content: an inserted line above shifts positions but stays a cache hit", () => {
    const cache = new LineTagCache(10);
    const lines = ["Alpha line.", "Bravo line.", "Charlie line.", "Delta line."];

    // Cache all lines at their original "line numbers" (irrelevant to the
    // content-keyed cache, but mirrors how callers would use it).
    for (const text of lines) {
      tagAndStore(cache, text);
    }
    expect(tagger.calls).toBe(lines.length);

    // Simulate inserting a new line above all of them: the same texts are
    // looked up again (now at shifted line numbers) plus one brand-new line.
    const shifted = ["New first line.", ...lines];
    let misses = 0;
    for (const text of shifted) {
      const before = tagger.calls;
      tagAndStore(cache, text);
      if (tagger.calls !== before) misses++;
    }

    expect(misses).toBe(1); // only "New first line." is a miss
    expect(tagger.calls).toBe(lines.length + 1);
  });

  it("evicts the least recently ACCESSED key at capacity", () => {
    const cache = new LineTagCache(2);
    cache.set("a", { posTags: [], listMatches: [] });
    cache.set("b", { posTags: [], listMatches: [] });
    // Touch "a" so it becomes the most recently accessed.
    cache.get("a");
    cache.set("c", { posTags: [], listMatches: [] });

    expect(cache.get("b")).toBeUndefined(); // evicted
    expect(cache.get("a")).toBeDefined(); // kept
    expect(cache.get("c")).toBeDefined(); // kept
  });

  it("reports size", () => {
    const cache = new LineTagCache(10);
    expect(cache.size).toBe(0);
    cache.set("a", { posTags: [], listMatches: [] });
    expect(cache.size).toBe(1);
  });
});
