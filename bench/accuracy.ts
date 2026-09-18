import type { POSTagger } from "../src/prose-highlight/tagger";
import type { POSCategory } from "../src/types";
import { POS_CATEGORIES } from "../src/types";
import { mapUpos } from "./upos-map";
import type { ConlluSentence } from "./conllu";

export interface CategoryScore {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface Scores {
  categories: Record<POSCategory, CategoryScore>;
  macroF1: number;
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function emptyCounts(): Record<POSCategory, { tp: number; fp: number; fn: number }> {
  const counts = {} as Record<POSCategory, { tp: number; fp: number; fn: number }>;
  for (const category of POS_CATEGORIES) {
    counts[category] = { tp: 0, fp: 0, fn: 0 };
  }
  return counts;
}

/**
 * Scores a tagger against a gold-annotated corpus. Alignment: for each gold
 * token, the predicted category is whichever predicted tag's span overlaps
 * the gold token's span (or null if no predicted tag overlaps it).
 */
export function scoreCandidate(
  tagger: POSTagger,
  sentences: ConlluSentence[],
  opts: { auxIsVerb: boolean },
): Scores {
  const counts = emptyCounts();

  for (const sentence of sentences) {
    const predicted = tagger.tag(sentence.surface);

    for (const token of sentence.tokens) {
      const goldCategory = mapUpos(token.upos, opts);
      const predictedTag = predicted.find(
        (tag) => tag.start < token.end && tag.end > token.start,
      );
      const predictedCategory = predictedTag?.pos ?? null;

      if (goldCategory !== null && predictedCategory === goldCategory) {
        counts[goldCategory].tp++;
      } else {
        if (goldCategory !== null) counts[goldCategory].fn++;
        if (predictedCategory !== null) counts[predictedCategory].fp++;
      }
    }
  }

  const categories = {} as Record<POSCategory, CategoryScore>;
  let f1Sum = 0;
  for (const category of POS_CATEGORIES) {
    const { tp, fp, fn } = counts[category];
    const precision = safeDivide(tp, tp + fp);
    const recall = safeDivide(tp, tp + fn);
    const f1 = safeDivide(2 * precision * recall, precision + recall);
    categories[category] = {
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
      precision,
      recall,
      f1,
    };
    f1Sum += f1;
  }

  return { categories, macroF1: f1Sum / POS_CATEGORIES.length };
}

function pct(value: number): string {
  return (value * 100).toFixed(1) + "%";
}

export function formatScoresTable(name: string, scores: Scores): string {
  const lines = [
    `### ${name}`,
    "",
    "| Category | Precision | Recall | F1 |",
    "|---|---|---|---|",
  ];
  for (const category of POS_CATEGORIES) {
    const s = scores.categories[category];
    lines.push(`| ${category} | ${pct(s.precision)} | ${pct(s.recall)} | ${pct(s.f1)} |`);
  }
  lines.push("", `Macro-F1: ${pct(scores.macroF1)}`);
  return lines.join("\n");
}
