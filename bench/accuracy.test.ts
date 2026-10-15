import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseConllu } from "./conllu";
import { scoreCandidate, formatScoresTable } from "./accuracy";
import { candidates } from "./taggers";
import type { POSTagger, POSTag } from "../src/prose-highlight/tagger";

describe("parseConllu", () => {
  it("reconstructs surface text and aligns multiword tokens to their span", () => {
    const conllu = [
      "# sent_id = 1",
      "# text = I don't know.",
      "1\tI\tI\tPRON\tPRP\t_\t3\tnsubj\t_\t_",
      "2-3\tdon't\t_\t_\t_\t_\t_\t_\t_\t_",
      "2\tdo\tdo\tAUX\tVBP\t_\t3\taux\t_\tSpaceAfter=No",
      "3\tnot\tnot\tPART\tRB\t_\t3\tadvmod\t_\t_",
      "4\tknow\tknow\tVERB\tVBP\t_\t0\troot\t_\tSpaceAfter=No",
      "5\t.\t.\tPUNCT\t.\t_\t4\tpunct\t_\t_",
      "",
    ].join("\n");

    const sentences = parseConllu(conllu);

    expect(sentences).toHaveLength(1);
    const [sentence] = sentences;
    expect(sentence.surface).toBe("I don't know.");
    expect(sentence.tokens).toEqual([
      { form: "I", upos: "PRON", start: 0, end: 1 },
      // Sub-tokens of the `don't` MWT get consecutive sub-spans of its surface.
      { form: "do", upos: "AUX", start: 2, end: 4 },
      { form: "not", upos: "PART", start: 4, end: 7 },
      { form: "know", upos: "VERB", start: 8, end: 12 },
      { form: ".", upos: "PUNCT", start: 12, end: 13 },
    ]);
  });
});

describe("scoreCandidate", () => {
  it("scores precision/recall/F1 against a hand-made sentence", () => {
    // Surface: "big cat quickly ran the"
    const sentence = {
      surface: "big cat quickly ran the",
      tokens: [
        { form: "big", upos: "ADJ", start: 0, end: 3 },
        { form: "cat", upos: "NOUN", start: 4, end: 7 },
        { form: "quickly", upos: "ADV", start: 8, end: 15 },
        { form: "ran", upos: "VERB", start: 16, end: 19 },
        { form: "the", upos: "DET", start: 20, end: 23 },
      ],
    };

    const fakeTags: POSTag[] = [
      { text: "big", pos: "adjective", start: 0, end: 3 },
      { text: "cat", pos: "noun", start: 4, end: 7 },
      // "quickly" is missed entirely (false negative for adverb).
      { text: "ran", pos: "noun", start: 16, end: 19 }, // wrong: gold is verb
      { text: "the", pos: "adjective", start: 20, end: 23 }, // false positive: gold is null
    ];
    const fakeTagger: POSTagger = { tag: () => fakeTags };

    const scores = scoreCandidate(fakeTagger, [sentence], { auxIsVerb: true });

    expect(scores.categories.adjective.precision).toBeCloseTo(0.5);
    expect(scores.categories.adjective.recall).toBeCloseTo(1);
    expect(scores.categories.adjective.f1).toBeCloseTo(2 / 3);

    expect(scores.categories.noun.precision).toBeCloseTo(0.5);
    expect(scores.categories.noun.recall).toBeCloseTo(1);
    expect(scores.categories.noun.f1).toBeCloseTo(2 / 3);

    expect(scores.categories.adverb.precision).toBe(0);
    expect(scores.categories.adverb.recall).toBe(0);
    expect(scores.categories.adverb.f1).toBe(0);

    expect(scores.categories.verb.precision).toBe(0);
    expect(scores.categories.verb.recall).toBe(0);
    expect(scores.categories.verb.f1).toBe(0);

    expect(scores.categories.conjunction.f1).toBe(0);

    expect(scores.macroF1).toBeCloseTo((2 / 3 + 2 / 3) / 5);
  });

  it("does not reuse one prediction across contraction subtokens", () => {
    const sentence = {
      surface: "don't",
      tokens: [
        { form: "do", upos: "AUX", start: 0, end: 2 },
        { form: "not", upos: "PART", start: 2, end: 5 },
      ],
    };

    // A tagger may return one tag for the surface contraction. It can align
    // with only the first overlapping gold subtoken, not both of them.
    const fakeTags: POSTag[] = [
      { text: "don't", pos: "verb", start: 0, end: 5 },
    ];
    const fakeTagger: POSTagger = { tag: () => fakeTags };

    const scores = scoreCandidate(fakeTagger, [sentence], { auxIsVerb: true });

    expect(scores.categories.verb).toMatchObject({
      truePositives: 1,
      falsePositives: 0,
      falseNegatives: 0,
      precision: 1,
      recall: 1,
      f1: 1,
    });
  });

  it("counts extra non-overlapping predictions as false positives", () => {
    const sentence = {
      surface: "can't",
      tokens: [
        { form: "can't", upos: "NOUN", start: 0, end: 5 },
      ],
    };

    // Both tags satisfy the POSTagger contract: they are lossless, sorted,
    // and non-overlapping, but together over-segment one gold token.
    const fakeTags: POSTag[] = [
      { text: "can", pos: "noun", start: 0, end: 3 },
      { text: "'t", pos: "noun", start: 3, end: 5 },
    ];
    const fakeTagger: POSTagger = { tag: () => fakeTags };

    const scores = scoreCandidate(fakeTagger, [sentence], { auxIsVerb: true });

    expect(scores.categories.noun).toMatchObject({
      truePositives: 1,
      falsePositives: 1,
      falseNegatives: 0,
      precision: 0.5,
      recall: 1,
      f1: 2 / 3,
    });
  });
});

const DATA_PATH = path.resolve(__dirname, "data/en_ewt-ud-test.conllu");
const hasData = existsSync(DATA_PATH);

describe.skipIf(!hasData)("UD-EWT accuracy (run scripts/fetch-ud-ewt.sh first)", () => {
  const sentences = hasData ? parseConllu(readFileSync(DATA_PATH, "utf-8")) : [];

  it(`scores UD-EWT (run scripts/fetch-ud-ewt.sh first) — ${sentences.length} sentences`, () => {
    expect(sentences.length).toBeGreaterThan(0);

    for (const [name, createTagger] of Object.entries(candidates)) {
      for (const auxIsVerb of [true, false]) {
        const scores = scoreCandidate(createTagger(), sentences, { auxIsVerb });
        const label = `${name} (auxIsVerb: ${auxIsVerb}${auxIsVerb ? ", primary" : ""})`;
        // eslint-disable-next-line no-console
        console.log(formatScoresTable(label, scores));
        expect(scores.macroF1).toBeGreaterThanOrEqual(0);
      }
    }
  }, 60_000);
});
