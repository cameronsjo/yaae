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

  it('PageChromeState interface includes a theme field', () => {
    const printStyles = readFileSync(
      join(__dirname, '..', 'src', 'document', 'print-styles.ts'),
      'utf-8',
    );
    // Field is required — consumed by PageChromeManager.update for the
    // auto-theme branch. Per-document `export.pdf.theme` frontmatter
    // overrides still propagate; main.ts spreads the override on top of
    // the global default from buildPageChromeState. Type aliased to
    // ThemeMode (imported from ./settings) so the union lives in one place.
    expect(printStyles).toMatch(/theme:\s*ThemeMode/);
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

// --- F3: race in updatePageChromeFromActiveFile ---------------------------

describe('F3 — updatePageChromeFromActiveFile is race-safe', () => {
  it('captures startFile before vault.read', () => {
    expect(MAIN_TS).toMatch(/const\s+startFile\s*=\s*this\.app\.workspace\.getActiveFile\(\)/);
  });

  it('re-checks getActiveFile() after vault.read and bails if changed', () => {
    expect(MAIN_TS).toMatch(
      /await\s+this\.app\.vault\.read\(startFile\)[\s\S]*?if\s*\(\s*this\.app\.workspace\.getActiveFile\(\)\s*!==\s*startFile\s*\)[\s\S]*?return/,
    );
  });
});

// --- F4: race in generateTocForCurrentFile --------------------------------

describe('F4 — generateTocForCurrentFile is race-safe', () => {
  it('re-checks active file after vault.read and bails before vault.modify', () => {
    const tocFn = MAIN_TS.match(/async\s+generateTocForCurrentFile\s*\(\s*\)[\s\S]*?\n\s{2}\}/);
    expect(tocFn).not.toBeNull();
    const body = tocFn![0];
    const readIdx = body.indexOf('vault.read(file)');
    const guardIdx = body.search(/this\.app\.workspace\.getActiveFile\(\)\s*!==\s*file/);
    const modifyIdx = body.indexOf('vault.modify(file');
    expect(readIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeGreaterThan(readIdx);
    expect(modifyIdx).toBeGreaterThan(guardIdx);
  });

  it('emits a debug message when aborting due to race', () => {
    expect(MAIN_TS).toMatch(/console\.debug\([^)]*TOC abort/);
  });
});

// --- F5: bootstrap on layout ready ----------------------------------------

describe('F5 — page chrome bootstraps from active file on startup', () => {
  it('calls updatePageChromeFromActiveFile from onLayoutReady', () => {
    expect(MAIN_TS).toMatch(
      /onLayoutReady\(\s*\(\)\s*=>\s*\{[\s\S]*?this\.updatePageChromeFromActiveFile\(\)/,
    );
  });
});

// --- F6: non-markdown active leaf does not clobber chrome ----------------

describe('F6 — non-markdown active leaf preserves last markdown chrome', () => {
  it('returns early without updating chrome for non-md files', () => {
    // After the startFile null/extension check, when extension !== 'md',
    // we must NOT call pageChromeManager.update — we just `return`.
    const fn = MAIN_TS.match(
      /async\s+updatePageChromeFromActiveFile\s*\(\s*\)\s*:\s*Promise<void>\s*\{[\s\S]*?\n\s{2}\}/,
    );
    expect(fn).not.toBeNull();
    const body = fn![0];

    const nonMdBranch = body.match(
      /if\s*\(\s*startFile\.extension\s*!==\s*'md'\s*\)\s*\{[\s\S]*?\}/,
    );
    expect(nonMdBranch).not.toBeNull();
    const branchBody = nonMdBranch![0];
    expect(branchBody).not.toMatch(/pageChromeManager\.update/);
    expect(branchBody).toMatch(/return/);
  });
});

// --- F7: TFile type guards -----------------------------------------------

describe('F7 — vault.read call sites guard with TFile instanceof', () => {
  it('validateCurrentFile checks instanceof TFile', () => {
    const fn = MAIN_TS.match(/async\s+validateCurrentFile\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/if\s*\(\s*!\(\s*file\s+instanceof\s+TFile\s*\)\s*\)\s*return/);
  });

  it('generateTocForCurrentFile checks instanceof TFile', () => {
    const fn = MAIN_TS.match(/async\s+generateTocForCurrentFile\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/);
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/if\s*\(\s*!\(\s*file\s+instanceof\s+TFile\s*\)\s*\)\s*return/);
  });

  it('applyCssClassesFromFrontmatter checks instanceof TFile', () => {
    const fn = MAIN_TS.match(
      /async\s+applyCssClassesFromFrontmatter\s*\(\s*\)\s*\{[\s\S]*?\n\s{2}\}/,
    );
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/if\s*\(\s*!\(\s*file\s+instanceof\s+TFile\s*\)\s*\)\s*return/);
  });
});

// --- F8: customClassifications resilience ---------------------------------

describe('F8 — loadSettings resets non-array customClassifications to []', () => {
  it('contains an Array.isArray guard for customClassifications', () => {
    expect(MAIN_TS).toMatch(
      /Array\.isArray\(\s*this\.settings\.document\.customClassifications\s*\)/,
    );
  });

  it('resets to [] when not an array', () => {
    expect(MAIN_TS).toMatch(
      /!Array\.isArray\(\s*this\.settings\.document\.customClassifications\s*\)[\s\S]*?this\.settings\.document\.customClassifications\s*=\s*\[\]/,
    );
  });

  // Behavioral test of the guard logic, copy-pasted from main.ts to avoid
  // importing the plugin (which pulls in CM6 / browser-only modules).
  it('guard logic resets null to []', () => {
    const document: { customClassifications: unknown } = { customClassifications: null };
    if (!Array.isArray(document.customClassifications)) {
      document.customClassifications = [];
    }
    expect(document.customClassifications).toEqual([]);
  });

  it('guard logic resets a string to []', () => {
    const document: { customClassifications: unknown } = { customClassifications: 'corrupt' };
    if (!Array.isArray(document.customClassifications)) {
      document.customClassifications = [];
    }
    expect(document.customClassifications).toEqual([]);
  });

  it('guard logic preserves a valid non-empty array', () => {
    const value = [{ id: 'tlp-red', label: 'TLP:RED', color: '#f00', background: '#000' }];
    const document: { customClassifications: unknown } = { customClassifications: value };
    if (!Array.isArray(document.customClassifications)) {
      document.customClassifications = [];
    }
    expect(document.customClassifications).toBe(value);
  });
});

// --- F9: cssclasses filter is type-safe -----------------------------------

describe('F9 — cssclasses filter rejects non-string entries safely', () => {
  it('filter callback uses a typeof string guard', () => {
    expect(MAIN_TS).toMatch(/typeof\s+c\s*===\s*'string'\s*&&\s*!c\.startsWith\(\s*'pdf-'\s*\)/);
  });

  // Behavioral reproduction of the filter logic.
  function filterUserCssClasses(input: unknown[]): string[] {
    return input.filter(
      (c): c is string => typeof c === 'string' && !c.startsWith('pdf-'),
    );
  }

  it('does not throw on numeric entries', () => {
    expect(() => filterUserCssClasses([1, 'pdf-foo', 'user-class'])).not.toThrow();
  });

  it('drops non-strings and pdf-* entries, keeps user classes', () => {
    expect(filterUserCssClasses([1, null, 'pdf-internal', 'theme-dark', 'pdf-foo']))
      .toEqual(['theme-dark']);
  });

  it('handles empty input', () => {
    expect(filterUserCssClasses([])).toEqual([]);
  });

  it('handles mixed undefined / boolean entries', () => {
    expect(filterUserCssClasses([undefined, true, false, 'keep'])).toEqual(['keep']);
  });
});

// --- F10: settings tab uses registerDomEvent ------------------------------

describe('F10 — settings tab nav buttons use registerDomEvent', () => {
  it('does not use raw addEventListener for tab nav buttons', () => {
    const cls = MAIN_TS.match(/class\s+YaaeSettingTab[\s\S]*$/);
    expect(cls).not.toBeNull();
    expect(cls![0]).toMatch(/this\.registerDomEvent\(\s*btn\s*,\s*'click'/);
    expect(cls![0]).not.toMatch(/btn\.addEventListener\(\s*'click'/);
  });
});

// --- F11: editorCheckCallback honors the checking flag --------------------

describe('F11 — yaae-generate-toc respects checking flag', () => {
  it('only invokes generateTocForCurrentFile when not checking', () => {
    const cmdBlock = MAIN_TS.match(/id:\s*'yaae-generate-toc'[\s\S]*?\}\)\s*;/);
    expect(cmdBlock).not.toBeNull();
    expect(cmdBlock![0]).toMatch(/if\s*\(\s*!checking\s*\)\s*this\.generateTocForCurrentFile\(\)/);
    expect(cmdBlock![0]).toMatch(/!file\s*\|\|\s*file\.extension\s*!==\s*'md'/);
  });

  // Behavioral simulation of the command's check/exec phases.
  it('checking=true returns true without firing work', () => {
    let workFired = 0;
    const fakeCommand = {
      editorCheckCallback: (checking: boolean) => {
        const file = { extension: 'md' };
        if (!file || file.extension !== 'md') return false;
        if (!checking) workFired++;
        return true;
      },
    };
    const result = fakeCommand.editorCheckCallback(true);
    expect(result).toBe(true);
    expect(workFired).toBe(0);
  });

  it('checking=false fires the work', () => {
    let workFired = 0;
    const fakeCommand = {
      editorCheckCallback: (checking: boolean) => {
        const file = { extension: 'md' };
        if (!file || file.extension !== 'md') return false;
        if (!checking) workFired++;
        return true;
      },
    };
    const result = fakeCommand.editorCheckCallback(false);
    expect(result).toBe(true);
    expect(workFired).toBe(1);
  });

  it('returns false (and does no work) for non-md files even when checking=false', () => {
    let workFired = 0;
    const fakeCommand = {
      editorCheckCallback: (checking: boolean) => {
        const file = { extension: 'pdf' };
        if (!file || file.extension !== 'md') return false;
        if (!checking) workFired++;
        return true;
      },
    };
    const result = fakeCommand.editorCheckCallback(false);
    expect(result).toBe(false);
    expect(workFired).toBe(0);
  });
});

// --- F12: deferred saveSettings during loadSettings migration -------------

describe('F12 — saveSettings during migration is deferred', () => {
  it('migration uses queueMicrotask instead of inline await saveSettings', () => {
    const block = MAIN_TS.match(
      /Migrate deprecated expandLinks\/plainLinks[\s\S]*?\n\s{2}\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/queueMicrotask\(\s*\(\)\s*=>\s*\{/);
    // The bare `await this.saveSettings();` form should be gone from this block.
    expect(block![0]).not.toMatch(/^\s*await\s+this\.saveSettings\(\);\s*$/m);
  });
});
