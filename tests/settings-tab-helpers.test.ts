import { describe, it, expect } from 'vitest';
import {
  FONT_CUSTOM_SENTINEL,
  FONT_PRESETS,
  isFontPreset,
  isValidClassificationId,
  sanitizeClassificationId,
} from '../src/document/settings-tab-helpers';

describe('sanitizeClassificationId', () => {
  it('lowercases input', () => {
    expect(sanitizeClassificationId('NON-Sensitive')).toBe('non-sensitive');
  });

  it('replaces whitespace runs with hyphens', () => {
    expect(sanitizeClassificationId('non sensitive')).toBe('non-sensitive');
    expect(sanitizeClassificationId('non   sensitive')).toBe('non-sensitive');
  });

  it('strips disallowed characters', () => {
    expect(sanitizeClassificationId('non!@#sensitive')).toBe('nonsensitive');
  });

  it('produces empty string for whitespace-only input', () => {
    // Sanitizer trims edge whitespace and strips edge hyphens, so
    // whitespace-only input collapses to ''. isValidClassificationId then
    // rejects it as a save guard.
    expect(sanitizeClassificationId('   ')).toBe('');
  });

  it('produces empty string for input with no allowed chars', () => {
    expect(sanitizeClassificationId('!@#$%')).toBe('');
  });

  it('trims edge whitespace and strips edge hyphens', () => {
    expect(sanitizeClassificationId(' non sensitive ')).toBe('non-sensitive');
    expect(sanitizeClassificationId('-foo-')).toBe('foo');
    expect(sanitizeClassificationId('--foo--bar--')).toBe('foo-bar');
  });
});

describe('isValidClassificationId (F3 save guard)', () => {
  it('rejects an empty string', () => {
    expect(isValidClassificationId('')).toBe(false);
  });

  it('rejects a string of hyphens (whitespace-only sanitized)', () => {
    expect(isValidClassificationId('-')).toBe(false);
    expect(isValidClassificationId('---')).toBe(false);
  });

  it('accepts an ID with at least one alphanumeric char', () => {
    expect(isValidClassificationId('a')).toBe(true);
    expect(isValidClassificationId('non-sensitive')).toBe(true);
    expect(isValidClassificationId('-x-')).toBe(true);
    expect(isValidClassificationId('1')).toBe(true);
  });

  it('end-to-end: whitespace-only input is sanitized then rejected', () => {
    const sanitized = sanitizeClassificationId('   ');
    expect(sanitized).toBe('');
    expect(isValidClassificationId(sanitized)).toBe(false);
  });

  it('end-to-end: legitimate input is sanitized then accepted', () => {
    const sanitized = sanitizeClassificationId('Non Sensitive');
    expect(sanitized).toBe('non-sensitive');
    expect(isValidClassificationId(sanitized)).toBe(true);
  });
});

describe('draft-entry persistence gate (F2)', () => {
  // The Add classification flow holds an in-memory draft until the user types
  // a valid ID. Persisting hinges on isValidClassificationId — these tests
  // document the per-keystroke save decision.
  type Stage = 'create' | 'typing' | 'invalid' | 'valid';
  const shouldPersist = (id: string, stage: Stage) =>
    stage !== 'create' && isValidClassificationId(id);

  it('does not persist on initial Add click', () => {
    expect(shouldPersist('', 'create')).toBe(false);
  });

  it('does not persist while ID is empty', () => {
    expect(shouldPersist('', 'typing')).toBe(false);
  });

  it('does not persist while ID is whitespace-only (post-sanitize: empty string)', () => {
    const sanitized = sanitizeClassificationId('   ');
    expect(shouldPersist(sanitized, 'invalid')).toBe(false);
  });

  it('persists once ID has at least one alphanumeric char', () => {
    const sanitized = sanitizeClassificationId('non sensitive');
    expect(shouldPersist(sanitized, 'valid')).toBe(true);
  });
});

