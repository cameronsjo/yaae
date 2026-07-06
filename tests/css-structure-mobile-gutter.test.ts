import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CSS structure tests for the mobile guttered-headings sizing (#33).
 *
 * Extends the tests/css-structure.test.ts idiom: structural selector/property
 * assertions only, no rendering. Covers the body.is-mobile override rules and
 * their paired @settings (Style Settings) entries added alongside them.
 */

const ROOT = join(__dirname, '..');
const STYLES_CSS = readFileSync(join(ROOT, 'styles.css'), 'utf-8');

describe('styles.css — mobile guttered headings (#33)', () => {
  it('narrows the gutter width on body.is-mobile via the mobile variable', () => {
    expect(STYLES_CSS).toContain('body.is-mobile');
    expect(STYLES_CSS).toMatch(
      /body\.is-mobile\s*\{[^}]*--yaae-gutter-width:\s*var\(--yaae-gutter-width-mobile,\s*1\.75rem\)/s,
    );
  });

  it('shrinks the heading marker font size on mobile with a fallback', () => {
    expect(STYLES_CSS).toMatch(
      /body\.is-mobile \.yaae-heading-gutter-marker\s*\{[^}]*font-size:\s*var\(--yaae-gutter-marker-font-size-mobile,\s*0\.7em\)/s,
    );
  });

  it('tightens marker padding on mobile to fit the narrow gutter', () => {
    expect(STYLES_CSS).toMatch(
      /body\.is-mobile \.yaae-heading-gutter-marker\s*\{[^}]*padding-right:\s*0\.25rem/s,
    );
  });

  it('the mobile override rule comes after the base gutter-width rule (mobile wins the cascade)', () => {
    const baseIdx = STYLES_CSS.indexOf('--yaae-gutter-width: 4.5rem');
    const mobileIdx = STYLES_CSS.indexOf('body.is-mobile {');
    expect(baseIdx).toBeGreaterThan(-1);
    expect(mobileIdx).toBeGreaterThan(-1);
    expect(mobileIdx).toBeGreaterThan(baseIdx);
  });
});

describe('styles.css — @settings entries for mobile gutter knobs', () => {
  it('declares a Style Settings entry for the mobile gutter width', () => {
    expect(STYLES_CSS).toMatch(
      /id:\s*yaae-gutter-width-mobile[\s\S]{0,200}?type:\s*variable-text[\s\S]{0,80}?default:\s*1\.75rem/,
    );
  });

  it('declares a Style Settings entry for the mobile marker font size', () => {
    expect(STYLES_CSS).toMatch(
      /id:\s*yaae-gutter-marker-font-size-mobile[\s\S]{0,200}?type:\s*variable-text[\s\S]{0,80}?default:\s*0\.7em/,
    );
  });

  it('both mobile knobs are declared under the same Guttered Headings section as the base width', () => {
    // Extract the settings block between the "Guttered Headings" heading entry
    // and the next top-level heading ("PDF Print Styles") so a future reorg
    // that moves these knobs out from under their section fails loudly.
    const section = STYLES_CSS.match(
      /id:\s*yaae-gutter-heading[\s\S]*?(?=id:\s*yaae-print-heading)/,
    );
    expect(section).not.toBeNull();
    expect(section![0]).toContain('id: yaae-gutter-width-mobile');
    expect(section![0]).toContain('id: yaae-gutter-marker-font-size-mobile');
  });
});
