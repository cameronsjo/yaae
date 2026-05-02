import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Lifecycle / wiring regression tests for main.ts.
 *
 * main.ts pulls in CM6 imports that need browser DOM globals, so we test
 * the source structurally (text inspection) for wiring guarantees and
 * verify the data-shape behaviors via small isolated reproductions.
 *
 * Each block maps to a finding F1..F12 from the bug hunt.
 */

const MAIN_TS = readFileSync(join(__dirname, '..', 'main.ts'), 'utf-8');

// --- F1: theme propagation ------------------------------------------------

describe('F1 — export.pdf.theme propagates to PageChromeManager', () => {
  it('updatePageChromeFromActiveFile reads theme from frontmatter', () => {
    expect(MAIN_TS).toMatch(/result\.data\?\.export\?\.pdf\?\.theme/);
  });

  it('passes theme through to pageChromeManager.update when present', () => {
    // Spread pattern: ...(theme ? { theme } : {})
    expect(MAIN_TS).toMatch(/\.\.\.\(theme\s*\?\s*\{\s*theme\s*\}\s*:\s*\{\}\)/);
  });

  it('PageChromeState interface includes optional theme field', () => {
    const printStyles = readFileSync(
      join(__dirname, '..', 'src', 'document', 'print-styles.ts'),
      'utf-8',
    );
    expect(printStyles).toMatch(/theme\?:\s*'light'\s*\|\s*'dark'\s*\|\s*'auto'/);
  });
});

// --- F2: validateOnSave toggle is reactive --------------------------------

describe('F2 — validateOnSave toggle takes effect without reload', () => {
  it('does not gate the modify handler on startup setting value', () => {
    // The buggy form was: if (this.settings.document.validateOnSave) { registerEvent(...) }
    // The fix gates *inside* the handler. So the registerEvent(vault.on('modify', ...))
    // should not be wrapped in an outer if (this.settings.document.validateOnSave).
    const validateBlock = MAIN_TS.match(
      /\/\/ Validate on save[\s\S]*?this\.registerEvent\([\s\S]*?\)\s*\)\s*;/,
    );
    expect(validateBlock).not.toBeNull();
    const block = validateBlock![0];
    expect(block).not.toMatch(
      /if\s*\(\s*this\.settings\.document\.validateOnSave\s*\)\s*\{[\s\S]*?this\.registerEvent/,
    );
  });

  it('checks validateOnSave inside the modify handler at runtime', () => {
    expect(MAIN_TS).toMatch(
      /this\.app\.vault\.on\(\s*'modify'[\s\S]*?if\s*\(\s*!this\.settings\.document\.validateOnSave\s*\)\s*return/,
    );
  });
});
