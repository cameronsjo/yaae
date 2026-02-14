import { RangeSetBuilder, Extension } from '@codemirror/state';
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

    const builder = new RangeSetBuilder<Decoration>();

    // Dim everything before the active region
    if (activeFrom > 0) {
      builder.add(0, activeFrom, dimmedMark);
    }

    // Dim everything after the active region
    if (activeTo < docText.length) {
      builder.add(activeTo, docText.length, dimmedMark);
    }

    return builder.finish();
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
