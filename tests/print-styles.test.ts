import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClassificationPrintStyleManager } from '../src/document/print-styles';
import type { CustomClassification } from '../src/schemas';

// Mock document.head and createElement for Node.js environment
function setupDOM() {
  const styleEl = {
    id: '',
    textContent: '',
    remove: vi.fn(),
  };

  const headAppendChild = vi.fn();

  (globalThis as any).document = {
    createElement: vi.fn(() => styleEl),
    head: {
      appendChild: headAppendChild,
    },
  };

  return { styleEl, headAppendChild };
}

describe('ClassificationPrintStyleManager', () => {
  let manager: ClassificationPrintStyleManager;
  let dom: ReturnType<typeof setupDOM>;

  beforeEach(() => {
    dom = setupDOM();
    manager = new ClassificationPrintStyleManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('creates a style element on init', () => {
    manager.init([]);
    expect(dom.headAppendChild).toHaveBeenCalledOnce();
    expect(dom.styleEl.id).toBe('yaae-custom-classification-print-styles');
  });

  it('generates empty styles for empty custom list', () => {
    manager.init([]);
    expect(dom.styleEl.textContent).toBe('');
  });

  it('generates @media print rules for custom classifications', () => {
    const customs: CustomClassification[] = [
      { id: 'non-sensitive', label: 'NON-SENSITIVE', color: '#2d7d2d', background: '#f0faf0' },
    ];
    manager.init(customs);
    const css = dom.styleEl.textContent!;

    expect(css).toContain('@media print');
    expect(css).toContain('.pdf-non-sensitive');
    expect(css).toContain('"NON-SENSITIVE"');
    expect(css).toContain('#2d7d2d');
    expect(css).toContain('#f0faf0');
  });

  it('generates rules for multiple custom classifications', () => {
    const customs: CustomClassification[] = [
      { id: 'non-sensitive', label: 'NON-SENSITIVE', color: '#2d7d2d', background: '#f0faf0' },
      { id: 'sensitive', label: 'SENSITIVE', color: '#b8860b', background: '#fff8e7' },
      { id: 'highly-sensitive', label: 'HIGHLY SENSITIVE', color: '#c41e1e', background: '#fff5f5' },
    ];
    manager.init(customs);
    const css = dom.styleEl.textContent!;

    expect(css).toContain('.pdf-non-sensitive');
    expect(css).toContain('.pdf-sensitive');
    expect(css).toContain('.pdf-highly-sensitive');
    expect(css).toContain('"NON-SENSITIVE"');
    expect(css).toContain('"SENSITIVE"');
    expect(css).toContain('"HIGHLY SENSITIVE"');
  });

  it('includes both top and bottom banner selectors', () => {
    const customs: CustomClassification[] = [
      { id: 'test-level', label: 'TEST', color: '#000', background: '#fff' },
    ];
    manager.init(customs);
    const css = dom.styleEl.textContent!;

    expect(css).toContain('.pdf-test-level .markdown-preview-view::before');
    expect(css).toContain('.pdf-test-level .markdown-preview-sizer::after');
  });

  it('updates styles dynamically', () => {
    manager.init([]);
    expect(dom.styleEl.textContent).toBe('');

    manager.update([
      { id: 'new-level', label: 'NEW', color: '#ff0000', background: '#fff0f0' },
    ]);
    expect(dom.styleEl.textContent).toContain('.pdf-new-level');
    expect(dom.styleEl.textContent).toContain('"NEW"');
  });

  it('skips entries with empty id', () => {
    const customs: CustomClassification[] = [
      { id: '', label: 'EMPTY', color: '#000', background: '#fff' },
      { id: 'valid', label: 'VALID', color: '#000', background: '#fff' },
    ];
    manager.init(customs);
    const css = dom.styleEl.textContent!;

    expect(css).not.toContain('"EMPTY"');
    expect(css).toContain('.pdf-valid');
  });

  it('escapes double quotes in labels', () => {
    const customs: CustomClassification[] = [
      { id: 'quoted', label: 'LEVEL "A"', color: '#000', background: '#fff' },
    ];
    manager.init(customs);
    const css = dom.styleEl.textContent!;

    expect(css).toContain('LEVEL \\"A\\"');
  });

  it('removes style element on destroy', () => {
    manager.init([]);
    manager.destroy();
    expect(dom.styleEl.remove).toHaveBeenCalledOnce();
  });
});
