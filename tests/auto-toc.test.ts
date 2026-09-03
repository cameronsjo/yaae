import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AutoTocManager, AUTO_TOC_DEBOUNCE_MS } from "../src/document/auto-toc";
import type { AutoTocHost } from "../src/document/auto-toc";
import { generateToc, hasToc } from "../src/document/toc-generator";

/**
 * Behavioral tests for AutoTocManager: debounce, regenerate-only gate,
 * loop termination, race guard, and lifecycle. The host is a plain fake
 * over an in-memory file map, driven with fake timers.
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
  "",
  "Body text.",
  "",
  "## Section Two",
].join("\n");

const DOC_WITHOUT_TOC = [
  "# Title",
  "",
  "## Section One",
  "",
  "Body text.",
].join("\n");

interface FakeVault {
  files: Map<string, string>;
  reads: number;
  writes: number;
  host: AutoTocHost;
}

function makeFakeVault(
  opts: { enabled?: () => boolean; depth?: number } = {},
): FakeVault {
  const files = new Map<string, string>();
  const enabled = opts.enabled ?? (() => true);
  const vault: FakeVault = {
    files,
    reads: 0,
    writes: 0,
    host: {
      isEnabled: enabled,
      read: async (path) => {
        vault.reads++;
        return files.get(path) ?? null;
      },
      write: async (path, content) => {
        vault.writes++;
        files.set(path, content);
      },
      resolveDepth: () => opts.depth ?? 3,
    },
  };
  return vault;
}

describe("AutoTocManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function flush(ms: number = AUTO_TOC_DEBOUNCE_MS) {
    await vi.advanceTimersByTimeAsync(ms);
  }

  it("regenerates a stale TOC after the debounce window", async () => {
    const vault = makeFakeVault();
    vault.files.set("note.md", DOC_WITH_TOC);
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("note.md");
    await flush();

    expect(vault.writes).toBe(1);
    const updated = vault.files.get("note.md")!;
    expect(updated).toContain("- [Section One](#section-one)");
    expect(updated).toContain("- [Section Two](#section-two)");
    expect(updated).not.toContain("Old Entry");
  });

  it("never touches notes without a TOC block (regenerate-only gate)", async () => {
    const vault = makeFakeVault();
    vault.files.set("note.md", DOC_WITHOUT_TOC);
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("note.md");
    await flush();

    expect(vault.writes).toBe(0);
    expect(vault.files.get("note.md")).toBe(DOC_WITHOUT_TOC);
  });

  it("skips the write when the TOC is already fresh (loop terminator)", async () => {
    const vault = makeFakeVault();
    const fresh = generateToc(DOC_WITH_TOC, 3).content;
    vault.files.set("note.md", fresh);
    const mgr = new AutoTocManager(vault.host);

    // Simulates the modify event our own write fires: the pass reads,
    // finds identical content, and does not write again.
    mgr.notifyModified("note.md");
    await flush();

    expect(vault.reads).toBe(1);
    expect(vault.writes).toBe(0);
  });

  it("collapses a burst of modifies into one regeneration pass", async () => {
    const vault = makeFakeVault();
    vault.files.set("note.md", DOC_WITH_TOC);
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("note.md");
    await flush(500);
    mgr.notifyModified("note.md");
    await flush(500);
    mgr.notifyModified("note.md");
    await flush(AUTO_TOC_DEBOUNCE_MS);

    expect(vault.reads).toBe(1);
    expect(vault.writes).toBe(1);
  });

  it("debounces per file, not globally", async () => {
    const vault = makeFakeVault();
    vault.files.set("a.md", DOC_WITH_TOC);
    vault.files.set("b.md", DOC_WITH_TOC);
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("a.md");
    mgr.notifyModified("b.md");
    expect(mgr.pendingCount).toBe(2);
    await flush();

    expect(vault.writes).toBe(2);
    expect(mgr.pendingCount).toBe(0);
  });

  it("does not schedule when disabled", async () => {
    const vault = makeFakeVault({ enabled: () => false });
    vault.files.set("note.md", DOC_WITH_TOC);
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("note.md");
    expect(mgr.pendingCount).toBe(0);
    await flush();

    expect(vault.reads).toBe(0);
    expect(vault.writes).toBe(0);
  });

  it("re-checks the toggle at fire time (disabled mid-debounce)", async () => {
    let enabled = true;
    const vault = makeFakeVault({ enabled: () => enabled });
    vault.files.set("note.md", DOC_WITH_TOC);
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("note.md");
    enabled = false;
    await flush();

    expect(vault.reads).toBe(0);
    expect(vault.writes).toBe(0);
  });

  it("bails when the file no longer exists at fire time", async () => {
    const vault = makeFakeVault();
    vault.files.set("note.md", DOC_WITH_TOC);
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("note.md");
    vault.files.delete("note.md");
    await flush();

    expect(vault.writes).toBe(0);
  });

  it("skips the write when a newer edit arrived mid-read (race guard)", async () => {
    const vault = makeFakeVault();
    vault.files.set("note.md", DOC_WITH_TOC);
    const mgr = new AutoTocManager(vault.host);

    // Simulate a newer edit landing while the first pass's read is in
    // flight (only once — real modify events stop once the user stops typing).
    const originalRead = vault.host.read;
    let raceInjected = false;
    vault.host.read = async (path) => {
      const content = await originalRead(path);
      if (!raceInjected) {
        raceInjected = true;
        mgr.notifyModified("note.md");
      }
      return content;
    };

    mgr.notifyModified("note.md");
    await flush();

    // First pass read but did not write — the newer edit's timer was pending.
    expect(vault.writes).toBe(0);
    expect(mgr.pendingCount).toBe(1);

    // The newer edit's own pass regenerates.
    await flush();
    expect(vault.writes).toBe(1);
    expect(mgr.pendingCount).toBe(0);
  });

  it("honors the resolved depth (frontmatter override path)", async () => {
    const vault = makeFakeVault({ depth: 1 });
    vault.files.set("note.md", `${DOC_WITH_TOC}\n\n### Deep Heading`);
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("note.md");
    await flush();

    const updated = vault.files.get("note.md")!;
    expect(updated).toContain("- [Title](#title)");
    expect(updated).not.toContain("- [Section One](#section-one)");
    expect(updated).not.toContain("- [Deep Heading](#deep-heading)");
  });

  it("destroy cancels pending regenerations", async () => {
    const vault = makeFakeVault();
    vault.files.set("note.md", DOC_WITH_TOC);
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("note.md");
    mgr.destroy();
    expect(mgr.pendingCount).toBe(0);
    await flush();

    expect(vault.reads).toBe(0);
    expect(vault.writes).toBe(0);
  });

  it("a write failure logs a warning and does not throw", async () => {
    const vault = makeFakeVault();
    vault.files.set("note.md", DOC_WITH_TOC);
    vault.host.write = async () => {
      throw new Error("disk full");
    };
    const mgr = new AutoTocManager(vault.host);

    mgr.notifyModified("note.md");
    await flush();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Auto TOC regeneration failed"),
      expect.any(Error),
    );
  });
});

describe("hasToc", () => {
  it("detects a generated TOC block", () => {
    expect(hasToc(DOC_WITH_TOC)).toBe(true);
  });

  it("returns false for notes without a TOC", () => {
    expect(hasToc(DOC_WITHOUT_TOC)).toBe(false);
  });
});

// --- main.ts wiring (structural, matching main-lifecycle.test.ts idiom) ----

describe("auto TOC wiring in main.ts", () => {
  const MAIN_TS = readFileSync(join(__dirname, "..", "main.ts"), "utf-8");

  it("notifies the manager from the shared vault modify handler", () => {
    expect(MAIN_TS).toMatch(
      /this\.app\.vault\.on\(\s*'modify'[\s\S]*?this\.autoTocManager\.notifyModified\(file\.path\)/,
    );
  });

  it("registers exactly one vault modify listener", () => {
    const matches = MAIN_TS.match(/vault\.on\(\s*'modify'/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("destroys the manager on unload", () => {
    const onunload = MAIN_TS.match(/onunload\(\)\s*\{[\s\S]*?\n\s{2}\}/);
    expect(onunload).not.toBeNull();
    expect(onunload![0]).toMatch(/this\.autoTocManager\.destroy\(\)/);
  });

  it("resolveDepth routes through the shared resolveTocDepth helper", () => {
    expect(MAIN_TS).toMatch(
      /resolveDepth:[\s\S]*?resolveTocDepth\(content,\s*this\.settings\.document\.tocDepth\)/,
    );
    // The manual command uses the same helper — one precedence rule.
    const tocFn = MAIN_TS.match(
      /async\s+generateTocForCurrentFile[\s\S]*?\n\s{2}\}/,
    );
    expect(tocFn).not.toBeNull();
    expect(tocFn![0]).toMatch(/resolveTocDepth\(content/);
  });
});

describe("auto TOC toggle in settings tab (structural)", () => {
  const SETTINGS_TAB = readFileSync(
    join(__dirname, "..", "src", "document", "settings-tab.ts"),
    "utf-8",
  );

  it("renders an autoToc toggle bound to the setting", () => {
    expect(SETTINGS_TAB).toMatch(/Automatic TOC updates/);
    expect(SETTINGS_TAB).toMatch(
      /setValue\(plugin\.settings\.document\.autoToc\)/,
    );
    expect(SETTINGS_TAB).toMatch(
      /plugin\.settings\.document\.autoToc\s*=\s*value/,
    );
  });
});
