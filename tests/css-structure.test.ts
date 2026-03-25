import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readdirSync } from 'node:fs';

/**
 * CSS structure tests — verify that expected selectors and properties
 * exist in the CSS files. Not rendering tests — structural correctness only.
 *
 * These catch accidental deletions, renames, or broken selectors.
 */

const ROOT = join(__dirname, '..');
const STYLES_CSS = readFileSync(join(ROOT, 'styles.css'), 'utf-8');

describe('styles.css — guttered headings', () => {
  it('has padding rule for all editor lines', () => {
    expect(STYLES_CSS).toContain('body.yaae-guttered-headings .cm-content .cm-line');
    expect(STYLES_CSS).toMatch(/padding-left:\s*var\(--yaae-gutter-width\)/);
  });

  it('has negative margin rule for heading formatting spans', () => {
    expect(STYLES_CSS).toContain('.cm-formatting-header');
    expect(STYLES_CSS).toMatch(/margin-left:\s*calc\(-1\s*\*\s*var\(--yaae-gutter-width\)\)/);
  });

  it('sets formatting-header to inline-block for layout', () => {
    expect(STYLES_CSS).toMatch(
      /\.cm-formatting-header\s*\{[^}]*display:\s*inline-block/s
    );
  });

  it('defines the gutter width CSS variable', () => {
    expect(STYLES_CSS).toMatch(/--yaae-gutter-width:\s*\d+px/);
  });
});

describe('styles.css — syntax dimming', () => {
  it('has dimming rules scoped to body class', () => {
    expect(STYLES_CSS).toContain('body.yaae-syntax-dimming');
  });

  it('sets opacity on formatting elements', () => {
    expect(STYLES_CSS).toMatch(/\.cm-formatting[^{]*\{[^}]*opacity/s);
  });
});

describe('styles.css — focus mode', () => {
  it('defines the dimmed class', () => {
    expect(STYLES_CSS).toContain('.yaae-dimmed');
  });

  it('dimmed class sets color and transition', () => {
    expect(STYLES_CSS).toMatch(/\.yaae-dimmed\s*\{[^}]*color/s);
    expect(STYLES_CSS).toMatch(/\.yaae-dimmed\s*\{[^}]*transition/s);
  });
});

describe('styles.css — print media', () => {
  it('hides prose highlighting in print', () => {
    // Uses attribute selector [class*="yaae-pos-"] inside @media print
    expect(STYLES_CSS).toContain('@media print');
    expect(STYLES_CSS).toContain('yaae-pos-');
    expect(STYLES_CSS).toContain('color: inherit !important');
  });
});

describe('print-styles components', () => {
  const COMPONENTS_DIR = join(ROOT, 'packages/print-styles/src/components');
  const PRESETS_DIR = join(ROOT, 'packages/print-styles/src/presets');

  // page-numbers and classification moved to PageChromeManager (@page margin boxes)
  const EXPECTED_COMPONENTS = [
    'appearance.css',
    'code.css',
    'copy-safe.css',
    'images.css',
    'landscape.css',
    'links.css',
    'page-break.css',
    'signature-block.css',
    'tables.css',
    'toc.css',
  ];

  const EXPECTED_PRESETS = [
    'typography.css',
    'watermark.css',
  ];

  it('all expected component files exist', () => {
    const actual = readdirSync(COMPONENTS_DIR).sort();
    for (const file of EXPECTED_COMPONENTS) {
      expect(actual, `missing component: ${file}`).toContain(file);
    }
  });

  it('all expected preset files exist', () => {
    const actual = readdirSync(PRESETS_DIR).sort();
    for (const file of EXPECTED_PRESETS) {
      expect(actual, `missing preset: ${file}`).toContain(file);
    }
  });

  it('every component file contains @media print', () => {
    for (const file of EXPECTED_COMPONENTS) {
      const css = readFileSync(join(COMPONENTS_DIR, file), 'utf-8');
      expect(css, `${file} missing @media print`).toMatch(/@media\s+print/);
    }
  });

  it('every preset file contains @media print', () => {
    for (const file of EXPECTED_PRESETS) {
      const css = readFileSync(join(PRESETS_DIR, file), 'utf-8');
      expect(css, `${file} missing @media print`).toMatch(/@media\s+print/);
    }
  });
});
