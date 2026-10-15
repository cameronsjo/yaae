import { readFileSync } from "node:fs";
import path from "node:path";
import { it } from "vitest";
import { candidates } from "./taggers";
import type { POSTag } from "../src/prose-highlight/tagger";

/**
 * Side-by-side felt check: renders sample lines as `word/CATEGORY` for every
 * candidate, with a `*` after any word the candidates disagree on. Prints to
 * stdout for pasting into a research doc; asserts nothing beyond running.
 *
 * Run: pnpm vitest run bench/sample.test.ts
 */

const SAMPLE_LINE_COUNT = 8;
const MIN_WORDS_PER_LINE = 10;

const ABBREVIATION: Record<string, string> = {
  adjective: "ADJ",
  noun: "N",
  adverb: "ADV",
  verb: "V",
  conjunction: "CONJ",
};

function sampleLines(): string[] {
  const fixture = path.resolve(process.cwd(), "tests/fixtures/prose-sample.md");
  return readFileSync(fixture, "utf-8")
    .split("\n")
    .filter((line) => !line.startsWith("#") && !line.startsWith("- "))
    .filter((line) => line.trim().split(/\s+/).length >= MIN_WORDS_PER_LINE)
    .slice(0, SAMPLE_LINE_COUNT);
}

/** Category label for the tag covering a word's start offset, if any. */
function categoryAt(tags: POSTag[], start: number): string {
  const hit = tags.find((tag) => tag.start <= start && start < tag.end);
  return hit ? ABBREVIATION[hit.pos] : "-";
}

function render(line: string): string[] {
  const words = [...line.matchAll(/\S+/g)];
  const perCandidate = Object.entries(candidates).map(([name, make]) => {
    const tags = make().tag(line);
    return { name, labels: words.map((w) => categoryAt(tags, w.index)) };
  });
  return perCandidate.map(({ name, labels }) => {
    const rendered = words.map((w, i) => {
      const disagree = perCandidate.some((c) => c.labels[i] !== labels[i]);
      return `${w[0]}/${labels[i]}${disagree ? "*" : ""}`;
    });
    return `${name.padEnd(10)} ${rendered.join(" ")}`;
  });
}

it("renders a side-by-side sample for every candidate", () => {
  const out: string[] = [];
  for (const line of sampleLines()) {
    out.push(`> ${line}`, ...render(line), "");
  }
  console.log(out.join("\n"));
});
