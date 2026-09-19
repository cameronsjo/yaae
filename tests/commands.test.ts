import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Structural test: verify that main.ts registers all README-documented commands.
 *
 * We parse main.ts as text rather than importing the plugin class, because
 * CM6 imports require browser DOM globals that are impractical to mock fully.
 * This catches renamed/deleted commands without needing a running Obsidian.
 */

const MAIN_TS = readFileSync(join(__dirname, "..", "main.ts"), "utf-8");

// Expected command IDs — must match README Commands table
const EXPECTED_COMMANDS = [
  { id: "toggle-prose-highlighting", name: "Toggle prose highlighting" },
  {
    id: "copy-prose-highlight-debug",
    name: "Copy prose highlighting debug info",
  },
  {
    id: "toggle-prose-highlight-mobile-override",
    name: "Toggle prose highlighting mobile override (debug)",
  },
  { id: "toggle-syntax-dimming", name: "Toggle syntax dimming" },
  { id: "toggle-guttered-headings", name: "Toggle guttered headings" },
  { id: "cycle-focus-mode", name: "Cycle focus mode" },
  { id: "yaae-validate", name: "Validate frontmatter" },
  { id: "yaae-generate-toc", name: "Generate table of contents" },
  {
    id: "yaae-clean-css-classes",
    name: "Clean PDF CSS classes from frontmatter",
  },
  {
    id: "yaae-clean-css-classes-vault",
    name: "Clean PDF CSS classes from frontmatter (entire vault)",
  },
  // Temporary 3a probe commands (#28/#29) — removed with the probe.
  { id: "yaae-debug-print-probe", name: "Toggle print probe (debug)" },
  {
    id: "yaae-debug-print-probe-report",
    name: "Copy print probe report (debug)",
  },
];

// Extract all addCommand({ id: "..." }) calls from main.ts.
//
// Quote-agnostic on purpose: a quote-style reformat in 31c2418 made this
// pattern match nothing for two weeks, and the extraction failing silently is
// what made it survive that long (#51).
const COMMAND_ID_PATTERN = /this\.addCommand\(\{\s*id:\s*["']([^"']+)["']/g;
const registeredIds: string[] = [];
let m: RegExpExecArray | null;
while ((m = COMMAND_ID_PATTERN.exec(MAIN_TS)) !== null) {
  registeredIds.push(m[1]);
}

describe("command registration (structural)", () => {
  // The extraction above is the thing most likely to break, and when it
  // breaks it yields an empty list rather than an error. Assert it found
  // something before any test reasons about what it found — otherwise
  // "registers exactly the documented commands" could pass on a day when
  // EXPECTED_COMMANDS is empty too.
  it("extracts at least one command id from main.ts", () => {
    expect(registeredIds.length).toBeGreaterThan(0);
  });

  it("main.ts contains addCommand calls for all documented commands", () => {
    for (const cmd of EXPECTED_COMMANDS) {
      expect(registeredIds, `missing command: ${cmd.id}`).toContain(cmd.id);
    }
  });

  it("registers exactly the documented commands", () => {
    expect(registeredIds).toHaveLength(EXPECTED_COMMANDS.length);
  });

  it("every command has a name string in its addCommand call", () => {
    for (const cmd of EXPECTED_COMMANDS) {
      // Quote-agnostic, and the name is escaped because it is prose that may
      // contain regex metacharacters.
      const escaped = cmd.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(MAIN_TS, `missing name for: ${cmd.id}`).toMatch(
        new RegExp(`name:\\s*["']${escaped}["']`),
      );
    }
  });
});
