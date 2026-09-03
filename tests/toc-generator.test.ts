import { describe, it, expect } from "vitest";
import {
  generateToc,
  hasToc,
  resolveTocDepth,
} from "../src/document/toc-generator";

const fm = (body: string) =>
  `---\ntitle: Test\ncreated: 2024-01-01\n---\n${body}`;

describe("generateToc", () => {
  // --- Happy paths ---

  it("generates TOC from simple headings", () => {
    const content = fm("\n## Introduction\n\n## Methods\n\n## Results\n");
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(3);
    expect(result).toContain("## Table of Contents");
    expect(result).toContain("- [Introduction](#introduction)");
    expect(result).toContain("- [Methods](#methods)");
    expect(result).toContain("- [Results](#results)");
  });

  it("respects maxDepth parameter", () => {
    const content = fm("\n## H2\n\n### H3\n\n#### H4\n");
    const { entryCount: all } = generateToc(content, 6);
    expect(all).toBe(3);

    const { entryCount: limited } = generateToc(content, 2);
    expect(limited).toBe(1);
  });

  it("defaults maxDepth to 3", () => {
    const content = fm("\n## H2\n\n### H3\n\n#### H4\n");
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(2); // H2 + H3, not H4
  });

  it("indents nested headings relative to the shallowest level", () => {
    // Shallowest is H2; H3 nests by one level (2 spaces), H4 by two (4 spaces).
    const content = fm("\n## Parent\n\n### Child\n\n#### Grandchild\n");
    const { content: result } = generateToc(content, 4);
    expect(result).toContain("- [Parent](#parent)");
    expect(result).toContain("  - [Child](#child)");
    expect(result).toContain("    - [Grandchild](#grandchild)");
  });

  it("inserts TOC after frontmatter", () => {
    const content = fm("\n## Hello\n");
    const { content: result } = generateToc(content);
    // TOC should appear between frontmatter and body
    const fmEnd = result.indexOf("---", result.indexOf("---") + 3);
    const tocStart = result.indexOf("## Table of Contents");
    const bodyHeading = result.indexOf("## Hello");
    expect(tocStart).toBeGreaterThan(fmEnd);
    expect(bodyHeading).toBeGreaterThan(tocStart);
  });

  it("prepends TOC when no frontmatter", () => {
    const content = "## Hello\n\n## World\n";
    const { content: result } = generateToc(content);
    expect(result.startsWith("## Table of Contents")).toBe(true);
    expect(result).toContain("## Hello");
  });

  // --- Idempotent replacement ---

  it("replaces existing TOC block", () => {
    const content = fm(`
## Table of Contents

  - [Old Entry](#old-entry)

---

## New Section

## Another Section
`);
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(2);
    expect(result).not.toContain("Old Entry");
    expect(result).toContain("- [New Section](#new-section)");
    expect(result).toContain("- [Another Section](#another-section)");
  });

  it("is idempotent — running twice produces same output", () => {
    const content = fm("\n## Alpha\n\n## Beta\n");
    const { content: first } = generateToc(content);
    const { content: second } = generateToc(first);
    expect(second).toBe(first);
  });

  // --- Skipping logic ---

  it("skips headings inside code blocks", () => {
    const content = fm(
      "\n## Real Heading\n\n```\n## Fake Heading\n```\n\n## Another Real\n",
    );
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(2);
  });

  it("skips headings inside frontmatter", () => {
    // Frontmatter can have keys that look like headings (they don't, but test the skip)
    const content = `---\ntitle: Test\ncreated: 2024-01-01\n---\n\n## Real Heading\n`;
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(1);
  });

  it('skips the "Table of Contents" heading itself', () => {
    const content = fm("\n## Table of Contents\n\n## Introduction\n");
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(1);
  });

  // --- Slugification ---

  it("slugifies headings with special characters", () => {
    const content = fm("\n## Hello, World!\n");
    const { content: result } = generateToc(content);
    expect(result).toContain("(#hello-world)");
  });

  it("slugifies headings with multiple spaces", () => {
    const content = fm("\n## Foo   Bar\n");
    const { content: result } = generateToc(content);
    expect(result).toContain("(#foo-bar)");
  });

  // --- Edge cases ---

  it("handles content with no headings", () => {
    const content = fm("\nJust a paragraph with no headings.\n");
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(0);
  });

  it("returns entry count of zero for empty body", () => {
    const content = fm("");
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(0);
  });

  it("handles h1 headings", () => {
    const content = fm("\n# Top Level\n");
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(1);
    expect(result).toContain("- [Top Level](#top-level)");
  });

  // --- F1: frontmatter with literal '---' inside a block scalar ---

  it("does not split frontmatter when YAML contains a literal --- block scalar", () => {
    // The `description` block scalar contains a literal '---' line. A naive
    // indexOf('---', n) would find this and insert the TOC mid-frontmatter.
    const content = [
      "---",
      "title: Test",
      "description: |",
      "  ---",
      "  divider in description",
      "---",
      "",
      "## Real Heading",
      "",
    ].join("\n");

    const { content: result } = generateToc(content);

    // Frontmatter must remain intact and unmodified.
    const fmStart = result.indexOf("---");
    const fmEnd = result.indexOf("\n---\n", fmStart + 3);
    expect(fmStart).toBe(0);
    expect(fmEnd).toBeGreaterThan(0);

    const frontmatter = result.slice(fmStart, fmEnd + 4);
    expect(frontmatter).toContain("description: |");
    expect(frontmatter).toContain("  ---");
    expect(frontmatter).toContain("  divider in description");
    // Description block scalar must NOT contain the TOC heading.
    expect(frontmatter).not.toContain("Table of Contents");

    // TOC should appear after the closing fence.
    const tocStart = result.indexOf("## Table of Contents");
    expect(tocStart).toBeGreaterThan(fmEnd);
    expect(result).toContain("- [Real Heading](#real-heading)");
  });

  // --- F2: tilde-fenced code blocks ---

  it("skips headings inside tilde-fenced code blocks", () => {
    const content = fm(
      "\n## Real Heading\n\n~~~markdown\n# Hidden\n## Also Hidden\n~~~\n\n## Another Real\n",
    );
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(2);
    expect(result).toContain("- [Real Heading](#real-heading)");
    expect(result).toContain("- [Another Real](#another-real)");
    // "Hidden" headings should not appear in TOC entries — but they remain in
    // the document body, so check just the TOC region.
    const tocStart = result.indexOf("## Table of Contents");
    const tocEnd = result.indexOf("\n---", tocStart);
    const tocBlock = result.slice(tocStart, tocEnd);
    expect(tocBlock).not.toContain("Hidden");
  });

  // --- F3: slugify strips inline markdown ---

  it("strips inline link syntax when slugifying headings", () => {
    const content = fm("\n## Threat Model [Overview](./tm.md)\n");
    const { content: result } = generateToc(content);
    // Slug should match Obsidian's plain-text anchor: lowercase, hyphenated.
    expect(result).toContain("(#threat-model-overview)");
    // Display text should be the rendered plain text, not the raw link syntax.
    expect(result).toContain("- [Threat Model Overview]");
    // The TOC region itself must not contain link syntax (the body still does).
    const tocStart = result.indexOf("## Table of Contents");
    const tocEnd = result.indexOf("\n---", tocStart);
    const tocBlock = result.slice(tocStart, tocEnd);
    expect(tocBlock).not.toContain("[Overview](./tm.md)");
  });

  it("strips inline code when slugifying headings", () => {
    const content = fm("\n## Using `useEffect` Hook\n");
    const { content: result } = generateToc(content);
    expect(result).toContain("(#using-useeffect-hook)");
    expect(result).toContain("- [Using useEffect Hook]");
  });

  it("strips wikilinks when slugifying headings", () => {
    const content = fm("\n## See [[Other Note|the other note]] for more\n");
    const { content: result } = generateToc(content);
    expect(result).toContain("- [See the other note for more]");
    expect(result).toContain("(#see-the-other-note-for-more)");
  });

  // --- F4: non-contiguous heading levels ---

  it("does not over-indent when document starts at H3", () => {
    // Old behavior: H3 → 4 spaces (assumed H1 was the root). New behavior:
    // shallowest is H3 → no indent.
    const content = fm("\n### First\n\n### Second\n");
    const { content: result } = generateToc(content);
    expect(result).toContain("- [First](#first)");
    expect(result).toContain("- [Second](#second)");
    // No 4-space-indented entries.
    expect(result).not.toMatch(/\n {4}- \[First\]/);
    expect(result).not.toMatch(/\n {4}- \[Second\]/);
  });

  it("indents relative to shallowest level when doc starts at H2", () => {
    // Doc with H2 + H4 (no H3): minLevel=2, H2=depth 0, H4=depth 2.
    const content = fm("\n## Section\n\n#### Detail\n");
    const { content: result } = generateToc(content, 4);
    expect(result).toContain("- [Section](#section)");
    expect(result).toContain("    - [Detail](#detail)");
  });

  // --- Round-2: marker-aware fence tracking (boolean → marker refactor) ---
  // Old `inCodeBlock` boolean treated any ``` or ~~~ as toggle, so a tilde
  // line embedded inside a backtick fence (illustrative markdown showing
  // alternative fences) would close the outer block early and headings
  // after it would erroneously land in the TOC.

  it("does not close a backtick fence when a tilde line appears inside", () => {
    const content = fm(
      [
        "",
        "## Real Heading",
        "",
        "```markdown",
        "~~~",
        "## Hidden Inner",
        "~~~",
        "## Still Hidden",
        "```",
        "",
        "## Tail Heading",
        "",
      ].join("\n"),
    );
    const { content: result, entryCount } = generateToc(content);
    // Only the two real headings; the inner ones are inside the backtick fence
    expect(entryCount).toBe(2);
    const tocStart = result.indexOf("## Table of Contents");
    const tocEnd = result.indexOf("\n---", tocStart);
    const tocBlock = result.slice(tocStart, tocEnd);
    expect(tocBlock).toContain("Real Heading");
    expect(tocBlock).toContain("Tail Heading");
    expect(tocBlock).not.toContain("Hidden Inner");
    expect(tocBlock).not.toContain("Still Hidden");
  });

  it("does not close a tilde fence when a backtick line appears inside", () => {
    const content = fm(
      [
        "",
        "## Real Heading",
        "",
        "~~~markdown",
        "```",
        "## Hidden Inner",
        "```",
        "## Still Hidden",
        "~~~",
        "",
        "## Tail Heading",
        "",
      ].join("\n"),
    );
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(2);
    const tocStart = result.indexOf("## Table of Contents");
    const tocEnd = result.indexOf("\n---", tocStart);
    const tocBlock = result.slice(tocStart, tocEnd);
    expect(tocBlock).toContain("Real Heading");
    expect(tocBlock).toContain("Tail Heading");
    expect(tocBlock).not.toContain("Hidden Inner");
    expect(tocBlock).not.toContain("Still Hidden");
  });

  it("treats a fence that never closes as swallowing all subsequent headings", () => {
    // Defensive: if the document leaves a fence open, headings after it
    // shouldn't escape into the TOC. Better to under-include than to leak
    // code into the TOC.
    const content = fm(
      ["", "## Before", "", "```", "## Trapped", "## Also Trapped", ""].join(
        "\n",
      ),
    );
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(1);
  });

  it("handles multiple back-to-back fences with no trailing content", () => {
    const content = fm(
      [
        "",
        "## A",
        "",
        "```",
        "## hidden a",
        "```",
        "",
        "~~~",
        "## hidden b",
        "~~~",
        "",
        "## B",
        "",
      ].join("\n"),
    );
    const { content: result, entryCount } = generateToc(content);
    expect(entryCount).toBe(2);
    const tocStart = result.indexOf("## Table of Contents");
    const tocEnd = result.indexOf("\n---", tocStart);
    const tocBlock = result.slice(tocStart, tocEnd);
    expect(tocBlock).toContain("- [A]");
    expect(tocBlock).toContain("- [B]");
    expect(tocBlock).not.toContain("hidden");
  });

  // --- Horizontal rules vs frontmatter ---

  it("does not mistake a horizontal rule for frontmatter in docs without frontmatter", () => {
    // A bare `---` beyond line 0 is an hr, not a frontmatter fence. Headings
    // after it must still be collected.
    const content = "# Title\n\nIntro.\n\n---\n\n## After The Rule\n";
    const { entryCount, content: result } = generateToc(content);
    expect(entryCount).toBe(2);
    expect(result).toContain("- [After The Rule](#after-the-rule)");
  });

  it("is idempotent on documents without frontmatter", () => {
    // The generated TOC block itself ends with `---`; a second pass must not
    // read that as frontmatter-open and drop every later heading.
    const content = "# Title\n\n## Section One\n\n## Section Two\n";
    const first = generateToc(content);
    expect(first.entryCount).toBe(3);
    const second = generateToc(first.content);
    expect(second.entryCount).toBe(3);
    expect(second.content).toBe(first.content);
  });

  it("still skips headings inside real frontmatter", () => {
    const content = '---\ntitle: "# Not A Heading"\n---\n\n## Real Heading\n';
    const { entryCount, content: result } = generateToc(content);
    expect(entryCount).toBe(1);
    expect(result).toContain("- [Real Heading](#real-heading)");
  });
});

