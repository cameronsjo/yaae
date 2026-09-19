import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AutoTocManager } from "../src/document/auto-toc";
import type { AutoTocHost } from "../src/document/auto-toc";

/**
 * `AutoTocManager` accepts an optional constructor `debounceMs` override
 * (production code always uses the `AUTO_TOC_DEBOUNCE_MS` default). No
 * existing test exercises that second constructor parameter — this covers
 * the custom-debounce branch directly instead of relying on the exported
 * constant.
 */

const DOC_WITH_TOC = [
  "# Title",
  "",
  "## Table of Contents",
  "",
  "- [Old Entry](#old-entry)",
  "",
  "---",
  "",
  "## Section One",
].join("\n");

describe("AutoTocManager — custom debounceMs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not fire before the custom debounce window elapses", async () => {
    const files = new Map([["note.md", DOC_WITH_TOC]]);
    const counts = { writes: 0 };
    const host: AutoTocHost = {
      isEnabled: () => true,
      read: async (path) => files.get(path) ?? null,
      write: async (path, content) => {
        counts.writes++;
        files.set(path, content);
      },
      resolveDepth: () => 3,
    };
    const mgr = new AutoTocManager(host, 500);

    mgr.notifyModified("note.md");
    await vi.advanceTimersByTimeAsync(400);
    expect(counts.writes).toBe(0);

    await vi.advanceTimersByTimeAsync(200);
    expect(counts.writes).toBe(1);
  });

  it("fires immediately-ish with a zero debounce", async () => {
    const files = new Map([["note.md", DOC_WITH_TOC]]);
    const counts = { writes: 0 };
    const host: AutoTocHost = {
      isEnabled: () => true,
      read: async (path) => files.get(path) ?? null,
      write: async (path, content) => {
        counts.writes++;
        files.set(path, content);
      },
      resolveDepth: () => 3,
    };
    const mgr = new AutoTocManager(host, 0);

    mgr.notifyModified("note.md");
    await vi.advanceTimersByTimeAsync(0);
    expect(counts.writes).toBe(1);
  });
});
