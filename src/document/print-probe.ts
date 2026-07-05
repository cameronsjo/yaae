/**
 * Temporary dev probe for the PDF pipeline (#28/#29 empirical gate).
 *
 * Question under test: do CLASS-SCOPED selectors reach the print DOM?
 * Obsidian's printToPDF() includes plugin <style> elements, but whether the
 * export renders against the live DOM (body classes intact) or a stripped
 * clone decides if themes get a class-scoped PDF hook or we bake pure
 * state-based rules.
 *
 * While armed, the probe:
 *  - adds `yaae-probe-body` to <body> and `yaae-probe-view` to the active
 *    markdown view container;
 *  - injects @media print rules: an UNSCOPED positive control (underline),
 *    a body-class-scoped rule (red), and a view-class-scoped rule (blue);
 *  - watches for export-time signals: matchMedia('print') flips,
 *    before/afterprint events, and DOM mutations (does a `.print` container
 *    appear? is `.markdown-preview-sizer` present? what carries cssclasses?).
 *
 * Read the exported PDF: underline only → class scoping is dead; red →
 * body-class scoping works; blue → view-class scoping works.
 *
 * Temporary tooling — remove once the 3a gate is decided.
 */

const PROBE_STYLE_ID = 'yaae-print-probe';
const PROBE_BODY_CLASS = 'yaae-probe-body';
const PROBE_VIEW_CLASS = 'yaae-probe-view';
const MAX_LOG_ENTRIES = 300;

const PROBE_CSS = `
@media print {
  /* Positive control — unscoped. If this doesn't render, plugin styles
     aren't reaching the export at all. */
  h1 { text-decoration: underline !important; }
  /* Body-class scoping — red means body classes survive into the print DOM. */
  body.${PROBE_BODY_CLASS} h1 { color: red !important; }
  /* View-container scoping — blue means the view element (the cssclasses
     carrier) survives with its classes. Blue wins over red where both apply
     (later rule, same specificity outcome on the h1). */
  .${PROBE_VIEW_CLASS} h1 { color: blue !important; }
}
`;

export class PrintProbe {
  private styleEl: HTMLStyleElement | null = null;
  private observer: MutationObserver | null = null;
  private printMedia: MediaQueryList | null = null;
  private log: string[] = [];
  private viewEl: HTMLElement | null = null;
  private mediaListener = (e: MediaQueryListEvent) => {
    this.record(`matchMedia('print') → ${e.matches}`);
    this.snapshot(e.matches ? 'print-media-on' : 'print-media-off');
  };
  private beforePrint = () => {
    this.record('beforeprint event fired');
    this.snapshot('beforeprint');
  };
  private afterPrint = () => {
    this.record('afterprint event fired');
    this.snapshot('afterprint');
  };

  get active(): boolean {
    return this.styleEl !== null;
  }

  /** Arm the probe: classes + rules + observers. */
  enable(viewEl: HTMLElement | null): void {
    if (this.active) return;
    this.log = [];

    document.body.classList.add(PROBE_BODY_CLASS);
    this.viewEl = viewEl;
    if (viewEl) {
      viewEl.classList.add(PROBE_VIEW_CLASS);
      this.record(
        `armed. View container: <${viewEl.tagName.toLowerCase()} class="${viewEl.className}">`,
      );
    } else {
      this.record('armed. No active markdown view — view-scoped rule (blue) is inert.');
    }

    this.styleEl = document.head.createEl('style');
    this.styleEl.id = PROBE_STYLE_ID;
    this.styleEl.textContent = PROBE_CSS;

    this.observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          const cls = node.className && typeof node.className === 'string'
            ? node.className
            : '';
          this.record(`DOM added: <${node.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}>`);
          if (cls.includes('print')) this.snapshot('print-node-added');
        }
        if (m.type === 'attributes' && m.target === document.body) {
          this.record(`body class changed: "${document.body.className}"`);
        }
      }
    });
    this.observer.observe(document.body, {
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    // Direct children of documentElement too — an export container could be
    // mounted beside body rather than inside it.
    this.observer.observe(document.documentElement, { childList: true });

    this.printMedia = window.matchMedia('print');
    this.printMedia.addEventListener('change', this.mediaListener);
    window.addEventListener('beforeprint', this.beforePrint);
    window.addEventListener('afterprint', this.afterPrint);

    this.snapshot('baseline');
  }

  disable(): void {
    if (!this.active) return;
    this.record('disarmed');
    document.body.classList.remove(PROBE_BODY_CLASS);
    this.viewEl?.classList.remove(PROBE_VIEW_CLASS);
    this.viewEl = null;
    this.styleEl?.remove();
    this.styleEl = null;
    this.observer?.disconnect();
    this.observer = null;
    this.printMedia?.removeEventListener('change', this.mediaListener);
    this.printMedia = null;
    window.removeEventListener('beforeprint', this.beforePrint);
    window.removeEventListener('afterprint', this.afterPrint);
  }

  /** One structural snapshot: the presence checks the 3a gate cares about. */
  private snapshot(label: string): void {
    const printEl = document.querySelector('.print');
    const sizer = document.querySelector('.markdown-preview-sizer');
    const preview = document.querySelector('.markdown-preview-view');
    this.record(
      `[${label}] .print=${printEl ? describe(printEl) : 'absent'} ` +
        `.markdown-preview-sizer=${sizer ? 'present' : 'absent'} ` +
        `.markdown-preview-view=${preview ? describe(preview) : 'absent'} ` +
        `body.${PROBE_BODY_CLASS}=${document.body.classList.contains(PROBE_BODY_CLASS)}`,
    );
  }

  private record(message: string): void {
    const entry = `${new Date().toISOString()} ${message}`;
    this.log.push(entry);
    if (this.log.length > MAX_LOG_ENTRIES) this.log.shift();
    console.info(`[yaae] print-probe: ${message}`);
  }

  buildReport(): string {
    return [
      '## YAAE print probe report',
      '',
      `- Chrome: ${navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? 'unknown'}`,
      `- User agent: ${navigator.userAgent}`,
      `- Probe active: ${this.active}`,
      '',
      'PDF verdict key: underline only → class scoping dead; red H1 → body-class',
      'scoping works; blue H1 → view-class scoping works.',
      '',
      '### Event log',
      '',
      '```',
      ...(this.log.length ? this.log : ['(empty — arm the probe, export a PDF, then copy this report)']),
      '```',
    ].join('\n');
  }
}

function describe(el: Element): string {
  return `<${el.tagName.toLowerCase()} class="${el.className}">`;
}
