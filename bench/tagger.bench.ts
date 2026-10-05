import { bench, describe } from "vitest";
import { candidates } from "./taggers";
import { corpusLines, corpusWordCount, viewportLines } from "./corpus";

// Frame budget for the "viewport" case: a cold tag pass over the visible
// lines of an editor viewport should fit inside one 16ms frame.

for (const [name, createTagger] of Object.entries(candidates)) {
  describe(`tagger: ${name}`, () => {
    bench(`throughput — tag ${corpusWordCount} words (~5k word corpus)`, () => {
      const tagger = createTagger();
      for (const line of corpusLines) {
        tagger.tag(line);
      }
    });

    bench(`viewport — cold tag ${viewportLines.length} lines`, () => {
      const tagger = createTagger();
      for (const line of viewportLines) {
        tagger.tag(line);
      }
    });
  });
}
