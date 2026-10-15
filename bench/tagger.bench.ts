import { test, describe } from "vitest";
import { candidates } from "./taggers";
import { corpusLines, corpusWordCount, viewportLines } from "./corpus";

// Frame budget for the "viewport" case: a cold tag pass over the visible
// lines of an editor viewport should fit inside one 16ms frame.

for (const [name, createTagger] of Object.entries(candidates)) {
  describe(`tagger: ${name}`, () => {
    test(`throughput — tag ${corpusWordCount} words (~5k word corpus)`, async ({ bench }) => {
      await bench("tag lines", () => {
        const tagger = createTagger();
        for (const line of corpusLines) {
          tagger.tag(line);
        }
      }).run();
    });

    test(`viewport — cold tag ${viewportLines.length} lines`, async ({ bench }) => {
      await bench("tag lines", () => {
        const tagger = createTagger();
        for (const line of viewportLines) {
          tagger.tag(line);
        }
      }).run();
    });
  });
}
