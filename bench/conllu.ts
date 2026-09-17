export interface ConlluToken {
  form: string;
  upos: string;
  start: number;
  end: number;
}

export interface ConlluSentence {
  surface: string;
  tokens: ConlluToken[];
}

/** Hand-rolled parser for the CoNLL-U treebank format (10 tab-separated columns). */
export function parseConllu(text: string): ConlluSentence[] {
  const sentences: ConlluSentence[] = [];
  let surface = "";
  let tokens: ConlluToken[] = [];
  // Span reserved for the tokens covered by an in-progress multiword token row.
  let mwtEnd: number | null = null;
  let mwtSpan: { start: number; end: number } | null = null;

  const flush = () => {
    if (surface.length > 0 || tokens.length > 0) {
      sentences.push({ surface: surface.replace(/ $/, ""), tokens });
    }
    surface = "";
    tokens = [];
    mwtEnd = null;
    mwtSpan = null;
  };

  for (const line of text.split("\n")) {
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (line.startsWith("#")) continue;

    const cols = line.split("\t");
    const [id, form, , upos, , , , , , misc] = cols;
    const spaceAfter = !misc?.includes("SpaceAfter=No");

    if (id.includes("-")) {
      // Multiword token row: contributes its surface form, no gold tag.
      const [, endStr] = id.split("-");
      const start = surface.length;
      const end = start + form.length;
      surface += form;
      if (spaceAfter) surface += " ";
      mwtEnd = Number(endStr);
      mwtSpan = { start, end };
      continue;
    }

    if (id.includes(".")) {
      // Empty node: not part of the surface, no gold tag.
      continue;
    }

    const numericId = Number(id);
    if (mwtSpan && mwtEnd !== null && numericId <= mwtEnd) {
      // Sub-token of a multiword token. Its own span is the next `form.length`
      // characters of the MWT surface when the sub-token forms concatenate to
      // it (`do` + `n't` = `don't`, true for every MWT in UD-EWT test); otherwise
      // it shares the whole MWT span. Distinct sub-spans keep one predicted tag
      // over the contraction from matching every sub-token in the scorer.
      const span: { start: number; end: number } = mwtSpan;
      const start: number = span.start;
      const end: number =
        form.length <= span.end - span.start ? start + form.length : span.end;
      tokens.push({ form, upos, start, end });
      mwtSpan = { start: end, end: span.end };
      if (numericId === mwtEnd) {
        mwtEnd = null;
        mwtSpan = null;
      }
      continue;
    }

    const start = surface.length;
    const end = start + form.length;
    surface += form;
    if (spaceAfter) surface += " ";
    tokens.push({ form, upos, start, end });
  }

  flush();
  return sentences;
}
