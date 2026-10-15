import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditorState, Transaction } from "@codemirror/state";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import type {
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import type YaaePlugin from "../main";
import {
  createHighlighterExtension,
} from "../src/prose-highlight/highlighter-plugin";
import type { POSTag } from "../src/prose-highlight/tagger";
import type { ProseHighlightSettings, POSCategory } from "../src/types";
import { WinkTagger } from "../src/prose-highlight/wink-tagger";

const POS_BY_WORD: Record<string, POSCategory> = {
  brilliant: "adjective",
  quickly: "adverb",
  same: "noun",
};

function deterministicTags(text: string): POSTag[] {
  const tags: POSTag[] = [];
  const words = /\b(brilliant|quickly|same)\b/g;
  let match: RegExpExecArray | null;
  while ((match = words.exec(text)) !== null) {
    tags.push({
      text: match[0],
      pos: POS_BY_WORD[match[0]],
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return tags;
}

function proseHighlightSettings(): ProseHighlightSettings {
  return {
    enabled: true,
    categories: {
      adjective: { enabled: true, color: "" },
      noun: { enabled: true, color: "" },
      adverb: { enabled: true, color: "" },
      verb: { enabled: true, color: "" },
      conjunction: { enabled: true, color: "" },
    },
    readingViewEnabled: false,
    customWordLists: [],
    highlightInsideHeadings: false,
  };
}

function pluginArg(): YaaePlugin {
  return {
    settings: { proseHighlight: proseHighlightSettings() },
  } as unknown as YaaePlugin;
}

function stateFor(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [markdown()] });
}

/** The highlighter only reads these two EditorView properties while building. */
function viewFor(state: EditorState): EditorView {
  return {
    state,
    visibleRanges: [{ from: 0, to: state.doc.length }],
  } as unknown as EditorView;
}

interface HighlighterInstance {
  decorations: DecorationSet;
  update(update: ViewUpdate): void;
}

function createInstance(state: EditorState): HighlighterInstance {
  const extension = createHighlighterExtension(pluginArg());
  return (
    extension as unknown as ViewPlugin<HighlighterInstance> & {
      create(view: EditorView): HighlighterInstance;
    }
  ).create(viewFor(state));
}

interface EmittedRange {
  from: number;
  to: number;
  className: string | undefined;
}

function emittedRanges(decorations: DecorationSet): EmittedRange[] {
  const ranges: EmittedRange[] = [];
  const cursor = decorations.iter();
  while (cursor.value) {
    ranges.push({
      from: cursor.from,
      to: cursor.to,
      className: (cursor.value.spec as { class?: string }).class,
    });
    cursor.next();
  }
  return ranges;
}

function updateInstance(
  instance: HighlighterInstance,
  startState: EditorState,
  state: EditorState,
  docChanged: boolean,
): void {
  instance.update({
    startState,
    state,
    view: viewFor(state),
    docChanged,
    viewportChanged: false,
  } as ViewUpdate);
}

function updateWithChange(
  instance: HighlighterInstance,
  startState: EditorState,
  change: { from: number; to?: number; insert: string },
  userEvent: string,
): EditorState {
  const state = startState.update({
    changes: change,
    annotations: Transaction.userEvent.of(userEvent),
  }).state;
  updateInstance(instance, startState, state, true);
  return state;
}

describe("production highlighter editor updates", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    vi.spyOn(WinkTagger.prototype, "tag").mockImplementation(deterministicTags);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits the shifted decoration after Enter", () => {
    const initial = stateFor("prefix brilliant");
    const instance = createInstance(initial);
    expect(emittedRanges(instance.decorations)).toEqual([
      { from: 7, to: 16, className: "yaae-pos-adjective" },
    ]);

    const next = updateWithChange(
      instance,
      initial,
      { from: 0, insert: "\n" },
      "input",
    );

    expect(next.doc.toString()).toBe("\nprefix brilliant");
    expect(emittedRanges(instance.decorations)).toEqual([
      { from: 8, to: 17, className: "yaae-pos-adjective" },
    ]);
  });

  it("emits decorations for every highlighted word in a pasted block", () => {
    const initial = stateFor("plain");
    const instance = createInstance(initial);
    expect(emittedRanges(instance.decorations)).toEqual([]);

    const pasted = "brilliant first\nquickly second\n";
    const next = updateWithChange(
      instance,
      initial,
      { from: 0, insert: pasted },
      "input.paste",
    );

    expect(next.doc.toString()).toBe(`${pasted}plain`);
    expect(emittedRanges(instance.decorations)).toEqual([
      { from: 0, to: 9, className: "yaae-pos-adjective" },
      { from: 16, to: 23, className: "yaae-pos-adverb" },
    ]);
  });

  it("removes the decoration after an undo update", () => {
    const initial = stateFor("plain");
    const instance = createInstance(initial);
    const inserted = updateWithChange(
      instance,
      initial,
      { from: 0, insert: "brilliant " },
      "input",
    );
    expect(emittedRanges(instance.decorations)).toEqual([
      { from: 0, to: 9, className: "yaae-pos-adjective" },
    ]);

    const undone = inserted.update({
      changes: { from: 0, to: "brilliant ".length, insert: "" },
      annotations: Transaction.userEvent.of("undo"),
    }).state;
    updateInstance(instance, inserted, undone, true);

    expect(undone.doc.toString()).toBe("plain");
    expect(emittedRanges(instance.decorations)).toEqual([]);
  });

  it("re-emits when the markdown parser progresses without a document change", () => {
    const lines = [
      "intro prose",
      ...Array.from({ length: 1000 }, (_, index) => {
        if (index === 997) return "```js";
        if (index === 998) return "same";
        if (index === 999) return "```";
        return "plain line";
      }),
      "same",
    ];
    const doc = lines.join("\n");
    const initial = stateFor(doc);
    const codeWord = doc.indexOf("same", doc.indexOf("```js"));
    const tailWord = doc.lastIndexOf("same");
    const initialTree = syntaxTree(initial);
    expect(initialTree.length).toBeLessThan(doc.length);

    const instance = createInstance(initial);
    expect(emittedRanges(instance.decorations)).toContainEqual({
      from: codeWord,
      to: codeWord + 4,
      className: "yaae-pos-noun",
    });

    expect(ensureSyntaxTree(initial, doc.length, 5000)).not.toBeNull();
    const progressed = initial.update({}).state;
    expect(syntaxTree(progressed)).not.toBe(initialTree);
    expect(syntaxTree(progressed).length).toBe(doc.length);
    updateInstance(instance, initial, progressed, false);

    expect(emittedRanges(instance.decorations)).not.toContainEqual({
      from: codeWord,
      to: codeWord + 4,
      className: "yaae-pos-noun",
    });
    expect(emittedRanges(instance.decorations)).toContainEqual({
      from: tailWord,
      to: tailWord + 4,
      className: "yaae-pos-noun",
    });
  });

  it("applies exclusion by syntax context when duplicate lines share text", () => {
    const doc = ["same", "```js", "same", "```", "same"].join("\n");
    const state = stateFor(doc);
    expect(ensureSyntaxTree(state, doc.length, 5000)).not.toBeNull();
    const complete = state.update({}).state;
    const instance = createInstance(complete);

    expect(emittedRanges(instance.decorations)).toEqual([
      { from: 0, to: 4, className: "yaae-pos-noun" },
      { from: doc.length - 4, to: doc.length, className: "yaae-pos-noun" },
    ]);
    expect(
      vi.mocked(WinkTagger.prototype.tag).mock.calls.filter(
        ([text]) => text === "same",
      ),
    ).toHaveLength(1);
  });
});
