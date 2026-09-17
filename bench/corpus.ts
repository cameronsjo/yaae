import { readFileSync } from "node:fs";
import path from "node:path";

const TARGET_WORD_COUNT = 5000;
const VIEWPORT_LINE_COUNT = 60;

const fixturePath = path.resolve(process.cwd(), "tests/fixtures/prose-sample.md");
const raw = readFileSync(fixturePath, "utf-8");
const sourceLines = raw.split("\n");

function wordCount(lines: string[]): number {
  return lines.reduce((total, line) => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    return total + words.length;
  }, 0);
}

// Repeat the source lines until the corpus reaches ~5,000 words.
const repeated: string[] = [];
while (wordCount(repeated) < TARGET_WORD_COUNT) {
  repeated.push(...sourceLines);
}

export const corpusLines: string[] = repeated;
export const corpusWordCount: number = wordCount(repeated);

export const viewportLines: string[] = repeated
  .filter((line) => line.trim().length > 0)
  .slice(0, VIEWPORT_LINE_COUNT);
