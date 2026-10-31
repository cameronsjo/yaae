import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural tests (main.ts read as text; see commands.test.ts for why).
 * - Phones get no heading gutter; tablets and desktop keep it.
 * - The dimming status bar label reads "Dimming", not "Syntax".
 */

const MAIN_TS = readFileSync(join(__dirname, "..", "main.ts"), "utf-8");

describe("main.ts — guttered headings on phones", () => {
  it("returns the empty extension on phones, inside gutteredHeadingsContent", () => {
    const start = MAIN_TS.indexOf("private gutteredHeadingsContent(");
    expect(start).toBeGreaterThan(-1);
    const end = MAIN_TS.indexOf("private focusContent(", start);
    expect(end).toBeGreaterThan(start);
    const body = MAIN_TS.slice(start, end);
    expect(body).toMatch(
      /if\s*\(\s*!enabled\s*\|\|\s*Platform\.isPhone\s*\)\s*return EMPTY_EXTENSION/,
    );
    // Tablets must keep the gutter: no broader mobile gate here.
    expect(body).not.toContain("isMobile");
  });
});

describe("main.ts — dimming status bar label", () => {
  it("labels the dimming toggle On/Off with 'Dimming'", () => {
    const start = MAIN_TS.indexOf("updateSyntaxDimmingStatus() {");
    expect(start).toBeGreaterThan(-1);
    const body = MAIN_TS.slice(start, MAIN_TS.indexOf("// --- Document Methods", start));
    expect(body).toMatch(/["']Dimming: On["']/);
    expect(body).toMatch(/["']Dimming: Off["']/);
    expect(body).not.toMatch(/["'`][^"'`]*Syntax/);
  });
});
