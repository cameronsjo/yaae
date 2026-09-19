import { Extension } from '@codemirror/state';
import { gutter, GutterMarker, EditorView } from '@codemirror/view';
import type { BlockInfo } from '@codemirror/view';

const HEADING_REGEX = /^(#{1,6})\s/;

class HeadingMarker extends GutterMarker {
  constructor(private readonly level: number) {
    super();
  }

  eq(other: GutterMarker): boolean {
    return other instanceof HeadingMarker && other.level === this.level;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'yaae-heading-gutter-marker';
    span.textContent = '#'.repeat(this.level);
    return span;
  }
}

const SPACER = new HeadingMarker(6);

export function gutteredHeadingsExtension(): Extension {
  return gutter({
    class: 'yaae-heading-gutter',
    lineMarker(view: EditorView, line: BlockInfo): GutterMarker | null {
      const text = view.state.doc.lineAt(line.from).text;
      const match = HEADING_REGEX.exec(text);
      if (!match) return null;
      return new HeadingMarker(match[1].length);
    },
    initialSpacer: () => SPACER,
  });
}
