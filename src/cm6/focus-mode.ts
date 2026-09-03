import { type Extension, type Range } from '@codemirror/state';
import {
  ViewPlugin,
  ViewUpdate,
  Decoration,
  DecorationSet,
  EditorView,
} from '@codemirror/view';
import type { FocusMode } from '../types';
import { findSentenceBounds, findParagraphBounds } from './sentence-detection';

const dimmedMark = Decoration.mark({ class: 'yaae-dimmed' });
const dimmedLine = Decoration.line({ class: 'yaae-dimmed' });

class FocusModePlugin {
  decorations: DecorationSet;
  private mode: FocusMode;
  private scrolling = false;
  private scrollTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(view: EditorView, mode: FocusMode) {
    this.mode = mode;
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (this.scrolling) return;
    if (
      update.docChanged ||
      update.selectionSet ||
      update.viewportChanged
    ) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  handleScroll() {
    this.scrolling = true;
    this.decorations = Decoration.none;

    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    this.scrollTimeout = setTimeout(() => {
      this.scrolling = false;
      this.scrollTimeout = null;
      // Decorations will be rebuilt on next update cycle
    }, 150);
  }

  destroy() {
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const { state } = view;
    const pos = state.selection.main.head;
    const docText = state.doc.toString();

    if (docText.length === 0) return Decoration.none;

    let activeFrom: number;
    let activeTo: number;

    if (this.mode === 'sentence') {
      const bounds = findSentenceBounds(docText, pos);
      activeFrom = bounds.from;
      activeTo = bounds.to;
    } else {
      const bounds = findParagraphBounds(docText, pos);
      activeFrom = bounds.from;
      activeTo = bounds.to;
    }

    const decorations: Range<Decoration>[] = [];

    // Dim everything before and after the active region.
    if (activeFrom > 0) {
      decorations.push(dimmedMark.range(0, activeFrom));
    }
    if (activeTo < docText.length) {
      decorations.push(dimmedMark.range(activeTo, docText.length));
    }

    // Mark decorations do not style an empty CM6 line. Decorate blank lines
    // separately so paragraph gaps outside the focus region are dimmed too.
    for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
      const line = state.doc.line(lineNumber);
      const isOutsideActiveRegion = line.to <= activeFrom || line.from >= activeTo;
      if (line.length === 0 && isOutsideActiveRegion) {
        decorations.push(dimmedLine.range(line.from));
      }
    }

    return Decoration.set(decorations, true);
  }
}

export function focusExtension(mode: FocusMode): Extension {
  return [
    ViewPlugin.fromClass(
      class extends FocusModePlugin {
        constructor(view: EditorView) {
          super(view, mode);
        }
      },
      {
        decorations: (v) => v.decorations,
        eventHandlers: {
          scroll(event, view) {
            this.handleScroll();
          },
        },
      }
    ),
  ];
}