describe("fenced TOC samples (corruption guard)", () => {
  const fencedSample = [
    "# Notes on the plugin",
    "",
    "The generated block looks like this:",
    "",
    "```markdown",
    "## Table of Contents",
    "",
    "- [Example](#example)",
    "",
    "---",
    "```",
    "",
    "## Real Section",
  ].join("\n");

  it("a TOC inside a code fence does not count as opted in", async () => {
    const { hasToc } = await import("../src/document/toc-generator");
    expect(hasToc(fencedSample)).toBe(false);
  });

  it("generateToc never splices into a fenced TOC sample", () => {
    const { content: result } = generateToc(fencedSample);
    // The fenced sample must survive byte-for-byte; the new TOC is inserted
    // at the top (no frontmatter), not into the fence.
    expect(result).toContain(
      "```markdown\n## Table of Contents\n\n- [Example](#example)\n\n---\n```",
    );
    expect(result.startsWith("## Table of Contents")).toBe(true);
  });

  it("replaces the real TOC while leaving a fenced sample untouched", () => {
    const withRealToc = generateToc(fencedSample).content;
    // Add a heading, regenerate — the real TOC updates, the sample survives.
    const edited = `${withRealToc}\n\n## Added Later`;
    const { content: regenerated } = generateToc(edited);
    expect(regenerated).toContain("- [Added Later](#added-later)");
    expect(regenerated).toContain(
      "```markdown\n## Table of Contents\n\n- [Example](#example)\n\n---\n```",
    );
    // Exactly one unfenced TOC heading.
    const headings = regenerated
      .split("\n")
      .filter((l) => l === "## Table of Contents");
    expect(headings).toHaveLength(2); // one real + one inside the fence
  });
});

