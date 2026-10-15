import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  recordProseHighlightError,
  getProseHighlightLastError,
  clearProseHighlightLastError,
  buildProseHighlightDebugInfo,
} from "../src/prose-highlight/debug";

describe("prose highlight error recording (#32)", () => {
  beforeEach(() => {
    clearProseHighlightLastError();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records message, stack, and phase from an Error", () => {
    recordProseHighlightError(new Error("boom"), "update");
    const rec = getProseHighlightLastError();
    expect(rec).not.toBeNull();
    expect(rec!.message).toBe("boom");
    expect(rec!.phase).toBe("update");
    expect(rec!.stack).toContain("boom");
    expect(rec!.count).toBe(1);
  });

  it("records non-Error throwables as strings", () => {
    recordProseHighlightError("string throw", "reading-view");
    const rec = getProseHighlightLastError();
    expect(rec!.message).toBe("string throw");
    expect(rec!.stack).toBeUndefined();
  });

  it("bumps the counter instead of re-logging on a repeated error", () => {
    recordProseHighlightError(new Error("same"), "update");
    recordProseHighlightError(new Error("same"), "update");
    recordProseHighlightError(new Error("same"), "update");
    expect(getProseHighlightLastError()!.count).toBe(3);
    // Console noise is bounded: one error log for the run of repeats.
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("a different message resets the record", () => {
    recordProseHighlightError(new Error("first"), "update");
    recordProseHighlightError(new Error("second"), "update");
    const rec = getProseHighlightLastError();
    expect(rec!.message).toBe("second");
    expect(rec!.count).toBe(1);
  });

  it("the same message in a different phase is a new record", () => {
    recordProseHighlightError(new Error("same"), "update");
    recordProseHighlightError(new Error("same"), "decoration-build");
    expect(getProseHighlightLastError()!.phase).toBe("decoration-build");
    expect(getProseHighlightLastError()!.count).toBe(1);
  });
});

describe("buildProseHighlightDebugInfo", () => {
  beforeEach(() => {
    clearProseHighlightLastError();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const ctx = {
    pluginVersion: "0.1.0",
    isMobile: true,
    mobileDebugOverride: true,
    highlightingEnabled: true,
    readingViewEnabled: false,
    userAgent: "test-agent",
  };

  it('includes platform context and "none recorded" without an error', () => {
    const info = buildProseHighlightDebugInfo(ctx);
    expect(info).toContain("Plugin version: 0.1.0");
    expect(info).toContain("Mobile: true");
    expect(info).toContain("Mobile debug override: true");
    expect(info).toContain("none recorded this session");
  });

  it("includes the last error with stack when one is recorded", () => {
    recordProseHighlightError(new Error("mobile crash"), "decoration-build");
    const info = buildProseHighlightDebugInfo(ctx);
    expect(info).toContain("Phase: decoration-build");
    expect(info).toContain("Message: mobile crash");
    expect(info).toContain("Occurrences: 1");
    expect(info).toMatch(/```\n.*mobile crash[\s\S]*```/);
  });
});

// --- structural wiring (matching main-lifecycle.test.ts idiom) -------------

describe("#32 wiring in main.ts", () => {
  const MAIN_TS = readFileSync(join(__dirname, "..", "main.ts"), "utf-8");

  it("mobile guards route through proseHighlightBlockedOnMobile", () => {
    expect(MAIN_TS).toMatch(/proseHighlightBlockedOnMobile\(\)\s*:\s*boolean/);
    // No remaining raw Platform.isMobile gate on the highlighter paths —
    // the helper is the single source of truth (the debug-info builder's
    // Platform.isMobile *report* is fine).
    const gates = MAIN_TS.match(/if\s*\(\s*(!)?Platform\.isMobile\s*\)/g) ?? [];
    expect(gates).toHaveLength(0);
  });

  it("registers the copy-debug and mobile-override commands", () => {
    expect(MAIN_TS).toMatch(/id:\s*["']copy-prose-highlight-debug["']/);
    expect(MAIN_TS).toMatch(/id:\s*["']toggle-prose-highlight-mobile-override["']/);
  });

  it("reading-view processor is always registered with a runtime gate", () => {
    // Bounded by position, not by a lazy [\s\S]*? scan. The old form let the
    // gate match ANY later proseHighlightBlockedOnMobile() in main.ts — there
    // are four — so deleting the one inside this callback left the test green.
    // Verified: removing the gate now reddens this test (#51).
    const regIdx = MAIN_TS.indexOf(
      "this.registerMarkdownPostProcessor((el, ctx)",
    );
    expect(regIdx, "post-processor registration not found").toBeGreaterThan(-1);

    // This error-recording call is inside the callback, so it bounds the end
    // of the region the gate must appear in.
    const recordIdx = MAIN_TS.search(
      /recordProseHighlightError\(err,\s*["']reading-view["']\)/,
    );
    expect(recordIdx, "reading-view error recording not found").toBeGreaterThan(
      regIdx,
    );

    // The gate must sit between the two — i.e. inside this callback, and
    // before the try/catch that runs the processor.
    const gateIdx = MAIN_TS.indexOf(
      "this.proseHighlightBlockedOnMobile()",
      regIdx,
    );
    expect(gateIdx, "no mobile gate after the registration").toBeGreaterThan(
      regIdx,
    );
    expect(gateIdx, "mobile gate is not inside the processor callback").
      toBeLessThan(recordIdx);
  });
});

describe("#32 error capture in highlighter-plugin.ts", () => {
  const PLUGIN_TS = readFileSync(
    join(__dirname, "..", "src", "prose-highlight", "highlighter-plugin.ts"),
    "utf-8",
  );

  it("constructor and update are wrapped with error recording", () => {
    expect(PLUGIN_TS).toMatch(
      /constructor\(view: EditorView\)\s*\{[\s\S]*?catch\s*\(err\)\s*\{[\s\S]*?recordProseHighlightError\(err,\s*["']decoration-build["']\)/,
    );
    expect(PLUGIN_TS).toMatch(
      /update\(update: ViewUpdate\)\s*\{[\s\S]*?catch\s*\(err\)\s*\{[\s\S]*?recordProseHighlightError\(err,\s*["']update["']\)/,
    );
  });

  it("degrades to unhighlighted instead of rethrowing", () => {
    // Both catch blocks route through the shared reset helper…
    const catches =
      PLUGIN_TS.match(
        /catch\s*\(err\)\s*\{[\s\S]*?this\.resetHighlighting\(\)/g,
      ) ?? [];
    expect(catches.length).toBeGreaterThanOrEqual(2);
    // …which clears decorations and the tag cache.
    expect(PLUGIN_TS).toMatch(
      /private resetHighlighting\(\): void \{\s*this\.decorations = Decoration\.none;\s*this\.cache\.clear\(\);/,
    );
  });
});