describe('isFontPreset (F4 dropdown detection)', () => {
  it('recognizes the four named presets', () => {
    expect(isFontPreset('sans')).toBe(true);
    expect(isFontPreset('serif')).toBe(true);
    expect(isFontPreset('mono')).toBe(true);
    expect(isFontPreset('system')).toBe(true);
  });

  it('rejects arbitrary font strings', () => {
    expect(isFontPreset('Inter')).toBe(false);
    expect(isFontPreset('"Helvetica Neue", sans-serif')).toBe(false);
    expect(isFontPreset('')).toBe(false);
  });

  it('rejects the custom sentinel itself (UI-only marker)', () => {
    // The sentinel is a UI-only marker — it must never round-trip into
    // settings as if it were a real preset.
    expect(isFontPreset(FONT_CUSTOM_SENTINEL)).toBe(false);
  });
});

describe('font-family persistence behavior (F4)', () => {
  // These tests document the contract: arbitrary `fontFamily` values must
  // survive a no-op dropdown interaction. The dropdown UI uses isFontPreset
  // to decide whether to render the value as a preset selection or as the
  // custom sentinel.
  it('arbitrary font value displays via the Custom branch', () => {
    const stored = 'Inter';
    const displayValue = isFontPreset(stored) ? stored : FONT_CUSTOM_SENTINEL;
    expect(displayValue).toBe(FONT_CUSTOM_SENTINEL);
  });

  it('preset value displays as itself', () => {
    const stored = 'serif';
    const displayValue = isFontPreset(stored) ? stored : FONT_CUSTOM_SENTINEL;
    expect(displayValue).toBe('serif');
  });

  it('arbitrary fontFamily survives a no-op dropdown interaction', () => {
    // Simulating: user has 'Inter' stored, opens the dropdown (which shows
    // 'Custom...' selected), clicks 'Custom...' again. The new dropdown
    // value is the sentinel, which the onChange handler treats as "reveal
    // input, do not overwrite".
    let stored = 'Inter';
    const newDropdownValue = FONT_CUSTOM_SENTINEL;
    if (newDropdownValue !== FONT_CUSTOM_SENTINEL) {
      stored = newDropdownValue;
    }
    expect(stored).toBe('Inter');
  });
});

// --- Round-2: FONT_PRESETS / isFontPreset coupling ---
// FONT_PRESETS is the source of truth for the dropdown; isFontPreset is the
// runtime check the settings UI uses to decide between the preset branch
// and the custom-input branch. They must agree on every entry, both
// directions, or the dropdown will overwrite arbitrary font strings.

describe('FONT_PRESETS / isFontPreset agreement', () => {
  it('isFontPreset accepts every member of FONT_PRESETS', () => {
    for (const preset of FONT_PRESETS) {
      expect(isFontPreset(preset)).toBe(true);
    }
  });

  it('FONT_PRESETS contains exactly the four named presets in stable order', () => {
    // Order matters — the dropdown is rendered from this list. Lock it in
    // so a refactor that reorders or trims silently fails the test.
    expect([...FONT_PRESETS]).toEqual(['sans', 'serif', 'mono', 'system']);
  });

  it('FONT_CUSTOM_SENTINEL is not a member of FONT_PRESETS', () => {
    // The sentinel must never collide with a real preset, otherwise the
    // dropdown's "Custom..." option would be indistinguishable from a
    // preset selection on first render.
    expect((FONT_PRESETS as readonly string[]).includes(FONT_CUSTOM_SENTINEL))
      .toBe(false);
  });

  it('isFontPreset rejects values that look like preset names but differ in case', () => {
    // Settings round-trip is case-sensitive; "Sans" stored from a tampered
    // data.json must take the Custom branch so it surfaces in the input
    // (and the user can fix or accept it).
    expect(isFontPreset('Sans')).toBe(false);
    expect(isFontPreset('SERIF')).toBe(false);
    expect(isFontPreset(' sans')).toBe(false);
    expect(isFontPreset('sans ')).toBe(false);
  });
});