describe("CRLF line endings", () => {
  it("detects frontmatter and headings in CRLF content", () => {
    const content =
      "---\r\ntitle: Test\r\ncreated: 2024-01-01\r\n---\r\n\r\n## Section One\r\n\r\n## Section Two\r\n";
    const { entryCount } = generateToc(content);
    expect(entryCount).toBe(2);
  });

  it("detects an existing TOC block in CRLF content (no duplicate insertion)", () => {
    const content = [
      "## Table of Contents",
      "",
      "- [Old](#old)",
      "",
      "---",
      "",
      "## Section One",
    ].join("\r\n");
    expect(hasToc(content)).toBe(true);
    const { content: result } = generateToc(content);
    const headings = result
      .split("\n")
      .filter((l) => l.replace(/\r$/, "") === "## Table of Contents");
    expect(headings).toHaveLength(1);
    expect(result).toContain("- [Section One](#section-one)");
  });
});

describe("unclosed frontmatter (indeterminate documents)", () => {
  it("refuses to modify a document whose frontmatter never closes", () => {
    // Line-0 `---` with no close is usually a mid-edit state; YAML `#`
    // comments must not become TOC entries.
    const content =
      "---\ntitle: Test\n# this is a YAML comment, not a heading\ncreated: 2024-01-01\n\n## Real Heading\n";
    const { content: result, entryCount } = generateToc(content);
    expect(result).toBe(content);
    expect(entryCount).toBe(0);
  });

  it("hasToc is false for an unclosed-frontmatter document", () => {
    const unclosed = "---\ntitle: Test\n\n## Table of Contents\n\n- [x](#x)\n";
    expect(hasToc(unclosed)).toBe(false);
  });
});

describe("resolveTocDepth", () => {
  it("prefers the per-file export.pdf.tocDepth frontmatter override", () => {
    const content =
      "---\ntitle: Test\ncreated: 2024-01-01\nexport:\n  pdf:\n    tocDepth: 2\n---\n\n## H2\n";
    expect(resolveTocDepth(content, 5)).toBe(2);
  });

  it("falls back to the settings default without an override", () => {
    const content = fm("\n## H2\n");
    expect(resolveTocDepth(content, 4)).toBe(4);
  });

  it("falls back on content without frontmatter", () => {
    expect(resolveTocDepth("# Just a heading\n", 3)).toBe(3);
  });
});
