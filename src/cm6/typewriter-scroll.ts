import { Extension } from '@codemirror/state';
import {
  ViewPlugin,
  ViewUpdate,
  EditorView,
} from '@codemirror/view';

class TypewriterScrollPlugin {
  private view: EditorView;
  private padding = 0;

  constructor(view: EditorView) {
    this.view = view;
    this.updatePadding();
    this.recenter();
  }

  update(update: ViewUpdate) {
    if (update.geometryChanged) {
      this.updatePadding();
    }

    // Only scroll on user-initiated events
    for (const tr of update.transactions) {
      if (
        tr.isUserEvent('input') ||
        tr.isUserEvent('select') ||
        tr.isUserEvent('delete') ||
        tr.isUserEvent('move')
      ) {
        this.recenter();
        return;
      }
    }
  }

  destroy() {
    const sizer = this.view.dom.querySelector('.cm-sizer') as HTMLElement | null;
    if (sizer) {
      sizer.style.paddingBottom = '';
    }
  }

  private getOffset(): number {
    const editor = this.view.dom.closest('.cm-editor');
    if (!editor) return 0;
    return Math.floor(editor.clientHeight * 0.5);
  }

  private updatePadding() {
    const offset = this.getOffset();
    if (offset === this.padding) return;
    this.padding = offset;

    const sizer = this.view.dom.querySelector('.cm-sizer') as HTMLElement | null;
    if (sizer) {
      sizer.style.paddingBottom = `${offset}px`;
    }
  }

  private recenter() {
    const head = this.view.state.selection.main.head;
    const offset = this.getOffset();
    this.view.dispatch({
      effects: EditorView.scrollIntoView(head, {
        y: 'start',
        yMargin: offset,
      }),
    });
  }
}

export function typewriterExtension(): Extension {
  return ViewPlugin.fromClass(TypewriterScrollPlugin);
}
